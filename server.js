require('dotenv').config();
console.log("Starting Server...");
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { buildSite, rebuildSite } = require('./services/builder');
const { deploySite } = require('./services/deploy');
const { uploadDirectory, downloadDirectory } = require('./services/storage');
const { createOrder, verifyPayment } = require('./services/payments');
const { extractFromUrl } = require('./services/business-extractor');
const { checkAvailability, purchaseDomain, getSuggestions } = require('./services/domains');
const { generateCode, fixCode, regenerateSection, updateSectionContent } = require('./services/ai-coder');
const { generateDesign, generatePalette } = require('./services/ai-architect');
const { getUserCredits, addCredits, deductCredits } = require('./services/credits');
const { db, admin, auth } = require('./services/firebase');
const verifyToken = require('./middleware/auth');

const cookieParser = require('cookie-parser'); // Import cookie-parser
const cors = require('cors'); // Import cors

const app = express();
app.use(cors({ origin: true, credentials: true })); // Enable CORS for all origins with credentials
app.use(express.json());
app.use(cookieParser()); // Use cookie-parser

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

// Helper: Post-Build Action (Upload & Deploy)
async function handlePostBuild(id, distPath, userId) {
    try {
        console.log(`[${id}] Post-build: Uploading and Deploying...`);
        
        // 1. Upload Source/Dist to GCS
        // Upload the parent folder (project root) or just dist? 
        // Let's upload the whole project source for backup.
        const sourcePath = path.join(__dirname, 'projects_source', id);
        await uploadDirectory(sourcePath, `projects/${id}`);
        
        // 2. Deploy to Hosting (GCS)
        // We need to fetch existing ID if any from DB (kept for legacy Netlify compat, ignored by GCS deploy)
        let existingSiteId = null;
        if (db) {
            const doc = await db.collection('projects').where('projectId', '==', id).limit(1).get();
            if (!doc.empty) {
                existingSiteId = doc.docs[0].data().netlifySiteId;
            }
        }
        
        const deployResult = await deploySite(distPath, id, existingSiteId);
        
        // 3. Update DB
        if (db) {
            const updateData = {
                deployUrl: deployResult.url,
                netlifySiteId: deployResult.siteId, // In GCS mode, this is just the projectId
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            // Find doc by projectId (since ID is custom string, not firestore auto-id)
            const snapshot = await db.collection('projects').where('projectId', '==', id).get();
            if (!snapshot.empty) {
                await snapshot.docs[0].ref.update(updateData);
            }
        }
        
        return deployResult.url;
    } catch (error) {
        console.error(`[${id}] Post-build failed:`, error);
        // Don't throw, just log. We still have the local build.
        return null;
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
    const { sectionId, instruction } = req.body;
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        // --- Credit Deduction ---
        try {
            await deductCredits(req.user.uid, 50, `Redesign section ${sectionId} for project ${id}`);
        } catch (err) {
            return res.status(402).json({ error: 'Insufficient credits for AI redesign.' });
        }
        // ------------------------

        const sourcePath = path.join(__dirname, 'projects_source', id, 'dist/index.html');
        
        if (!await fs.pathExists(sourcePath)) {
            return res.status(404).json({ error: 'Project source not found' });
        }
        
        const currentCode = await fs.readFile(sourcePath, 'utf-8');
        
        console.log(`Regenerating section '${sectionId}' for project ${id}...`);
        const newCode = await regenerateSection(currentCode, sectionId, instruction);
        
        // Backup old code (simple undo)
        await fs.writeFile(sourcePath + '.bak', currentCode);
        
        // Write new code
        await fs.writeFile(sourcePath, newCode);
        
        // Rebuild & Deploy
        const distPath = await rebuildSite(id);
        const deployUrl = await handlePostBuild(id, distPath, req.user.uid);
        
        res.json({ success: true, url: deployUrl });
        
    } catch (error) {
        console.error('Update failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update Specific Content (Text/Image)
app.post('/api/project/:id/content', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { sectionId, type, originalValue, newValue } = req.body; // type: 'text' | 'image'
    
    try {
        if (!await ensureProjectSource(id)) return res.status(404).json({ error: 'Project source not found' });

        const sourcePath = path.join(__dirname, 'projects_source', id, 'dist/index.html');
        
        if (!await fs.pathExists(sourcePath)) {
            return res.status(404).json({ error: 'Project source not found' });
        }
        
        const currentCode = await fs.readFile(sourcePath, 'utf-8');
        
        console.log(`Updating ${type} in section '${sectionId}' for project ${id}...`);
        const newCode = await updateSectionContent(currentCode, sectionId, type, originalValue, newValue);
        
        // Backup
        await fs.writeFile(sourcePath + '.bak', currentCode);
        
        // Write
        await fs.writeFile(sourcePath, newCode);
        
        // Rebuild & Deploy
        const distPath = await rebuildSite(id);
        const deployUrl = await handlePostBuild(id, distPath, req.user.uid);
        
        res.json({ success: true, url: deployUrl });
        
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
        const distPath = await rebuildSite(id);
        const deployUrl = await handlePostBuild(id, distPath, req.user.uid);
        
        res.json({ success: true, url: deployUrl });
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
        const distPath = await rebuildSite(id);
        const deployUrl = await handlePostBuild(id, distPath, req.user.uid);
        
        res.json({ success: true, url: deployUrl });
        
    } catch (error) {
        console.error('Theme update failed:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/build', verifyToken, upload.single('logo'), async (req, res) => {
    let { userContext, businessUrl, businessQuery, pages } = req.body;
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

        // --- Credit Deduction ---
        const cost = parsedPages.length > 1 ? 400 : 200;
        try {
            await deductCredits(req.user.uid, cost, `Generate ${parsedPages.length > 1 ? 'Multi-Page' : 'Single-Page'} Site`);
        } catch (err) {
            return res.status(402).json({ error: 'Insufficient credits. Please top up your wallet.' });
        }
        // ------------------------

        console.log(`Starting build for ${id} (Pages: ${parsedPages.join(', ')})...`);
        const distPath = await buildSite(id, userContext, logoFile, parsedPages);
        
        console.log(`Build success! Saving & Deploying...`);
        
        // 1. Move the entire project (source + dist) to projects_source
        const sourcePath = path.join(__dirname, 'projects_source', id);
        const tempPath = path.join(__dirname, 'temp', id);
        
        await fs.move(tempPath, sourcePath);
        console.log(`Source code saved to ${sourcePath}`);

        // 2. Copy the 'dist' folder to 'public/sites' for hosting (Legacy fallback)
        const localSitePath = path.join(__dirname, 'public/sites', id);
        await fs.copy(path.join(sourcePath, 'dist'), localSitePath);
        
        const localUrl = `http://localhost:${PORT}/sites/${id}/index.html`;

        // 3. Post-Build: Deploy to GCS Hosting
        const deployUrl = await handlePostBuild(id, path.join(sourcePath, 'dist'), req.user.uid);
        
        // Save to Firestore
        if (db) {
            await db.collection('projects').add({
                projectId: id,
                userId: req.user.uid,
                query: query || 'Manual Context',
                url: deployUrl || localUrl,
                localUrl: localUrl,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'completed'
            });
        }
        
        res.json({ success: true, url: deployUrl || localUrl, id });
        
    } catch (error) {
        console.error('Process failed:', error);
        res.status(500).json({ error: error.message, details: error.stderr });
    }
});

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

// Unlock Publishing Plan
app.post('/api/project/:id/publish', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { plan } = req.body; // 'basic' (500), 'single' (2000), 'multi' (3000)
    
    const COSTS = {
        'basic': 500,
        'single': 2000,
        'multi': 3000
    };
    
    const cost = COSTS[plan];
    if (!cost) {
        return res.status(400).json({ error: 'Invalid plan' });
    }
    
    try {
        // 1. Check ownership
        const projectRef = db.collection('projects').where('projectId', '==', id).where('userId', '==', req.user.uid);
        const snapshot = await projectRef.get();
        
        if (snapshot.empty) {
            return res.status(403).json({ error: 'Project not found or unauthorized' });
        }
        
        const projectDoc = snapshot.docs[0];
        const projectData = projectDoc.data();
        
        // 2. Check if already unlocked for this plan or higher? 
        // For now, simple additive or just check if "published" flag is set.
        // Let's assume user pays per publish/unlock type.
        
        // 3. Deduct Credits
        await deductCredits(req.user.uid, cost, `Unlock ${plan} plan for project ${id}`);
        
        // 4. Update Project Status
        await projectDoc.ref.update({
            publishedPlan: plan,
            isPublished: true,
            publishedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({ success: true });
        
    } catch (error) {
        if (error.message === 'Insufficient credits') {
            return res.status(402).json({ error: 'Insufficient credits' });
        }
        console.error('Publish unlock failed:', error);
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
    const { domain, contactInfo } = req.body;

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
        
        // Save to Firestore
        if (db) {
            await db.collection('domains').add({
                domain,
                userId: req.user.uid,
                orderId: result.orderId || 'unknown', // GoDaddy might return purchaseId or similar
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                provider: 'namesilo',
                status: 'active',
                autoRenew: true
            });
        }

        res.json({ success: true, order: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
