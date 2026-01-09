require('dotenv').config();
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { buildSite, rebuildSite } = require('./services/builder');
const { deploySite } = require('./services/deploy');
const { extractFromUrl } = require('./services/business-extractor');
const { generateCode, fixCode, regenerateSection, updateSectionContent } = require('./services/ai-coder');
const { generateDesign, generatePalette } = require('./services/ai-architect');
const { db, admin, auth } = require('./services/firebase');
const verifyToken = require('./middleware/auth');

const app = express();
app.use(express.json());

// Configure Multer for file uploads
const upload = multer({ dest: path.join(__dirname, 'temp/uploads') });

// Serve generated sites statically
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

// Extract Business Info (Pre-build step)
app.post('/extract-info', verifyToken, async (req, res) => {
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
app.get('/project/:id/leads', verifyToken, async (req, res) => {
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
app.get('/projects', verifyToken, async (req, res) => {
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
app.get('/project/:id/theme', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
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
app.post('/project/:id/theme/regenerate', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
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
app.post('/project/:id/section', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { sectionId, instruction } = req.body;
    
    try {
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
        
        // Rebuild
        await rebuildSite(id);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Update failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update Specific Content (Text/Image)
app.post('/project/:id/content', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { sectionId, type, originalValue, newValue } = req.body; // type: 'text' | 'image'
    
    try {
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
        
        // Rebuild
        await rebuildSite(id);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Content update failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Undo Last Change
app.post('/project/:id/undo', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const sourcePath = path.join(__dirname, 'projects_source', id, 'dist/index.html');
        const backupPath = sourcePath + '.bak';
        
        if (!await fs.pathExists(backupPath)) {
            return res.status(400).json({ error: 'No undo available' });
        }
        
        // Restore backup
        await fs.copy(backupPath, sourcePath);
        
        console.log(`Undoing changes for project ${id}...`);
        await rebuildSite(id);
        
        res.json({ success: true });
    } catch (error) {
         console.error('Undo failed:', error);
         res.status(500).json({ error: error.message });
    }
});

// Upload Asset
app.post('/project/:id/upload', verifyToken, upload.single('file'), async (req, res) => {
    const { id } = req.params;
    const file = req.file;
    
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
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
app.post('/project/:id/theme', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { colors } = req.body; // Expect { primary: '#...', secondary: '#...', ... }
    
    try {
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
        await rebuildSite(id);
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Theme update failed:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/build', verifyToken, upload.single('logo'), async (req, res) => {
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

        console.log(`Starting build for ${id} (Pages: ${parsedPages.join(', ')})...`);
        const distPath = await buildSite(id, userContext, logoFile, parsedPages);
        
        console.log(`Build success! Deploying...`);
        
        // 1. Move the entire project (source + dist) to projects_source
        const sourcePath = path.join(__dirname, 'projects_source', id);
        const tempPath = path.join(__dirname, 'temp', id);
        
        // We must remove the symlinked node_modules before moving/copying to avoid issues?
        // Actually, moving a folder with symlinks works fine on same filesystem. 
        // But if we want to archive it, we might want to unlink node_modules first to save space/time, 
        // then re-symlink or just rely on the symlink being relative/absolute.
        // builder.js created an absolute symlink. So moving the folder keeps the link valid.
        
        await fs.move(tempPath, sourcePath);
        console.log(`Source code saved to ${sourcePath}`);

        // 2. Copy the 'dist' folder to 'public/sites' for hosting
        const localSitePath = path.join(__dirname, 'public/sites', id);
        await fs.copy(path.join(sourcePath, 'dist'), localSitePath);
        
        const localUrl = `http://localhost:${PORT}/sites/${id}/index.html`;
        
        // Save to Firestore
        if (db) {
            await db.collection('projects').add({
                projectId: id,
                userId: req.user.uid,
                query: query || 'Manual Context',
                url: localUrl,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'completed'
            });
        }
        
        res.json({ success: true, url: localUrl, id });
        
    } catch (error) {
        console.error('Process failed:', error);
        res.status(500).json({ error: error.message, details: error.stderr });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
