require('dotenv').config();
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const { buildSite, rebuildSite } = require('./services/builder');
const { deploySite } = require('./services/deploy');
const { extractFromUrl } = require('./services/business-extractor');
const { generateCode, fixCode, regenerateSection, updateSectionContent } = require('./services/ai-coder');
const { generateDesign, generatePalette } = require('./services/ai-architect');
const { db, admin } = require('./services/firebase');
const verifyToken = require('./middleware/auth');

const app = express();
app.use(express.json());

// Configure Multer for file uploads
const upload = multer({ dest: path.join(__dirname, 'temp/uploads') });

// Serve generated sites statically
app.use('/sites', express.static(path.join(__dirname, 'public/sites')));

const PORT = process.env.PORT || 3000;

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
        const sourcePath = path.join(__dirname, 'projects_source', id, 'src/App.jsx');
        
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
        const sourcePath = path.join(__dirname, 'projects_source', id, 'src/App.jsx');
        
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
        const sourcePath = path.join(__dirname, 'projects_source', id, 'src/App.jsx');
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
        // Target: projects_source/<id>/public/assets/
        const assetsDir = path.join(__dirname, 'projects_source', id, 'public/assets');
        await fs.ensureDir(assetsDir);
        
        const ext = path.extname(file.originalname);
        const filename = `${Date.now()}${ext}`;
        const destPath = path.join(assetsDir, filename);
        
        // Move from temp upload to assets
        await fs.move(file.path, destPath);
        
        // Cleanup
        // await fs.remove(file.path); // fs.move already removes source
        
        // Return URL relative to site root
        // When built, 'public/assets' becomes 'dist/assets'. 
        // Vite copies 'public/*' to root of dist. So 'public/assets/img.png' -> 'dist/assets/img.png'
        // Access via '/assets/img.png'
        res.json({ url: `/assets/${filename}` });
        
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
    let { userContext, businessUrl, businessQuery } = req.body;
    const logoFile = req.file; // Get the uploaded logo file

    const id = Date.now().toString();
    
    // Allow businessUrl or businessQuery to drive the extraction
    const query = businessQuery || businessUrl;

    try {
        if (query) {
            console.log(`Extracting info for query: "${query}"...`);
            userContext = await extractFromUrl(query);
            console.log('Extracted Context:', userContext);
        }

        if (!userContext) {
            return res.status(400).json({ error: 'userContext or businessQuery is required' });
        }

        console.log(`Starting build for ${id}...`);
        const distPath = await buildSite(id, userContext, logoFile);
        
        console.log(`Build success! Deploying...`);
        // deploySite currently returns a mock URL.
        // We will enable local preview by moving the build to public/sites
        const localSitePath = path.join(__dirname, 'public/sites', id);
        await fs.move(distPath, localSitePath);
        
        const localUrl = `http://localhost:${PORT}/sites/${id}/index.html`;
        
        // Optional: Still call deploySite if you want to keep that logic, 
        // but for now we focus on the local preview.
        // const url = await deploySite(distPath); 
        
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
        
        // Persist source code for editing
        const sourcePath = path.join(__dirname, 'projects_source', id);
        await fs.move(path.join(__dirname, 'temp', id), sourcePath);
        console.log(`Source code saved to ${sourcePath}`);
        
        res.json({ success: true, url: localUrl, id });
        
    } catch (error) {
        console.error('Process failed:', error);
        res.status(500).json({ error: error.message, details: error.stderr });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
