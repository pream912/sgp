require('dotenv').config({ override: true });
console.log("Starting Server...");
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { buildSite, rebuildSite } = require('./services/builder');
const { deploySite, makeBucketPrivate, makeBucketPublic } = require('./services/deploy');
const { uploadDirectory, downloadDirectory } = require('./services/storage');
const { createOrder, verifyPayment } = require('./services/payments');
const { extractFromUrl } = require('./services/business-extractor');
const { checkAvailability, purchaseDomain, getSuggestions, setupGCPDomain, verifyDomainDNS, checkSubdomainAvailability } = require('./services/domains');
const { generateCode, fixCode, regenerateSection, updateSectionContent, regeneratePage } = require('./services/ai-coder');
const { generateDesign, generatePalette } = require('./services/ai-architect');
const { getUserCredits, addCredits, deductCredits, getTransactions } = require('./services/credits');
const { db, admin, auth } = require('./services/firebase');
const verifyToken = require('./middleware/auth');

const cookieParser = require('cookie-parser'); // Import cookie-parser
const cors = require('cors'); // Import cors

const app = express();
app.use(cors({ origin: true, credentials: true })); // Enable CORS for all origins with credentials
app.use(express.json());
app.use(cookieParser()); // Use cookie-parser

// --- Wildcard Subdomain Routing (*.genweb.in) ---
app.use(async (req, res, next) => {
    const host = req.headers.host;
    // Check if request is for a subdomain of genweb.in (and not www or the root API)
    // Adjust 'genweb.in' to match your actual domain if different in production
    const DOMAIN_SUFFIX = '.genweb.in';
    
    // Exclude reserved subdomains that shouldn't be routed to GCS
    // 'app' and 'www' are hosted on Netlify. 'api' is this server itself (direct hit).
    const RESERVED_SUBDOMAINS = [`www${DOMAIN_SUFFIX}`, `api${DOMAIN_SUFFIX}`, `app${DOMAIN_SUFFIX}`];

    if (host && host.endsWith(DOMAIN_SUFFIX) && !RESERVED_SUBDOMAINS.includes(host)) {
        const subdomain = host.slice(0, -DOMAIN_SUFFIX.length);
        
        try {
            console.log(`[Wildcard Router] Routing for subdomain: ${subdomain}`);
            
            // 1. Lookup Project
            if (db) {
                const snapshot = await db.collection('projects').where('subdomain', '==', subdomain).get();
                
                if (!snapshot.empty) {
                    const project = snapshot.docs[0].data();
                    const projectId = project.projectId;
                    
                    // 2. Proxy from GCS
                    // Url: https://storage.googleapis.com/site-{projectId}/index.html
                    const bucketName = `site-${projectId}`;
                    // Simple logic: If request is root, serve index.html. Else try to serve file.
                    // For SPA/Single file sites, we usually just serve index.html or assets.
                    
                    const filePath = req.url === '/' ? '/index.html' : req.url;
                    const gcsUrl = `https://storage.googleapis.com/${bucketName}${filePath}`;
                    
                    const https = require('https');
                    
                    return https.get(gcsUrl, (proxyRes) => {
                        if (proxyRes.statusCode === 404 && req.url !== '/') {
                             // If asset not found, do we 404 or serve index? 
                             // For now, let's 404.
                             res.status(404).send('Not Found');
                             return;
                        }
                        
                        // Copy headers
                        res.status(proxyRes.statusCode);
                        Object.keys(proxyRes.headers).forEach(key => {
                             // clean up some headers?
                             res.setHeader(key, proxyRes.headers[key]);
                        });
                        
                        proxyRes.pipe(res);
                    }).on('error', (e) => {
                        console.error('Proxy Stream Error:', e);
                        res.status(502).send('Upstream Error');
                    });
                }
            }
            
            // If DB not connected or project not found, fall through to 404 or main app?
            // If it ends in .genweb.in but we found no project, it's a 404.
            return res.status(404).send('Site not found');
            
        } catch (error) {
            console.error('Wildcard routing error:', error);
            return res.status(500).send('Internal Server Error');
        }
    }
    
    next();
});

// Configure Multer for file uploads
const upload = multer({ dest: path.join(__dirname, 'temp/uploads') });

// Helper: Ensure Project Source Exists (Download from GCS if missing)
async function ensureProjectSource(id) {
    const projectDir = path.join(__dirname, 'projects_source', id);
    if (await fs.pathExists(projectDir)) {
        return true;
    }
    
    console.log(`[${id}] Project source missing locally. Attempting to download from GCS...`);
    try {
        await fs.ensureDir(projectDir);
        // Download from GCS: prefix 'projects/{id}' -> local 'projects_source/{id}'
        // Our storage structure is projects/{id}/...
        const success = await downloadDirectory(`projects/${id}`, projectDir);
        if (success) {
            console.log(`[${id}] Project source restored.`);
            
            // Re-link node_modules from skeleton to ensure it works on this instance
            try {
                const skeletonModules = path.join(__dirname, 'templates/html-skeleton/node_modules');
                const projectModules = path.join(projectDir, 'node_modules');
                
                // Remove restored node_modules (likely broken or partial)
                await fs.remove(projectModules);
                
                // Symlink to the valid local modules
                await fs.ensureSymlink(skeletonModules, projectModules);
                console.log(`[${id}] node_modules re-linked.`);
            } catch (err) {
                console.warn(`[${id}] Failed to re-link node_modules:`, err.message);
            }

            // Ensure the site is available in public/sites for the editor preview
            try {
                const distPath = path.join(projectDir, 'dist');
                const publicSitePath = path.join(__dirname, 'public/sites', id);
                if (await fs.pathExists(distPath)) {
                    await fs.copy(distPath, publicSitePath);
                    console.log(`[${id}] Restored site copied to public/sites for preview.`);
                }
            } catch (copyErr) {
                 console.warn(`[${id}] Failed to copy to public/sites:`, copyErr.message);
            }

            return true;
        } else {
            console.warn(`[${id}] Project source not found in GCS.`);
            // Cleanup empty dir
            await fs.remove(projectDir); 
            return false;
        }
    } catch (error) {
        console.error(`[${id}] Failed to restore project source:`, error);
        return false;
    }
}

// Protect Static Sites
app.use('/sites/:projectId', async (req, res, next) => {
    const { projectId } = req.params;
    
    // Ensure project source and public site files exist (Hydrate from Private Bucket if needed)
    try {
        await ensureProjectSource(projectId);
        
        // Double check: Ensure public/sites/${projectId} exists (Sync from projects_source if needed)
        // ensureProjectSource only copies if it downloads. If source exists but public doesn't, we need to copy.
        const publicSitePath = path.join(__dirname, 'public/sites', projectId);
        const sourceDistPath = path.join(__dirname, 'projects_source', projectId, 'dist');
        
        if (!await fs.pathExists(publicSitePath) && await fs.pathExists(sourceDistPath)) {
            console.log(`[${projectId}] Syncing dist to public/sites for preview...`);
            await fs.copy(sourceDistPath, publicSitePath);
        }
    } catch (err) {
        console.error(`[${projectId}] Failed to ensure site files:`, err);
        // Continue anyway? Or fail? If files are missing, static middleware will 404.
    }
    
    // Allow if verifying ownership via token or if published
    try {
        if (!db) return next(); // Fallback if no DB

        const projectRef = db.collection('projects').where('projectId', '==', projectId);
        const snapshot = await projectRef.get();
        
        if (snapshot.empty) {
            // If project doesn't exist in DB but exists on disk? 
            // Maybe it's a temp one or deleted. Block to be safe.
            return res.status(404).send('Site not found');
        }

        const projectData = snapshot.docs[0].data();

        // 1. Public Access (Published)
        if (projectData.isPublished) {
            return next();
        }

        // 2. Owner Access (via Cookie or Header)
        let token = req.cookies?.access_token || req.headers.authorization?.split(' ')[1];
        
        // Check query param for initial iframe load if cookie fails/cross-site issues (fallback)
        if (!token && req.query.token) {
            token = req.query.token;
        }

        if (token) {
            try {
                const decoded = await admin.auth().verifyIdToken(token);
                if (decoded.uid === projectData.userId) {
                    return next();
                }
            } catch (e) {
                // Token invalid
            }
        }

        return res.status(403).send('Access Denied. This site is not published yet. <a href="/">Go Back</a>');

    } catch (error) {
        console.error('Site protection error:', error);
        return res.status(500).send('Server Error');
    }
});

// Serve generated sites statically (fallback, main hosting is GCS)
app.use('/sites', express.static(path.join(__dirname, 'public/sites')));

const PORT = process.env.PORT || 3000;

// Email Transporter (Configure with your SMTP settings)
const transporter = nodemailer.createTransport({
    service: 'gmail', // Example: Use Gmail or configure generic SMTP
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Helper: Save Artifacts (GCS Only - No Cloudflare Deploy)
async function saveBuildArtifacts(id, distPath, userId) {
    try {
        console.log(`[${id}] Saving build artifacts to GCS...`);
        
        // 1. Upload DIST to GCS (projects/{id}/dist)
        await uploadDirectory(distPath, `projects/${id}/dist`);
        
        // 2. Return Local Preview URL
        // In GCS storage mode, we don't have a live public URL until published.
        // We return the local server URL for the editor preview.
        const localUrl = `http://localhost:${PORT}/sites/${id}/index.html`;
        
        // Update DB with updated timestamp but NOT deployUrl
        if (db) {
            const updateData = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            const snapshot = await db.collection('projects').where('projectId', '==', id).get();
            if (!snapshot.empty) {
                await snapshot.docs[0].ref.update(updateData);
            }
        }
        
        return localUrl;
    } catch (error) {
        console.error(`[${id}] Save artifacts failed:`, error);
        throw error; 
    }
}

// Extract Business Info (Pre-build step)
app.post('/api/extract-info', verifyToken, async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    try {
        console.log(`Extracting info for query: "${query}"...`);
        const userContext = await extractFromUrl(query);
        res.json({ userContext });
    } catch (error) {
        console.error('Extraction failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Submit Lead (Public Endpoint for Generated Sites)
app.post('/api/submit-lead', async (req, res) => {
    const { projectId, formData } = req.body;
    
    try {
        if (!projectId || !formData) {
            return res.status(400).json({ error: 'Missing projectId or formData' });
        }

        // 1. Get Project Owner
        let userId = null;
        let userEmail = null;
        
        if (db) {
            const projectsRef = db.collection('projects');
            const snapshot = await projectsRef.where('projectId', '==', projectId).get();
            
            if (snapshot.empty) {
                return res.status(404).json({ error: 'Project not found' });
            }
            
            const projectData = snapshot.docs[0].data();
            userId = projectData.userId;
            
            // Get User Email from Auth
            try {
                const userRecord = await admin.auth().getUser(userId);
                userEmail = userRecord.email;
            } catch (err) {
                console.error('Error fetching user for email:', err);
            }
            
            // 2. Save Lead to Firestore
            await db.collection('leads').add({
                projectId,
                userId,
                formData,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'new'
            });
        }

        // 3. Send Email Notification
        if (userEmail && process.env.SMTP_USER && process.env.SMTP_PASS) {
            const mailOptions = {
                from: process.env.SMTP_USER,
                to: userEmail,
                subject: `New Lead for Project ${projectId}`,
                text: `You have a new submission on your website!\n\nDetails:\n${JSON.stringify(formData, null, 2)}`,
                html: `<h3>New Lead Received</h3><p>You have a new submission on your website.</p><pre>${JSON.stringify(formData, null, 2)}</pre>`
            };
            
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log('Error sending email:', error);
                } else {
                    console.log('Email sent:', info.response);
                }
            });
        } else {
            console.log(`[Mock Email] To: ${userEmail}, Body:`, formData);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Submit lead failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get All Leads for User
app.get('/api/leads', verifyToken, async (req, res) => {
    try {
        if (!db) {
            return res.json([]);
        }

        let snapshot;
        try {
            snapshot = await db.collection('leads')
                .where('userId', '==', req.user.uid)
                .orderBy('createdAt', 'desc')
                .get();
        } catch (queryError) {
            console.warn('Sorted query failed (api/leads), falling back to unsorted:', queryError.message);
            // Fallback to unsorted if index is missing
            snapshot = await db.collection('leads')
                .where('userId', '==', req.user.uid)
                .get();
        }
            
        const leads = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : null
        }));
        
        res.json(leads);
        
    } catch (error) {
        console.error('Fetch all leads failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Leads for a Project
app.get('/api/project/:id/leads', verifyToken, async (req, res) => {
    const { id } = req.params;
    
    try {
        if (!db) {
            return res.json([]);
        }

        // Verify ownership
        const projectRef = db.collection('projects').where('projectId', '==', id).where('userId', '==', req.user.uid);
        const projectSnap = await projectRef.get();
        
        if (projectSnap.empty) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        let snapshot;
        try {
            snapshot = await db.collection('leads')
                .where('projectId', '==', id)
                .orderBy('createdAt', 'desc')
                .get();
        } catch (queryError) {
            console.warn('Sorted query failed, falling back to unsorted:', queryError.message);
            // Fallback to unsorted if index is missing
            snapshot = await db.collection('leads')
                .where('projectId', '==', id)
                .get();
        }
            
        const leads = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : null
        }));
        
        res.json(leads);
        
    } catch (error) {
        console.error('Fetch leads failed:', error);
        await fs.appendFile('backend-error.log', `${new Date().toISOString()} - Fetch leads error: ${error.message}\n${error.stack}\n`);
        res.status(500).json({ error: error.message });
    }
});

// Get User's Projects
app.get('/api/projects', verifyToken, async (req, res) => {
    try {
        if (!db) {
            return res.json([]); // Return empty if DB not configured
        }
        const snapshot = await db.collection('projects')
            .where('userId', '==', req.user.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Get Pages List
app.get('/api/project/:id/pages', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });
        
        const distPath = path.join(__dirname, 'projects_source', id, 'dist');
        if (!await fs.pathExists(distPath)) {
            return res.status(404).json({ error: 'Dist folder not found' });
        }
        
        const files = await fs.readdir(distPath);
        const htmlFiles = files.filter(f => f.endsWith('.html'));
        
        // Ensure index.html is first
        const sorted = htmlFiles.sort((a, b) => {
            if (a === 'index.html') return -1;
            if (b === 'index.html') return 1;
            return a.localeCompare(b);
        });
        
        res.json({ pages: sorted });
        
    } catch (error) {
        console.error('Fetch pages list failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Current Theme
app.get('/api/project/:id/theme', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const configPath = path.join(__dirname, 'projects_source', id, 'tailwind.config.js');
        if (!await fs.pathExists(configPath)) {
            return res.status(404).json({ error: 'Project configuration not found' });
        }
        const configContent = await fs.readFile(configPath, 'utf-8');
        
        // Extract colors using regex
        const colors = {};
        const keys = ['primary', 'secondary', 'accent', 'background', 'text', 'buttonBackground', 'buttonText'];
        
        keys.forEach(key => {
            const match = configContent.match(new RegExp(`${key}:\\s*["']([^"']+)["']`));
            if (match) {
                colors[key] = match[1];
            }
        });
        
        res.json({ colors });
    } catch (error) {
        console.error('Get theme failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Regenerate Theme Palette
app.post('/api/project/:id/theme/regenerate', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        // Fetch project context
        let context = "Modern Business";
        if (db) {
            const snapshot = await db.collection('projects').where('projectId', '==', id).get();
            if (!snapshot.empty) {
                context = snapshot.docs[0].data().query;
            }
        }
        
        const palette = await generatePalette(context);
        res.json({ colors: palette });
        
    } catch (error) {
        console.error('Regenerate theme failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update a Section (Generic AI Instruction)
app.post('/api/project/:id/section', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { sectionId, instruction, page } = req.body;
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        // --- Credit Deduction ---
        try {
            await deductCredits(req.user.uid, 50, `Redesign section ${sectionId} for project ${id}`);
        } catch (err) {
            return res.status(402).json({ error: 'Insufficient credits for AI redesign.' });
        }
        // ------------------------

        const distDir = path.join(__dirname, 'projects_source', id, 'dist');
        let targetFile = 'index.html';

        if (page) {
            targetFile = page;
        } else {
             // Auto-discovery
             try {
                 const files = await fs.readdir(distDir);
                 const htmlFiles = files.filter(f => f.endsWith('.html'));
                 
                 for (const file of htmlFiles) {
                     const content = await fs.readFile(path.join(distDir, file), 'utf-8');
                     if (content.includes(`data-section="${sectionId}"`)) {
                         targetFile = file;
                         break;
                     }
                 }
             } catch (e) {
                 console.warn(`[AutoDiscovery] Failed to scan files: ${e.message}`);
             }
        }

        const sourcePath = path.join(distDir, targetFile);
        
        if (!await fs.pathExists(sourcePath)) {
            return res.status(404).json({ error: `Page ${targetFile} not found` });
        }
        
        const currentCode = await fs.readFile(sourcePath, 'utf-8');
        
        console.log(`Regenerating section '${sectionId}' in file '${targetFile}' for project ${id}...`);
        const newCode = await regenerateSection(currentCode, sectionId, instruction);
        
        // Backup old code (simple undo)
        await fs.writeFile(sourcePath + '.bak', currentCode);
        
        // Write new code
        await fs.writeFile(sourcePath, newCode);
        
        // Rebuild & Deploy
        // Rebuild & Save (GCS only)
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
        
        res.json({ success: true, url: previewUrl });
        
    } catch (error) {
        console.error('Update failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Regenerate Entire Page (Global AI Instruction)
app.post('/api/project/:id/regenerate-page', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { instruction, page } = req.body;
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        // --- Credit Deduction ---
        try {
            await deductCredits(req.user.uid, 100, `Regenerate page for project ${id}`);
        } catch (err) {
            return res.status(402).json({ error: 'Insufficient credits for AI regeneration.' });
        }
        // ------------------------

        const distDir = path.join(__dirname, 'projects_source', id, 'dist');
        const targetFile = page || 'index.html';
        const sourcePath = path.join(distDir, targetFile);
        
        if (!await fs.pathExists(sourcePath)) {
            return res.status(404).json({ error: `Page ${targetFile} not found` });
        }
        
        const currentCode = await fs.readFile(sourcePath, 'utf-8');
        
        console.log(`Regenerating page '${targetFile}' for project ${id}...`);
        const newCode = await regeneratePage(currentCode, instruction);
        
        // Backup old code
        await fs.writeFile(sourcePath + '.bak', currentCode);
        
        // Write new code
        await fs.writeFile(sourcePath, newCode);
        
        // Rebuild & Save (GCS only)
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
        
        res.json({ success: true, url: previewUrl });
        
    } catch (error) {
        console.error('Page regeneration failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update Specific Content (Text/Image)
app.post('/api/project/:id/content', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { sectionId, type, originalValue, newValue, page } = req.body; // type: 'text' | 'image'
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const distDir = path.join(__dirname, 'projects_source', id, 'dist');
        let targetFile = 'index.html';

        if (page) {
            targetFile = page;
        } else {
             // Auto-discovery: Find which file contains the section
             try {
                 const files = await fs.readdir(distDir);
                 const htmlFiles = files.filter(f => f.endsWith('.html'));
                 
                 for (const file of htmlFiles) {
                     const content = await fs.readFile(path.join(distDir, file), 'utf-8');
                     if (content.includes(`data-section="${sectionId}"`)) {
                         targetFile = file;
                         break;
                     }
                 }
             } catch (e) {
                 console.warn(`[AutoDiscovery] Failed to scan files: ${e.message}`);
             }
        }

        const sourcePath = path.join(distDir, targetFile);
        
        if (!await fs.pathExists(sourcePath)) {
            return res.status(404).json({ error: `Page ${targetFile} not found` });
        }
        
        const currentCode = await fs.readFile(sourcePath, 'utf-8');
        
        console.log(`Updating ${type} in section '${sectionId}' in file '${targetFile}' for project ${id}...`);
        const newCode = await updateSectionContent(currentCode, sectionId, type, originalValue, newValue);
        
        // Backup
        await fs.writeFile(sourcePath + '.bak', currentCode);
        
        // Write
        await fs.writeFile(sourcePath, newCode);
        
        // Rebuild & Deploy
        // Rebuild & Save (GCS only)
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
        
        res.json({ success: true, url: previewUrl });
        
    } catch (error) {
        console.error('Content update failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Undo Last Change
app.post('/api/project/:id/undo', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const sourcePath = path.join(__dirname, 'projects_source', id, 'dist/index.html');
        const backupPath = sourcePath + '.bak';
        
        if (!await fs.pathExists(backupPath)) {
            return res.status(400).json({ error: 'No undo available' });
        }
        
        // Restore backup
        await fs.copy(backupPath, sourcePath);
        
        console.log(`Undoing changes for project ${id}...`);
        // Rebuild & Save (GCS only)
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
        
        res.json({ success: true, url: previewUrl });
    } catch (error) {
         console.error('Undo failed:', error);
         res.status(500).json({ error: error.message });
    }
});

// Upload Asset
app.post('/api/project/:id/upload', verifyToken, upload.single('file'), async (req, res) => {
    const { id } = req.params;
    const file = req.file;
    
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        // Target: projects_source/<id>/dist/assets/
        const assetsDir = path.join(__dirname, 'projects_source', id, 'dist/assets');
        await fs.ensureDir(assetsDir);
        
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}${ext}`;
        const destPath = path.join(assetsDir, filename);
        
        // Move from temp upload to assets
        await fs.move(file.path, destPath);
        
        // Return URL relative to site root
        res.json({ url: `./assets/${filename}` });
        
    } catch (error) {
        console.error('Upload failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update Theme
app.post('/api/project/:id/theme', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { colors } = req.body; // Expect { primary: '#...', secondary: '#...', ... }
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const configPath = path.join(__dirname, 'projects_source', id, 'tailwind.config.js');
        
        if (!await fs.pathExists(configPath)) {
            return res.status(404).json({ error: 'Project configuration not found' });
        }
        
        let configContent = await fs.readFile(configPath, 'utf-8');
        
        // Simple regex replacement for each color key
        // Assumes format: key: "value",
        Object.entries(colors).forEach(([key, value]) => {
             // Regex looks for: key: "..." or key: '...'
             const regex = new RegExp(`${key}:\\s*["'][^"']*["']`, 'g');
             configContent = configContent.replace(regex, `${key}: "${value}"`);
        });

        await fs.writeFile(configPath, configContent);
        
        console.log(`Updating theme for project ${id}...`);
        // Rebuild & Save (GCS only)
        const distPath = await rebuildSite(id);
        const previewUrl = await saveBuildArtifacts(id, distPath, req.user.uid);
        
        res.json({ success: true, url: previewUrl });
        
    } catch (error) {
        console.error('Theme update failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Extract Business Info (Pre-Build)
app.post('/api/extract', verifyToken, async (req, res) => {
    const { query } = req.body;
    try {
        if (!query) return res.status(400).json({ error: 'Query is required' });
        
        console.log(`[API] Extracting info for: "${query}"...`);
        const userContext = await extractFromUrl(query);
        
        res.json({ success: true, data: userContext });
    } catch (error) {
        console.error('Extraction failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Initialize Build (Step 1)
app.post('/api/build', verifyToken, upload.single('logo'), async (req, res) => {
    let { userContext, businessUrl, businessQuery, pages, stylePreset } = req.body;
    const logoFile = req.file; // Get the uploaded logo file

    // Parse pages if it comes as a string (from FormData)
    let parsedPages = ['Home'];
    if (pages) {
        try {
            parsedPages = typeof pages === 'string' ? JSON.parse(pages) : pages;
        } catch (e) {
            console.error('Error parsing pages:', e);
        }
    }

    const id = Date.now().toString();
    
    // Generate default subdomain (project-id based for uniqueness initially)
    // Users can customize this later.
    const defaultSubdomain = `site-${id}`; // e.g. site-176...

    // Allow businessUrl or businessQuery to drive the extraction
    const query = businessQuery || businessUrl;

    try {
        // Only extract if userContext is not provided
        if (!userContext && query) {
            console.log(`Extracting info for query: "${query}"...`);
            userContext = await extractFromUrl(query);
            console.log('Extracted Context:', userContext);
        }

        if (!userContext) {
            return res.status(400).json({ error: 'userContext or businessQuery is required' });
        }

        // --- Credit Check (Pre-Auth) ---
        const cost = parsedPages.length > 1 ? 400 : 200;
        const currentCredits = await getUserCredits(req.user.uid);
        if (currentCredits < cost) {
            return res.status(402).json({ error: 'Insufficient credits. Please top up your wallet.' });
        }
        // -------------------------------

        console.log(`Initializing build for ${id} (Pages: ${parsedPages.join(', ')})...`);
        
        // Initialize Firestore Document
        if (db) {
            await db.collection('projects').doc(id).set({ // Use custom ID as doc ID for easier lookup
                projectId: id,
                userId: req.user.uid,
                query: query || 'Manual Context',
                status: 'starting',
                subdomain: defaultSubdomain, // Set default subdomain
                logs: [],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                isPublished: false,
                stylePreset: stylePreset || 'standard'
            });
        }

        // Trigger Background Process (Fire and Forget)
        runBuildProcess(id, userContext, logoFile, parsedPages, req.user.uid, cost, query, stylePreset)
            .catch(err => console.error(`Background build ${id} failed hard:`, err));

        // Return immediately
        res.json({ success: true, id, status: 'processing', message: 'Build started in background.' });
        
    } catch (error) {
        console.error('Build init failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Background Build Processor
async function runBuildProcess(id, userContext, logoFile, parsedPages, userId, cost, query, stylePreset) {
    console.log(`[${id}] Starting background build process...`);
    
    const logProgress = async (message) => {
        console.log(`[${id}] Progress: ${message}`);
        if (db) {
            try {
                await db.collection('projects').doc(id).update({
                    status: 'processing',
                    logs: admin.firestore.FieldValue.arrayUnion({
                        message,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (e) {
                console.warn(`[${id}] Failed to update firestore log:`, e.message);
            }
        }
    };

    try {
        await logProgress('Starting build engine...');
        
        const distPath = await buildSite(id, userContext, logoFile, parsedPages, logProgress, stylePreset);
        
        await logProgress('Build success! Saving & Deploying...');
        
        // 1. Move the entire project (source + dist) to projects_source
        const sourcePath = path.join(__dirname, 'projects_source', id);
        const tempPath = path.join(__dirname, 'temp', id);
        
        await fs.move(tempPath, sourcePath);
        await logProgress(`Source code saved.`);

        // 2. Copy the 'dist' folder to 'public/sites' for hosting (Legacy fallback)
        const localSitePath = path.join(__dirname, 'public/sites', id);
        await fs.copy(path.join(sourcePath, 'dist'), localSitePath);
        
        const localUrl = `http://localhost:${PORT}/sites/${id}/index.html`;

        // 3. Post-Build: Save to Storage (GCS)
        await logProgress('Saving to Cloud Storage...');
        const savedUrl = await saveBuildArtifacts(id, path.join(sourcePath, 'dist'), userId);
        
        // 4. Deduct Credits (Only on Success)
        try {
            await deductCredits(userId, cost, `Generate ${parsedPages.length > 1 ? 'Multi-Page' : 'Single-Page'} Site (${id})`);
            await logProgress('Credits deducted.');
        } catch (creditErr) {
            console.error(`[${id}] Failed to deduct credits after success:`, creditErr);
            // Don't fail the build for this, but log it critically
        }

        // Final DB Update
        if (db) {
            await db.collection('projects').doc(id).update({
                status: 'completed',
                isPublished: false,
                url: savedUrl, // Default to preview URL until published
                localUrl: localUrl,
                // deployUrl: null, // Don't wipe it if it exists, but don't set it either
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                logs: admin.firestore.FieldValue.arrayUnion({
                    message: 'Process Finished Successfully.',
                    timestamp: new Date().toISOString()
                })
            });
        }
        
        console.log(`[${id}] Process Finished Successfully.`);

    } catch (error) {
        console.error(`[${id}] Build Process Failed:`, error);
        if (db) {
            await db.collection('projects').doc(id).update({
                status: 'failed',
                error: error.message,
                logs: admin.firestore.FieldValue.arrayUnion({
                    message: `Error: ${error.message}`,
                    timestamp: new Date().toISOString()
                })
            });
        }
        
        // Cleanup temp if it exists and wasn't moved
        try {
             const tempPath = path.join(__dirname, 'temp', id);
             if (await fs.pathExists(tempPath)) {
                 await fs.remove(tempPath);
             }
        } catch (cleanupErr) { /* ignore */ }
    }
}

// --- Payments (Razorpay) ---

app.post('/api/payments/order', verifyToken, async (req, res) => {
    const { amount, currency } = req.body;
    try {
        const order = await createOrder(amount, currency);
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/payments/verify', verifyToken, async (req, res) => {
    const { orderId, paymentId, signature } = req.body;
    const isValid = verifyPayment(orderId, paymentId, signature);
    
    if (isValid) {
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, error: 'Invalid Signature' });
    }
});

// --- Credit System Endpoints ---

// Get User Credits
app.get('/api/credits', verifyToken, async (req, res) => {
    try {
        const credits = await getUserCredits(req.user.uid);
        res.json({ credits });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Credit History
app.get('/api/credits/history', verifyToken, async (req, res) => {
    try {
        const transactions = await getTransactions(req.user.uid);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buy Credits (Create Order)
app.post('/api/credits/buy', verifyToken, async (req, res) => {
    const { amount, credits } = req.body; // amount in INR, credits to add
    try {
        // Create Razorpay order (amount in paise)
        const order = await createOrder(amount * 100, 'INR');
        res.json({ order, credits }); // Pass back credits for client context
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify Credit Purchase
app.post('/api/credits/verify', verifyToken, async (req, res) => {
    const { orderId, paymentId, signature, credits, amount } = req.body;
    
    try {
        const isValid = verifyPayment(orderId, paymentId, signature);
        
        if (isValid) {
            // Add credits to user wallet
            await addCredits(req.user.uid, parseInt(credits), `Purchased ${credits} credits for ₹${amount}`, paymentId);
            res.json({ success: true, message: 'Credits added successfully' });
        } else {
            res.status(400).json({ success: false, error: 'Invalid Signature' });
        }
    } catch (error) {
        console.error('Credit verification failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Unlock Publishing Plan & Deploy to Cloudflare
app.post('/api/project/:id/publish', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { plan, subdomain, years = 1 } = req.body; // 'basic', 'single', 'multi'; years default 1
    
    const COSTS = {
        'basic': 500,
        'single': 2000,
        'multi': 3000
    };
    
    const cost = COSTS[plan];
    if (!cost) {
        return res.status(400).json({ error: 'Invalid plan' });
    }

    const duration = [1, 2, 3].includes(parseInt(years)) ? parseInt(years) : 1;
    let totalCost = cost * duration;

    // Apply Discounts
    if (duration === 2) totalCost *= 0.95; // 5% off
    if (duration === 3) totalCost *= 0.90; // 10% off
    
    totalCost = Math.round(totalCost);
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const distPath = path.join(__dirname, 'projects_source', id, 'dist');
        if (!await fs.pathExists(distPath)) {
            return res.status(404).json({ error: 'Build artifacts (dist folder) not found. Please rebuild the project.' });
        }

        // 1. Check ownership
        const projectRef = db.collection('projects').where('projectId', '==', id).where('userId', '==', req.user.uid);
        const snapshot = await projectRef.get();
        
        if (snapshot.empty) {
            return res.status(403).json({ error: 'Project not found or unauthorized' });
        }
        
        const projectDoc = snapshot.docs[0];
        const projectData = projectDoc.data();

        // 2. Update Subdomain if provided (and different)
        let finalSubdomain = projectData.subdomain;
        if (subdomain) {
            const cleanName = subdomain.toLowerCase();
            if (cleanName !== finalSubdomain) {
                // Check availability
                const availability = await checkSubdomainAvailability(cleanName);
                if (!availability.available) {
                     const existing = await db.collection('projects').where('subdomain', '==', cleanName).get();
                     if (!existing.empty && existing.docs[0].data().projectId !== id) {
                         return res.status(409).json({ error: availability.error });
                     }
                }
                finalSubdomain = cleanName;
                await projectDoc.ref.update({ subdomain: finalSubdomain });
            }
        }
        
        // 3. Deduct Credits
        // Always deduct for renewal or new plan
        // Note: If user is just changing subdomain without renewal, they shouldn't call this with years?
        // Assuming client calls this ONLY for payment/publish actions.
        await deductCredits(req.user.uid, totalCost, `Unlock/Renew ${plan} plan for project ${id} (${duration} years)`);
        
        // 4. Calculate Expiry
        const now = admin.firestore.Timestamp.now();
        let expiryDate;
        let startDate = projectData.subscriptionStartDate || now;

        // Check if currently active
        const currentExpiry = projectData.subscriptionExpiryDate;
        const isCurrentlyActive = currentExpiry && currentExpiry.toMillis() > Date.now() && !projectData.isExpired;

        if (isCurrentlyActive) {
            // Extend
            const currentExpiryDate = currentExpiry.toDate();
            currentExpiryDate.setFullYear(currentExpiryDate.getFullYear() + duration);
            expiryDate = admin.firestore.Timestamp.fromDate(currentExpiryDate);
        } else {
            // New or Reactivation
            const newExpiryDate = new Date();
            newExpiryDate.setFullYear(newExpiryDate.getFullYear() + duration);
            expiryDate = admin.firestore.Timestamp.fromDate(newExpiryDate);
            startDate = now; // Reset start date if expired/new
        }

        // 5. Deploy to GCP (Ensure bucket is public)
        console.log(`Publishing project ${id} to GCP (Subdomain: ${finalSubdomain})...`);
        const deployResult = await deploySite(distPath, id, projectData.netlifySiteId); 
        
        // Ensure bucket is public (in case it was private due to expiry)
        await makeBucketPublic(`site-${id}`);

        // 6. Construct Public URL
        const publicUrl = `https://${finalSubdomain}.genweb.in`;

        // 7. Update Project Status & URL
        await projectDoc.ref.update({
            publishedPlan: plan,
            isPublished: true,
            isExpired: false,
            subscriptionStartDate: startDate,
            subscriptionExpiryDate: expiryDate,
            subscriptionYears: duration, // Store last purchased duration or total? let's store last purchased
            deployUrl: publicUrl, 
            bucketUrl: deployResult.url,
            publishedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ success: true, url: publicUrl, expiry: expiryDate.toDate() });
        
    } catch (error) {
        if (error.message === 'Insufficient credits') {
            return res.status(402).json({ error: 'Insufficient credits' });
        }
        console.error('Publish unlock/deploy failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Domain Management Endpoints ---

// Check Domain Availability
app.get('/api/domains/check', verifyToken, async (req, res) => {
    const { domain } = req.query;
    if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
    }

    try {
        const result = await checkAvailability(domain);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Domain Suggestions
app.get('/api/domains/suggest', verifyToken, async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        const result = await getSuggestions(query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get User's Domains
app.get('/api/domains', verifyToken, async (req, res) => {
    try {
        if (!db) {
            return res.json([]);
        }
        
        const snapshot = await db.collection('domains')
            .where('userId', '==', req.user.uid)
            .orderBy('createdAt', 'desc')
            .get();
            
        const domains = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(domains);
    } catch (error) {
        console.error('Fetch domains failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Purchase Domain
app.post('/api/domains/buy', verifyToken, async (req, res) => {
    const { domain, contactInfo, projectId } = req.body;

    if (!domain || !contactInfo) {
        return res.status(400).json({ error: 'Domain and contactInfo are required' });
    }

    // Capture IP for 'agreedBy' field
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        // Prepare details object
        const details = {
            ip,
            contact: contactInfo // Assuming contactInfo has the required fields (nameFirst, nameLast, etc.)
        };

        const result = await purchaseDomain(domain, details);
        
        let cfStatus = null;
        
        // If projectId is provided, we can auto-setup Cloudflare immediately
        // Otherwise, user will have to "Connect" it later.
        // For now, let's assume we want to setup Cloudflare Zone regardless to get NS.
        // We use a placeholder project ID if none provided, or just init the zone.
        
        try {
            // true = isManagedByUs (Auto update DNS)
            // If no project ID, we might fail linking, but we can still Add DNS if we knew the IP.
            // But setupGCPDomain requires projectId to know the target bucket.
            // If no projectId, we can't fully setup the LB mapping, but we can point the A record if we assume a shared LB.
            
            if (projectId) {
                 cfStatus = await setupGCPDomain(domain, projectId, true);
            }
        } catch (cfError) {
            console.error("Auto-GCP setup failed during purchase:", cfError);
            // Don't fail the purchase response, just log it.
            cfStatus = { status: 'SETUP_FAILED', error: cfError.message };
        }
        
        // Save to Firestore
        if (db) {
            await db.collection('domains').add({
                domain,
                userId: req.user.uid,
                orderId: result.orderId || 'unknown',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                provider: 'namesilo',
                status: 'active',
                autoRenew: true,
                lbStatus: cfStatus,
                ip: cfStatus?.ip || null
            });
        }

        res.json({ success: true, order: result, lbStatus: cfStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Subdomain Management (*.genweb.in) ---

// Check Subdomain Availability
app.get('/api/subdomain/check', verifyToken, async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    try {
        const result = await checkSubdomainAvailability(name.toLowerCase());
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Project Subdomain
app.post('/api/project/:id/subdomain', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { subdomain } = req.body;
    
    if (!subdomain) return res.status(400).json({ error: 'Subdomain is required' });
    
    const cleanName = subdomain.toLowerCase();
    
    try {
        if (!db) return res.status(503).json({ error: 'DB unavailable' });
        
        // 1. Check availability
        const availability = await checkSubdomainAvailability(cleanName);
        
        // If it's taken, check if it's taken by THIS project (idempotent)
        if (!availability.available) {
             const existing = await db.collection('projects').where('subdomain', '==', cleanName).get();
             if (!existing.empty && existing.docs[0].data().projectId === id) {
                 // Same project, do nothing
                 return res.json({ success: true, subdomain: cleanName });
             }
             return res.status(409).json({ error: availability.error });
        }

        // 2. Verify Ownership
        const projectRef = db.collection('projects').where('projectId', '==', id).where('userId', '==', req.user.uid);
        const snapshot = await projectRef.get();
        
        if (snapshot.empty) {
            return res.status(403).json({ error: 'Project not found or unauthorized' });
        }

        // 3. Update
        await snapshot.docs[0].ref.update({
            subdomain: cleanName,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ success: true, subdomain: cleanName });

    } catch (error) {
        console.error('Update subdomain failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Custom Domain Hosting (Caddy Integration) ---



// Verify Domain DNS Setup (GCP LB Check)
app.get('/api/domains/verify-setup', verifyToken, async (req, res) => {
    const { domain } = req.query;

    if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
    }

    try {
        const result = await verifyDomainDNS(domain);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Assign Custom Domain to Project (GCP LB)
app.post('/api/project/:id/domain', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { domain } = req.body; 

    if (!domain) {
        return res.status(400).json({ error: 'Domain is required' });
    }

    const cleanDomain = domain.toLowerCase().trim();

    try {
        if (!db) return res.status(503).json({ error: 'DB unavailable' });

        // 1. Check if domain is taken
        const duplicateCheck = await db.collection('projects')
            .where('customDomain', '==', cleanDomain)
            .get();

        if (!duplicateCheck.empty) {
            if (duplicateCheck.docs[0].data().projectId === id) {
                return res.json({ success: true, message: 'Domain already assigned.' });
            }
            return res.status(409).json({ error: 'Domain already connected to another site.' });
        }

        // 2. Verify Ownership
        const projectRef = db.collection('projects').where('projectId', '==', id).where('userId', '==', req.user.uid);
        const snapshot = await projectRef.get();

        if (snapshot.empty) {
            return res.status(403).json({ error: 'Project not found or unauthorized' });
        }

        const projectDoc = snapshot.docs[0];

        // 3. Setup GCP Domain
        // Check if we manage this domain in our 'domains' collection to set isManagedByUs
        let isManaged = false;
        const domainDoc = await db.collection('domains').where('domain', '==', cleanDomain).where('userId', '==', req.user.uid).get();
        if (!domainDoc.empty && domainDoc.docs[0].data().provider === 'namesilo') {
            isManaged = true;
        }

        const cfResult = await setupGCPDomain(cleanDomain, id, isManaged);

        // 4. Update Project
        await projectDoc.ref.update({
            customDomain: cleanDomain,
            domainUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lbIp: cfResult.ip, // Store the IP
            domainStatus: cfResult.status // 'CONFIGURED' or 'ACTION_REQUIRED'
        });

        res.json({ 
            success: true, 
            domain: cleanDomain,
            ip: cfResult.ip,
            message: cfResult.message,
            managed: isManaged
        });

    } catch (error) {
        console.error('Assign domain failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Cron Jobs ---
// Check for expired sites daily at 1 AM
cron.schedule('0 1 * * *', async () => {
    console.log('[Cron] Checking for expired subscriptions...');
    if (!db) return;

    try {
        const now = admin.firestore.Timestamp.now();
        
        // Query projects that are published and have passed expiry date
        // Note: Projects without subscriptionExpiryDate (legacy) will be ignored by the '<' filter
        const snapshot = await db.collection('projects')
            .where('isPublished', '==', true)
            .where('subscriptionExpiryDate', '<', now)
            .get();

        if (snapshot.empty) {
            console.log('[Cron] No expired subscriptions found.');
            return;
        }

        let expiredCount = 0;

        for (const doc of snapshot.docs) {
            const project = doc.data();
            
            // Skip if already marked expired
            if (project.isExpired === true) continue;

            const projectId = project.projectId;
            console.log(`[Cron] Expiring project ${projectId}...`);
            
            try {
                // 1. Make Bucket Private
                // This will remove public access
                await makeBucketPrivate(`site-${projectId}`);
                
                // 2. Update Firestore
                await doc.ref.update({ 
                    isExpired: true, 
                    expiredAt: now 
                });
                
                expiredCount++;
            } catch (err) {
                console.error(`[Cron] Failed to expire project ${projectId}:`, err);
            }
        }
        
        console.log(`[Cron] Expiry check complete. Expired ${expiredCount} sites.`);

    } catch (error) {
        console.error('[Cron] Expiry check failed:', error);
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
