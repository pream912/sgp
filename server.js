require('dotenv').config();
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { buildSite } = require('./services/builder');
const { deploySite } = require('./services/deploy');

const app = express();
app.use(express.json());
// Serve generated sites statically
app.use('/sites', express.static(path.join(__dirname, 'public/sites')));

const PORT = process.env.PORT || 3000;

app.post('/build', async (req, res) => {
    const { userContext } = req.body;
    const id = Date.now().toString();
    
    if (!userContext) {
        return res.status(400).json({ error: 'userContext is required' });
    }
    
    try {
        console.log(`Starting build for ${id}...`);
        const distPath = await buildSite(id, userContext);
        
        console.log(`Build success! Deploying...`);
        // deploySite currently returns a mock URL.
        // We will enable local preview by moving the build to public/sites
        const localSitePath = path.join(__dirname, 'public/sites', id);
        await fs.move(distPath, localSitePath);
        
        const localUrl = `http://localhost:${PORT}/sites/${id}/index.html`;
        
        // Optional: Still call deploySite if you want to keep that logic, 
        // but for now we focus on the local preview.
        // const url = await deploySite(distPath); 
        
        // Cleanup the rest of the temp folder (dist is already moved)
        await fs.remove(path.join(__dirname, 'temp', id)); 
        
        res.json({ success: true, url: localUrl, id });
        
    } catch (error) {
        console.error('Process failed:', error);
        res.status(500).json({ error: error.message, details: error.stderr });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
