const { Storage } = require('@google-cloud/storage');
const { uploadDirectory } = require('./storage');
const path = require('path');
require('dotenv').config();

const storage = new Storage();

/**
 * Main Deploy Function (GCP Backend Bucket Strategy)
 * @param {string} distPath - Path to the 'dist' folder
 * @param {string} projectId - Internal Project ID
 * @param {string} [existingSiteId] - (Legacy/Optional)
 */
async function deploySite(distPath, projectId, existingSiteId = null) {
    console.log(`Preparing deployment for Project ${projectId} to GCP...`);
    
    // Bucket Name Strategy: "site-<projectId>"
    // This allows unique buckets that can be attached to Backend Buckets.
    const bucketName = `site-${projectId}`;
    const bucket = storage.bucket(bucketName);
    
    try {
        // 1. Ensure Bucket Exists & is Configured
        const [exists] = await bucket.exists();
        if (!exists) {
            console.log(`Creating bucket: ${bucketName}...`);
            await storage.createBucket(bucketName, {
                location: 'asia-south1', // Regional (Mumbai)
                storageClass: 'STANDARD',
            });
        }
        
        // 2. Configure as Website (MainPageSuffix)
        // This is crucial for Backend Buckets to serve index.html for root requests
        console.log(`Configuring bucket website settings...`);
        await bucket.setMetadata({
            website: {
                mainPageSuffix: 'index.html',
                notFoundPage: '404.html',
            },
        });
        
        // 3. Make Public (Reader role for allUsers)
        // CAUTION: This makes all content in the bucket public.
        console.log(`Setting bucket public access...`);
        await bucket.makePublic({ includeFiles: true }); 
        // Note: makePublic() on the bucket object might just set default ACL. 
        // For uniform bucket-level access (recommended), we should set IAM policy.
        // But for simplicity/compatibility, we use the helper.
        
        // 4. Upload Content to Root
        console.log(`Uploading content to ${bucketName}...`);
        // We reuse uploadDirectory but set destPrefix to '' (root)
        await uploadDirectory(distPath, '', bucketName);
        
        const publicUrl = `https://storage.googleapis.com/${bucketName}/index.html`;
        console.log(`Deployed to GCP: ${publicUrl}`);

        return {
            url: publicUrl,
            siteId: projectId,
            bucketName: bucketName,
            deployId: Date.now().toString(),
            adminUrl: `https://console.cloud.google.com/storage/browser/${bucketName}`
        };

    } catch (error) {
        console.error('Deploy Error:', error);
        throw error;
    }
}

async function makeBucketPrivate(bucketName) {
    try {
        console.log(`Making bucket ${bucketName} private...`);
        const bucket = storage.bucket(bucketName);
        await bucket.makePrivate({ includeFiles: true });
        console.log(`Bucket ${bucketName} is now private.`);
    } catch (error) {
        console.error(`Failed to make bucket ${bucketName} private:`, error);
        throw error;
    }
}

async function makeBucketPublic(bucketName) {
    try {
        console.log(`Making bucket ${bucketName} public...`);
        const bucket = storage.bucket(bucketName);
        await bucket.makePublic({ includeFiles: true });
        console.log(`Bucket ${bucketName} is now public.`);
    } catch (error) {
        console.error(`Failed to make bucket ${bucketName} public:`, error);
        throw error;
    }
}

module.exports = { deploySite, makeBucketPrivate, makeBucketPublic };
