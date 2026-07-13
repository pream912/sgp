const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { uploadDirectory } = require('./storage');
const path = require('path');
require('dotenv').config();

// R2 Client for bucket operations (delete, etc.)
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const SITES_BUCKET = process.env.R2_SITES_BUCKET || 'genweb-sites';
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || 'pub-r2.genweb.in';

/**
 * Main Deploy Function — uploads site files to R2
 * @param {string} distPath - Path to the 'dist' folder
 * @param {string} projectId - Internal Project ID
 */
async function deploySite(distPath, projectId) {
    console.log(`Preparing deployment for Project ${projectId} to R2...`);

    try {
        // Upload content to genweb-sites/{projectId}/
        console.log(`Uploading content to r2://${SITES_BUCKET}/${projectId}/...`);
        await uploadDirectory(distPath, projectId, SITES_BUCKET);

        const publicUrl = `https://${R2_PUBLIC_DOMAIN}/${SITES_BUCKET}/${projectId}/index.html`;
        console.log(`Deployed to R2: ${publicUrl}`);

        return {
            url: publicUrl,
            siteId: projectId,
            bucketName: SITES_BUCKET,
            deployId: Date.now().toString(),
        };

    } catch (error) {
        console.error('Deploy Error:', error);
        throw error;
    }
}

/**
 * Delete all files for a project in R2
 */
async function deleteSiteBucket(projectId) {
    const prefix = `${projectId}/`;
    console.log(`Deleting site files for ${projectId} from r2://${SITES_BUCKET}/...`);

    try {
        // List all objects with the project prefix
        let allObjects = [];
        let continuationToken;

        do {
            const response = await s3.send(new ListObjectsV2Command({
                Bucket: SITES_BUCKET,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            }));

            if (response.Contents) {
                allObjects = allObjects.concat(response.Contents);
            }
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        if (allObjects.length === 0) {
            console.log(`No files found for ${projectId}, skipping.`);
            return;
        }

        // Delete in batches of 1000 (S3/R2 limit)
        const BATCH_SIZE = 1000;
        for (let i = 0; i < allObjects.length; i += BATCH_SIZE) {
            const batch = allObjects.slice(i, i + BATCH_SIZE);
            await s3.send(new DeleteObjectsCommand({
                Bucket: SITES_BUCKET,
                Delete: {
                    Objects: batch.map(obj => ({ Key: obj.Key })),
                },
            }));
        }

        console.log(`Deleted ${allObjects.length} files for ${projectId}.`);
    } catch (error) {
        console.error(`Failed to delete site files for ${projectId}:`, error);
        throw error;
    }
}

module.exports = { deploySite, deleteSiteBucket };
