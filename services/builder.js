const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { generateCode, fixCode } = require('./ai-coder');
const { generateDesign } = require('./ai-architect');
const { fetchImages } = require('./images');

const MAX_RETRIES = 10;

async function buildSite(id, userContext) {
    const tempDir = path.join(__dirname, '../temp', id);
    const skeletonDir = path.join(__dirname, '../templates/skeleton-project');
    
    // Flag to track if we should clean up on error. 
    // If we succeed, we return the path and let the caller handle cleanup after deployment.
    let success = false;

    try {
        // 1. Design Phase
        console.log(`[${id}] Generating Design...`);
        const designSystem = await generateDesign(userContext);

        // 1.5 Fetch Images (Unsplash)
        console.log(`[${id}] Fetching Images...`);
        const keywords = designSystem.imageKeywords || ['business', 'minimal'];
        designSystem.imageUrls = await fetchImages(keywords, 12); // Fetch 12 images
        
        // 2. Code Gen Phase
        console.log(`[${id}] Generating Code...`);
        let code = await generateCode(designSystem, userContext);
        
        // 3. Setup Temp Dir
        console.log(`[${id}] Copying skeleton...`);
        await fs.copy(skeletonDir, tempDir);
        
        // 3.5. Dynamic Skeleton Configuration (Fonts & Config)
        await setupConfig(tempDir, designSystem);

        // 4. Build Loop
        let attempts = 0;
        
        while (attempts < MAX_RETRIES && !success) {
            attempts++;
            console.log(`[${id}] Build Attempt ${attempts}...`);
            
            // Write App.jsx
            await fs.writeFile(path.join(tempDir, 'src/App.jsx'), code);
            
            // Try build
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
        
        return path.join(tempDir, 'dist');
        
    } catch (err) {
        // Cleanup on failure
        await fs.remove(tempDir);
        throw err;
    }
}

async function setupConfig(dir, designSystem) {
    const { googleFonts, colorPalette } = designSystem;

    // 1. Construct Google Fonts URL (if exists)
    if (googleFonts) {
        const heading = googleFonts.heading.replace(/\s+/g, '+');
        const body = googleFonts.body.replace(/\s+/g, '+');
        const fontUrl = `https://fonts.googleapis.com/css2?family=${heading}:wght@400;700&family=${body}:wght@300;400;600&display=swap`;
        
        // Inject into index.html
        const indexHtmlPath = path.join(dir, 'index.html');
        let html = await fs.readFile(indexHtmlPath, 'utf-8');
        const linkTag = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="${fontUrl}" rel="stylesheet">`;
        html = html.replace('</head>', `${linkTag}\n</head>`);
        await fs.writeFile(indexHtmlPath, html);
    }

    // 2. Update tailwind.config.js
    const configPath = path.join(dir, 'tailwind.config.js');
    const newConfig = `
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"${googleFonts ? googleFonts.heading : 'sans-serif'}"', 'sans-serif'],
        body: ['"${googleFonts ? googleFonts.body : 'sans-serif'}"', 'sans-serif'],
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

function runBuild(dir) {
    return new Promise((resolve, reject) => {
        exec('npm run build', { cwd: dir }, (error, stdout, stderr) => {
            if (error) {
                // Combine stdout and stderr for context, as sometimes error details are in stdout
                const output = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
                reject({ message: error.message, stderr: output }); 
            } else {
                resolve();
            }
        });
    });
}

module.exports = { buildSite };
