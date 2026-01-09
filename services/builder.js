const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { generateCode, fixCode } = require('./ai-coder');
const { generateDesign } = require('./ai-architect');
const { fetchImages } = require('./images');

const MAX_RETRIES = 3; // Lower retries for HTML as it's less prone to build errors

async function buildSite(id, userContext, logoFile, pages = ['Home']) {
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
        
        // 2. Setup Temp Dir & Copy Skeleton
        console.log(`[${id}] Copying skeleton...`);
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
        
        // Copy Logo if exists
        if (logoFile) {
            const logoDest = path.join(distDir, 'logo.png');
            await fs.copy(logoFile.path, logoDest);
            designSystem.logoUrl = './logo.png';
            await fs.remove(logoFile.path).catch(console.error);
        }

        // 3. Code Gen Loop
        console.log(`[${id}] Generating HTML for ${pages.length} pages...`);
        
        // Helper to generate a single page
        const generatePage = async (pageName, refLayout = null) => {
             console.log(`[${id}] Generating ${pageName}...`);
            let code = '';
            let genAttempts = 0;
            const MAX_GEN_RETRIES = 3;

            while (genAttempts < MAX_GEN_RETRIES) {
                genAttempts++;
                try {
                    code = await generateCode(designSystem, userContext, pageName, pages, refLayout);
                    
                    // Basic Validation & Cleanup
                    if (code.includes('cdn.tailwindcss.com')) {
                        code = code.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/g, '');
                        code = code.replace(/<script>\s*tailwind\.config\s*=\s*{[\s\S]*?}\s*<\/script>/g, '');
                    }
    
                    if (!code.trim().endsWith('</html>')) {
                        throw new Error("Incomplete HTML generated (Missing </html>)");
                    }
    
                    return code;
                } catch (err) {
                    console.warn(`[${id}] ${pageName} Generation Attempt ${genAttempts} failed: ${err.message}`);
                    if (genAttempts >= MAX_GEN_RETRIES) {
                        throw new Error(`Failed to generate ${pageName} after ${MAX_GEN_RETRIES} attempts.`);
                    }
                }
            }
        };

        // 3.1 Generate Home (Primary Page) First
        const homePage = pages.find(p => p === 'Home') || pages[0];
        const homeCode = await generatePage(homePage);
        
        await fs.writeFile(path.join(distDir, 'index.html'), homeCode);

        // 3.2 Extract Layout Reference (Header/Footer)
        let layoutReference = null;
        try {
            // Regex to match data-section="header" and data-section="footer"
            // We match the opening tag, content, and closing tag roughly.
            // Assumption: AI follows strict nested structure or we grab the outer block.
            // A simple regex might fail on nested tags, but let's try a robust one for known attributes.
            // Alternatively, since we just need the text for the AI prompt, a looser match is okay.
            
            // Match <header ... data-section="header" ...> ... </header>
            // Note: tag name might be 'div' or 'header'.
            const headerMatch = homeCode.match(/<(\w+)[^>]*data-section="header"[^>]*>([\s\S]*?)<\/\1>/);
            const footerMatch = homeCode.match(/<(\w+)[^>]*data-section="footer"[^>]*>([\s\S]*?)<\/\1>/);

            if (headerMatch && footerMatch) {
                layoutReference = {
                    header: headerMatch[0],
                    footer: footerMatch[0]
                };
                console.log(`[${id}] Extracted Header/Footer reference.`);
            } else {
                console.warn(`[${id}] Could not extract Header/Footer from Home page.`);
            }
        } catch (e) {
            console.error(`[${id}] Error extracting layout reference:`, e);
        }

        // 3.3 Generate Remaining Pages
        const remainingPages = pages.filter(p => p !== homePage);
        for (const pageName of remainingPages) {
            const pageCode = await generatePage(pageName, layoutReference);
            const filename = `${pageName.toLowerCase().replace(/\s+/g, '-')}.html`;
            await fs.writeFile(path.join(distDir, filename), pageCode);
        }

        // 4. Build Loop (Tailwind & Config Injection)
        let attempts = 0;
        
        while (attempts < MAX_RETRIES && !success) {
            attempts++;
            console.log(`[${id}] Build Attempt ${attempts}...`);
            
            // 3.5. Dynamic Config & Injection (Must happen after html files are written)
            await setupConfig(tempDir, distDir, designSystem, id);
            
            // Try build (Tailwind CLI)
            try {
                await runBuild(tempDir);
                success = true;
            } catch (error) {
                console.error(`[${id}] Build Failed:`, error.message);
                if (attempts < MAX_RETRIES) {
                    // Logic to fix code is complex with multiple files. 
                    // For now, we just retry build or log error. 
                    // Ideally, we'd identify WHICH file caused the error.
                    // But Tailwind CSS errors are usually about the config or input.css, not HTML.
                    console.warn(`[${id}] Retrying build...`);
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

async function setupConfig(rootDir, distDir, designSystem, id) {
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

    // 3. Update ALL HTML files
    const files = await fs.readdir(distDir);
    const htmlFiles = files.filter(f => f.endsWith('.html'));

    for (const file of htmlFiles) {
        const filePath = path.join(distDir, file);
        let html = await fs.readFile(filePath, 'utf-8');
        
        // Inject Fonts
        if (fontLink && !html.includes(fontLink)) {
            html = html.replace('</head>', `${fontLink}\n</head>`);
        }
        
        // Inject CSS Link (Crucial)
        if (!html.includes('href="./style.css"') && !html.includes("href='./style.css'")) {
             html = html.replace('</head>', `<link href="./style.css" rel="stylesheet">
</head>`);
        }
    
        // Inject AOS CSS (Animation Library)
        if (!html.includes('aos.css')) {
            html = html.replace('</head>', `<link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">\n</head>`);
        }
        
        // Update Title (Append Page Name if not index)
        const pageTitle = file === 'index.html' ? safeTitle : `${safeTitle} - ${file.replace('.html', '').replace(/-/g, ' ')}`;
        if (html.includes('<title>')) {
            html = html.replace(/<title>.*?<\/title>/, `<title>${pageTitle}</title>`);
        } else {
            html = html.replace('</head>', `<title>${pageTitle}</title>\n</head>`);
        }
    
        // Inject Favicon
        if (faviconLink) {
            if (html.includes('<link rel="icon"')) {
                html = html.replace(/<link rel="icon".*?>/, faviconLink);
            } else {
                html = html.replace('</head>', `${faviconLink}\n</head>`);
            }
        }
    
        // Inject Lead Submission Script AND AOS Init
        // Note: For multi-page, relative path to assets might differ if we had subfolders, 
        // but here everything is flat in dist/ so it's fine.
        const script = `
        <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
        <script>
        // Initialize Animations
        AOS.init({
            duration: 800,
            once: true,
            offset: 100
        });
    
        async function handleLeadSubmit(event) {
            event.preventDefault();
            const form = event.target;
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Find submit button to show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerText : 'Submit';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = 'Sending...';
            }
    
            try {
                const response = await fetch('/api/submit-lead', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        projectId: '${id}',
                        formData: data
                    })
                });
                
                if (response.ok) {
                    alert('Thank you! Your message has been sent.');
                    form.reset();
                } else {
                    alert('Something went wrong. Please try again.');
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                alert('Error submitting form. Please check your connection.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalText;
                }
            }
        }
        </script>
        `;
        
        if (html.includes('</body>')) {
            html = html.replace('</body>', `${script}\n</body>`);
        } else {
            html += script;
        }
    
        await fs.writeFile(filePath, html);
    }

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