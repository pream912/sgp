const fs = require('fs-extra');
const path = require('path');
const { generateCode, fixCode } = require('./ai-coder');
const { generateDesign } = require('./ai-architect');
const { fetchImages } = require('./images');
const { captureScreenshot } = require('./screenshot');

// Replaced buildSite with CDN-based logic
async function buildSite(id, userContext, logoFile, pages = ['Home'], onProgress = () => {}, stylePreset = null) {
    const tempDir = path.join(__dirname, '../temp', id);
    const distDir = path.join(tempDir, 'dist');
    const skeletonDir = path.join(__dirname, '../templates/html-skeleton');
    const tokenUsageLog = [];

    try {
        // Prepare logo data if uploaded
        let logoBuffer = null;
        let logoMimeType = null;
        if (logoFile) {
            logoBuffer = await fs.readFile(logoFile.path);
            logoMimeType = logoFile.mimetype;
        }

        // 1. Design Phase
        const msgDesign = `[${id}] Generating Design...`;
        console.log(msgDesign);
        onProgress(msgDesign);
        
        let designSystem;
        let designAttempts = 0;
        const MAX_DESIGN_RETRIES = 5;

        while (designAttempts < MAX_DESIGN_RETRIES) {
            designAttempts++;
            try {
                const designResult = await generateDesign(userContext, logoBuffer, logoMimeType);
                designSystem = designResult.design;
                if (designResult.usage) tokenUsageLog.push({ service: 'architect', action: 'generateDesign', ...designResult.usage });
                break; // Success
            } catch (err) {
                const is429 = err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'));
                console.warn(`[${id}] Design Generation Attempt ${designAttempts} failed: ${err.message}`);
                if (designAttempts >= MAX_DESIGN_RETRIES) {
                    if (is429) throw new Error('RATE_LIMITED');
                    throw new Error(`Failed to generate Design after ${MAX_DESIGN_RETRIES} attempts. Last error: ${err.message}`);
                }
                const baseDelay = is429 ? 10000 : 2000;
                const delay = baseDelay * Math.pow(2, designAttempts - 1) + Math.random() * 2000;
                console.log(`[${id}] ${is429 ? 'Rate limited. ' : ''}Waiting ${Math.round(delay)}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // 1.5 Fetch Images (Unsplash)
        const msgImages = `[${id}] Fetching Images...`;
        console.log(msgImages);
        onProgress(msgImages);
        const keywords = designSystem.imageKeywords || ['business', 'minimal'];
        designSystem.imageUrls = await fetchImages(keywords, 12);
        
        // 2. Setup Temp Dir & Copy Skeleton
        const msgSkeleton = `[${id}] Copying skeleton...`;
        console.log(msgSkeleton);
        onProgress(msgSkeleton);
        
        // Copy everything but exclude node_modules and src (since we use CDN, we don't need src/input.css)
        // Actually, we just need a clean dist folder. The skeleton might have assets.
        await fs.copy(skeletonDir, tempDir, {
            filter: (src) => {
                 return !src.includes(`${path.sep}node_modules${path.sep}`) && !src.endsWith(`${path.sep}node_modules`);
            }
        });
        
        await fs.ensureDir(distDir);
        
        // Copy Logo if exists
        if (logoFile) {
            const logoDest = path.join(distDir, 'logo.png');
            await fs.copy(logoFile.path, logoDest);
            designSystem.logoUrl = './logo.png';
            await fs.remove(logoFile.path).catch(console.error);
        }

        // 3. Code Gen Loop
        const msgCodeGen = `[${id}] Generating ${pages.length} pages...`;
        console.log(msgCodeGen);
        onProgress(msgCodeGen);
        
        // Helper to generate a single page
        const generatePage = async (pageName, refLayout = null) => {
             const msgPage = `[${id}] Generating ${pageName}...`;
             console.log(msgPage);
             onProgress(msgPage);
            let code = '';
            let genAttempts = 0;
            const MAX_GEN_RETRIES = 7;

            while (genAttempts < MAX_GEN_RETRIES) {
                genAttempts++;
                try {
                    const codeResult = await generateCode(designSystem, userContext, pageName, pages, refLayout, stylePreset);
                    code = codeResult.code;
                    if (codeResult.usage) tokenUsageLog.push({ service: 'coder', action: `generateCode:${pageName}`, ...codeResult.usage });

                    // Basic Validation
                    if (!code.trim().endsWith('</html>')) {
                        throw new Error("Incomplete HTML generated (Missing </html>)");
                    }

                    return code;
                } catch (err) {
                    const is429 = err.message && (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED'));
                    console.warn(`[${id}] ${pageName} Generation Attempt ${genAttempts} failed: ${err.message}`);

                    if (genAttempts >= MAX_GEN_RETRIES) {
                        if (is429) {
                            throw new Error('RATE_LIMITED');
                        }
                        throw new Error(`Failed to generate ${pageName} after ${MAX_GEN_RETRIES} attempts. Last error: ${err.message}`);
                    }

                    // Longer backoff for rate limits
                    const baseDelay = is429 ? 10000 : 2000;
                    const backoff = baseDelay * Math.pow(2, genAttempts - 1);
                    const jitter = Math.random() * 2000;
                    const delay = backoff + jitter;
                    console.log(`[${id}] ${is429 ? 'Rate limited. ' : ''}Waiting ${Math.round(delay)}ms before retry...`);
                    onProgress(`[${id}] Waiting to retry ${pageName}...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
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
        
        if (remainingPages.length > 0) {
            console.log(`[${id}] Generating ${remainingPages.length} remaining pages sequentially...`);
            onProgress(`[${id}] Generating remaining pages (${remainingPages.join(', ')})...`);
            
            for (const pageName of remainingPages) {
                try {
                    const pageCode = await generatePage(pageName, layoutReference);
                    const filename = `${pageName.toLowerCase().replace(/\s+/g, '-')}.html`;
                    await fs.writeFile(path.join(distDir, filename), pageCode);
                } catch (err) {
                     console.error(`[${id}] Failed to generate ${pageName}:`, err);
                     throw err;
                }
            }
        }

        // 3.5 Generate site-config.json & copy site-nav.js
        const siteConfig = {
            businessName: designSystem.businessName || 'Business',
            logo: logoFile ? './logo.png' : null,
            navigation: pages.map(pageName => ({
                name: pageName,
                path: pageName === 'Home' ? 'index.html' : `${pageName.toLowerCase().replace(/\s+/g, '-')}.html`,
                children: []
            }))
        };
        await fs.writeFile(path.join(distDir, 'site-config.json'), JSON.stringify(siteConfig, null, 2));
        await fs.copy(path.join(skeletonDir, 'site-nav.js'), path.join(distDir, 'site-nav.js'));

        // 4. Inject Config & CDN (No Build Step)
        const msgConfig = `[${id}] Injecting configuration...`;
        console.log(msgConfig);
        onProgress(msgConfig);

        await setupConfig(tempDir, distDir, designSystem, id);
        
        // Also save tailwind.config.js for reference/editing (optional but good for consistency)
        // We use the same helper to get the object and write it
        const tailwindConfigObj = getTailwindConfigFromDesign(designSystem);
        const configPath = path.join(tempDir, 'tailwind.config.js');
        await fs.writeFile(configPath, `module.exports = ${JSON.stringify(tailwindConfigObj, null, 2)}`);

        return { distDir, tokenUsageLog };

    } catch (err) {
        await fs.remove(tempDir);
        throw err;
    }
}

// Helper to construct config object
function getTailwindConfigFromDesign(designSystem) {
    if (!designSystem) {
        // Return a minimal default config if no design system is available
        return { theme: { extend: {} }, plugins: [] };
    }
    const { googleFonts, colorPalette } = designSystem;
    return {
      theme: {
        extend: {
          fontFamily: {
            heading: [googleFonts ? googleFonts.heading : 'sans-serif', 'sans-serif'],
            body: [googleFonts ? googleFonts.body : 'sans-serif', 'sans-serif'],
          },
          colors: {
            primary: colorPalette.primary,
            secondary: colorPalette.secondary,
            accent: colorPalette.accent,
            background: colorPalette.background,
            text: colorPalette.text,
            buttonBackground: colorPalette.buttonBackground,
            buttonText: colorPalette.buttonText,
          }
        },
      },
      plugins: [],
    };
}

async function setupConfig(rootDir, distDir, designSystem, id, overrideConfig = null) {
    const { googleFonts, businessName, logoUrl } = designSystem || {};

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

    // 3. Prepare Tailwind Config
    const tailwindConfig = overrideConfig || getTailwindConfigFromDesign(designSystem);

    const tailwindScript = `
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = ${JSON.stringify(tailwindConfig, null, 2)}
    </script>
    `;

    // 4. Update ALL HTML files
    const files = await fs.readdir(distDir);
    const htmlFiles = files.filter(f => f.endsWith('.html'));

    for (const file of htmlFiles) {
        const filePath = path.join(distDir, file);
        let html = await fs.readFile(filePath, 'utf-8');
        
        // Inject Fonts
        if (fontLink && !html.includes(fontLink)) {
            html = html.replace('</head>', `${fontLink}\n</head>`);
        }
        
        // Inject/Update Tailwind CDN & Config
        // Remove old style.css link if present (handle various attribute orders, quotes, whitespace)
        html = html.replace(/<link[^>]*href=["']\.\/style\.css["'][^>]*>\s*/gi, '');

        // Also remove any old versioned CDN tags (e.g., cdn.tailwindcss.com/3.4.1) - we'll inject a fresh one
        html = html.replace(/<script[^>]*src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*<\/script>\s*/gi, '');

        // Remove any existing tailwind.config script blocks
        const configRegex = /<script>\s*tailwind\.config\s*=\s*[\s\S]*?<\/script>\s*/g;
        html = html.replace(configRegex, '');

        // Always inject fresh CDN + Config
        html = html.replace('</head>', `${tailwindScript}\n</head>`);
    
        // Inject AOS CSS (Animation Library)
        if (!html.includes('aos.css')) {
            html = html.replace('</head>', `<link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">\n</head>`);
        }
        
        // Update Title (Append Page Name if not index)
        // Only update if generic or missing? Or always?
        // Let's preserve existing title if it looks custom, but here we assume it's generated.
        // Actually, rebuild might be called on edited code. We should be careful.
        // If designSystem is passed, we update.
        if (designSystem) {
            const pageTitle = file === 'index.html' ? safeTitle : `${safeTitle} - ${file.replace('.html', '').replace(/-/g, ' ')}`;
            if (html.includes('<title>')) {
                // Check if we should overwrite? Yes, for consistency.
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
        }
    
        // Inject site-nav.js for dynamic navigation
        if (!html.includes('site-nav.js')) {
            html = html.replace('</body>', `<script src="site-nav.js"></script>\n</body>`);
        }

        // Inject Lead Submission Script AND AOS Init
        // Only inject if not present
        if (!html.includes('handleLeadSubmit')) {
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
        }
    
        await fs.writeFile(filePath, html);
    }
}

async function rebuildSite(id) {
    const sourceDir = path.join(__dirname, '../projects_source', id);
    const configPath = path.join(sourceDir, 'tailwind.config.js');
    const distDir = path.join(sourceDir, 'dist');
    const publicSiteDir = path.join(__dirname, '../public/sites', id);

    if (!await fs.pathExists(sourceDir)) {
        throw new Error(`Project source not found: ${id}`);
    }

    console.log(`[${id}] Re-applying Tailwind Config (CDN)...`);
    
    try {
        let config = null;
        if (await fs.pathExists(configPath)) {
            // Delete cache to ensure fresh read
            delete require.cache[require.resolve(configPath)];
            config = require(configPath);
        } else {
            console.warn(`[${id}] No tailwind.config.js found. Skipping config update.`);
            // We can still continue to ensure other injections
        }

        // We don't have the full DesignSystem object here easily unless we fetch from DB.
        // But setupConfig mainly needs the config object for the script injection.
        // If designSystem is null, it skips title/favicon updates (which is good for rebuilds preserving manual edits).
        
        await setupConfig(sourceDir, distDir, null, id, config);

        // Ensure public preview is synced
        await fs.emptyDir(publicSiteDir);
        await fs.copy(distDir, publicSiteDir);

        return distDir;
    } catch (error) {
        console.error(`[${id}] Rebuild failed:`, error);
        throw error;
    }
}

module.exports = { buildSite, rebuildSite };