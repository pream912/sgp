const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

/**
 * Capture a screenshot using Cloudflare Browser Rendering API.
 * Falls back to a 1x1 placeholder if the API is not configured.
 *
 * @param {string} urlOrPath - URL of the live site (or local file path for fallback)
 * @param {string} outputPath - Where to save the JPEG screenshot
 * @returns {boolean} success
 */
async function captureScreenshot(urlOrPath, outputPath) {
    try {
        console.log(`[Screenshot] Capturing: ${urlOrPath}`);

        // Ensure we have a proper URL (not a local file path)
        let targetUrl = urlOrPath;
        if (!urlOrPath.startsWith('http')) {
            // Local file path — can't use CF Browser Rendering
            // This happens during build before deploy; skip or use placeholder
            console.warn('[Screenshot] Local file path provided — skipping CF Browser Rendering');
            return false;
        }

        if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
            console.warn('[Screenshot] CF credentials not configured, skipping');
            return false;
        }

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/screenshot`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: targetUrl,
                    viewport: { width: 1280, height: 800 },
                    screenshotOptions: {
                        type: 'jpeg',
                        quality: 80,
                    },
                    gotoOptions: {
                        waitUntil: 'networkidle0',
                        timeout: 30000,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`CF Browser Rendering error (${response.status}): ${errText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, buffer);

        console.log(`[Screenshot] Saved to ${outputPath}`);
        return true;
    } catch (error) {
        console.error('[Screenshot] Error:', error.message);
        return false;
    }
}

module.exports = { captureScreenshot };
