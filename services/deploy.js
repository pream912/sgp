const { uploadDirectory, HOSTING_BUCKET } = require('./storage');
const { deployToPages } = require('./cloudflare');
const path = require('path');
require('dotenv').config();

/**
 * Main Deploy Function (GCS + Cloudflare Pages)
 * @param {string} distPath - Path to the 'dist' folder
 * @param {string} projectId - Internal Project ID (used as Site ID)
 * @param {string} existingSiteId - (Optional)
 */
async function deploySite(distPath, projectId, existingSiteId = null) {
    console.log(`Preparing deployment for Project ${projectId}...`);

    try {
        // 1. Archive to GCS (Backup)
        console.log(`Archiving to GCS bucket: ${HOSTING_BUCKET}...`);
        await uploadDirectory(distPath, projectId, HOSTING_BUCKET);
        const gcsUrl = `https://storage.googleapis.com/${HOSTING_BUCKET}/${projectId}/index.html`;

        // 2. Deploy to Cloudflare Pages (Live)
        // Project Name: site-<projectId>
        const cfProjectName = `site-${projectId}`;
        const cfDeploy = await deployToPages(cfProjectName, distPath);

        const liveUrl = cfDeploy.alias || cfDeploy.url; // Prefer alias (project.pages.dev) over hash

        console.log(`Deployed to Cloudflare: ${liveUrl}`);

        return {
            url: liveUrl, // Primary URL is now Cloudflare
            gcsUrl: gcsUrl, // Backup URL
            siteId: projectId,
            deployId: Date.now().toString(),
            adminUrl: `https://dash.cloudflare.com/${process.env.CLOUDFLARE_ACCOUNT_ID}/pages/view/${cfProjectName}`
        };

    } catch (error) {
        console.error('Deploy Error:', error);
        throw error;
    }
}

module.exports = { deploySite };
