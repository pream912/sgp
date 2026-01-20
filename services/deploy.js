const { uploadDirectory, HOSTING_BUCKET } = require('./storage');
const path = require('path');
require('dotenv').config();

/**
 * Main Deploy Function (GCS Version)
 * @param {string} distPath - Path to the 'dist' folder
 * @param {string} projectId - Internal Project ID
 * @param {string} existingSiteId - (Optional) Ignored for GCS, kept for compatibility
 */
async function deploySite(distPath, projectId, existingSiteId = null) {
    console.log(`Preparing deployment for Project ${projectId} to GCS bucket: ${HOSTING_BUCKET}...`);

    try {
        // Upload the dist directory to the hosting bucket
        // We upload to a folder named after the projectId to avoid collisions
        await uploadDirectory(distPath, projectId, HOSTING_BUCKET);
        
        // Construct the URL
        let deployUrl;
        if (process.env.LOAD_BALANCER_URL) {
            // If using a Load Balancer, we assume it points to the bucket
            // and we append the project ID (subdirectory)
            const baseUrl = process.env.LOAD_BALANCER_URL.replace(/\/$/, '');
            deployUrl = `${baseUrl}/${projectId}/`;
        } else {
            // Fallback to direct Storage URL
            deployUrl = `https://storage.googleapis.com/${HOSTING_BUCKET}/${projectId}/index.html`;
        }

        console.log(`Deployed to GCS: ${deployUrl}`);

        return {
            url: deployUrl,
            siteId: projectId, // Use projectId as siteId for GCS
            deployId: Date.now().toString(),
            adminUrl: `https://console.cloud.google.com/storage/browser/${HOSTING_BUCKET}/${projectId}`
        };

    } catch (error) {
        console.error('GCS Deploy Error:', error);
        throw error;
    }
}

module.exports = { deploySite };
