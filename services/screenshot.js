const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function captureScreenshot(urlOrPath, outputPath) {
    let browser;
    try {
        console.log(`[Screenshot] capturing: ${urlOrPath}`);
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Set viewport to generic desktop size
        await page.setViewport({ width: 1280, height: 800 });

        // Check if urlOrPath is a local file path and ensure it's absolute
        let target = urlOrPath;
        if (!urlOrPath.startsWith('http')) {
            if (!path.isAbsolute(urlOrPath)) {
                target = path.resolve(urlOrPath);
            }
            target = `file://${target}`;
        }
        
        await page.goto(target, { waitUntil: 'networkidle0', timeout: 60000 });
        
        await fs.ensureDir(path.dirname(outputPath));
        await page.screenshot({ path: outputPath, type: 'jpeg', quality: 80 });
        
        console.log(`[Screenshot] Saved to ${outputPath}`);
        return true;
    } catch (error) {
        console.error('[Screenshot] Error:', error);
        // Don't throw, just log and return false so build doesn't fail
        return false;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { captureScreenshot };
