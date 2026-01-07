const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { generateCode, fixCode } = require('./ai-coder');
const { generateDesign } = require('./ai-architect');
const { fetchImages } = require('./images');

const MAX_RETRIES = 3; // Lower retries for HTML as it's less prone to build errors

async function buildSite(id, userContext, logoFile) {
    const tempDir = path.join(__dirname, '../temp', id);
    const distDir = path.join(tempDir, 'dist');
    const skeletonDir = path.join(__dirname, '../templates/html-skeleton');
    
    let success = false;

    try {
        // Prepare logo data if uploaded
        let logoBuffer = null;
        let logoMimeType = null;
        if (logoFile) {
            logoBuffer = await fs.readFile(logoFile.path);
            logoMimeType = logoFile.mimetype;
        }

        // 1. Design Phase
        console.log(`[${id}] Generating Design...`);
        const designSystem = await generateDesign(userContext, logoBuffer, logoMimeType);

        // 1.5 Fetch Images (Unsplash)
        console.log(`[${id}] Fetching Images...`);
        const keywords = designSystem.imageKeywords || ['business', 'minimal'];
        designSystem.imageUrls = await fetchImages(keywords, 12);
        
                // 2. Code Gen Phase
                console.log(`[${id}] Generating HTML...`);
                if (logoFile) {
                    designSystem.logoUrl = './logo.png';
                }
        
                let code = '';
                let genAttempts = 0;
                const MAX_GEN_RETRIES = 3;
        
                while (genAttempts < MAX_GEN_RETRIES) {
                    genAttempts++;
                    try {
                        code = await generateCode(designSystem, userContext);
                        
                        // Basic Validation & Cleanup
                        if (code.includes('cdn.tailwindcss.com')) {
                            console.warn(`[${id}] Removing accidental Tailwind CDN script...`);
                            code = code.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/g, '');
                            code = code.replace(/<script>\s*tailwind\.config\s*=\s*{[\s\S]*?}\s*<\/script>/g, '');
                        }
        
                        if (!code.trim().endsWith('</html>')) {
                            throw new Error("Incomplete HTML generated (Missing </html>)");
                        }
        
                        // If we get here, code is valid
                        break; 
                    } catch (err) {
                        console.warn(`[${id}] Generation Attempt ${genAttempts} failed: ${err.message}`);
                        if (genAttempts >= MAX_GEN_RETRIES) {
                            throw new Error(`Failed to generate valid HTML after ${MAX_GEN_RETRIES} attempts.`);
                        }
                    }
                }
                
                // 3. Setup Temp Dir        console.log(`[${id}] Copying skeleton...`);
        // Copy everything EXCEPT node_modules
        await fs.copy(skeletonDir, tempDir, {
            filter: (src) => !src.includes('node_modules')
        });
        
        // Symlink node_modules to save time/space
        await fs.ensureSymlink(
            path.join(skeletonDir, 'node_modules'),
            path.join(tempDir, 'node_modules')
        );

        await fs.ensureDir(distDir); // Ensure dist exists
        
        // 3.1 Copy Logo if exists
        if (logoFile) {
            const logoDest = path.join(distDir, 'logo.png');
            await fs.copy(logoFile.path, logoDest);
            await fs.remove(logoFile.path).catch(console.error);
        }
        
        // 4. Build Loop
        let attempts = 0;
        
        while (attempts < MAX_RETRIES && !success) {
            attempts++;
            console.log(`[${id}] Build Attempt ${attempts}...`);
            
            // Write index.html to dist/
            await fs.writeFile(path.join(distDir, 'index.html'), code);
            
            // 3.5. Dynamic Config & Injection (Must happen after index.html is written)
            await setupConfig(tempDir, distDir, designSystem);
            
            // Try build (Tailwind CLI)
            try {
                await runBuild(tempDir);
                success = true;
            } catch (error) {
                console.error(`[${id}] Build Failed:`, error.message);
                if (attempts < MAX_RETRIES) {
                    console.log(`[${id}] Fixing Code...`);
                    code = await fixCode(code, error.stderr);
                } else {
                    throw new Error(`Build failed after ${MAX_RETRIES} attempts.`);
                }
            }
        }
        
        return distDir;
        
    } catch (err) {
        await fs.remove(tempDir);
        throw err;
    }
}

async function setupConfig(rootDir, distDir, designSystem) {
    const { googleFonts, colorPalette, businessName, logoUrl } = designSystem;

    // 1. Construct Google Fonts URL
    let fontLink = '';
    if (googleFonts) {
        const heading = googleFonts.heading.replace(/\s+/g, '+');
        const body = googleFonts.body.replace(/\s+/g, '+');
        const fontUrl = `https://fonts.googleapis.com/css2?family=${heading}:wght@400;700&family=${body}:wght@300;400;600&display=swap`;
        fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fontUrl}" rel="stylesheet">`;
    }

    // 2. Prepare Title and Favicon
    const safeTitle = businessName || 'Business Site';
    let faviconLink = '';
    if (logoUrl) {
        faviconLink = `<link rel="icon" type="image/png" href="${logoUrl}" />`;
    }

    // 3. Update index.html
    const indexHtmlPath = path.join(distDir, 'index.html');
    let html = await fs.readFile(indexHtmlPath, 'utf-8');
    
    // Inject Fonts
    if (fontLink && !html.includes(fontLink)) {
        html = html.replace('</head>', `${fontLink}\n</head>`);
    }
    
    // Inject CSS Link (Crucial)
    if (!html.includes('href="./style.css"') && !html.includes("href='./style.css'")) {
         html = html.replace('</head>', `<link href="./style.css" rel="stylesheet">
</head>`);
    }
    
    // Update Title
    if (html.includes('<title>')) {
        html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle}</title>`);
    } else {
        html = html.replace('</head>', `<title>${safeTitle}</title>\n</head>`);
    }

    // Inject Favicon
    if (faviconLink) {
        if (html.includes('<link rel="icon"')) {
            html = html.replace(/<link rel="icon".*?>/, faviconLink);
        } else {
            html = html.replace('</head>', `${faviconLink}\n</head>`);
        }
    }

    await fs.writeFile(indexHtmlPath, html);

    // 4. Update tailwind.config.js
    const configPath = path.join(rootDir, 'tailwind.config.js');
    const newConfig = `
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dist/*.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"${googleFonts ? googleFonts.heading : 'sans-serif'}"','sans-serif'],
        body: ['"${googleFonts ? googleFonts.body : 'sans-serif'}"','sans-serif'],
      },
      colors: {
        primary: "${colorPalette.primary}",
        secondary: "${colorPalette.secondary}",
        accent: "${colorPalette.accent}",
        background: "${colorPalette.background}",
        text: "${colorPalette.text}",
        buttonBackground: "${colorPalette.buttonBackground}",
        buttonText: "${colorPalette.buttonText}",
      }
    },
  },
  plugins: [],
}
    `;
    await fs.writeFile(configPath, newConfig);
}

async function rebuildSite(id) {
    const sourceDir = path.join(__dirname, '../projects_source', id);
    const publicSiteDir = path.join(__dirname, '../public/sites', id);

    if (!await fs.pathExists(sourceDir)) {
        throw new Error(`Project source not found: ${id}`);
    }

    console.log(`[${id}] Re-building site (Tailwind)...`);
    
    try {
        await runBuild(sourceDir);
        
        // Move dist contents to public (Actually, dist IS the content now, but we need to ensure structure)
        // sourceDir contains 'dist'.
        const distPath = path.join(sourceDir, 'dist');
        await fs.emptyDir(publicSiteDir);
        await fs.copy(distPath, publicSiteDir);
        
        return true;
    } catch (error) {
        console.error(`[${id}] Rebuild failed:`, error);
        throw error;
    }
}

function runBuild(dir) {
    return new Promise((resolve, reject) => {
        // Run Tailwind CLI
        // Input: src/input.css (relative to dir)
        // Output: dist/style.css (relative to dir)
        // Use local binary directly to avoid npx path issues with symlinks
        const command = './node_modules/.bin/tailwindcss -i src/input.css -o dist/style.css --minify';
        
        exec(command, { cwd: dir }, (error, stdout, stderr) => {
            if (error) {
                const output = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
                reject({ message: error.message, stderr: output }); 
            } else {
                resolve();
            }
        });
    });
}

module.exports = { buildSite, rebuildSite };