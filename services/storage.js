const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

// Initialize Storage
// Expects GOOGLE_APPLICATION_CREDENTIALS to be set in env or default service account
const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'sgp1-projects-storage';
const HOSTING_BUCKET = process.env.GCS_HOSTING_BUCKET || 'sgp1-sites-hosting';

async function uploadFile(localPath, destinationPath, bucketName = BUCKET_NAME) {
    try {
        await storage.bucket(bucketName).upload(localPath, {
            destination: destinationPath,
        });
        console.log(`Uploaded ${localPath} to gs://${bucketName}/${destinationPath}`);
        return `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
    } catch (error) {
        console.error('GCS Upload Error:', error);
        throw error;
    }
}

/**
 * Uploads a directory recursively to GCS
 * @param {string} localDir - Local directory path
 * @param {string} destPrefix - Destination prefix (folder) in GCS
 * @param {string} bucketName - (Optional) Target bucket name
 */
async function uploadDirectory(localDir, destPrefix, bucketName = BUCKET_NAME) {
    const files = await getFiles(localDir);
    
    // Batch uploads to avoid "socket hang up" and rate limits
    const BATCH_SIZE = 20;
    console.log(`Starting upload of ${files.length} files to gs://${bucketName}/${destPrefix} (Batch size: ${BATCH_SIZE})...`);

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (filePath) => {
            const relativePath = path.relative(localDir, filePath);
            const destination = path.join(destPrefix, relativePath).replace(/\\/g, '/'); // Ensure forward slashes
            
            try {
                await storage.bucket(bucketName).upload(filePath, {
                    destination: destination,
                    gzip: true,
                    metadata: {
                        cacheControl: filePath.endsWith('.html') ? 'no-cache, max-age=0' : 'public, max-age=31536000',
                    },
                });
            } catch (err) {
                console.error(`Failed to upload ${filePath}:`, err.message);
                // Don't throw immediately, let other files try? 
                // Better to throw if it's critical, but for backup/assets, maybe warn.
                // Throwing to ensure integrity.
                throw err;
            }
        }));
        
        // Optional: Small delay between batches if needed, but sequential batches usually suffice
        if ((i + BATCH_SIZE) < files.length) {
             console.log(`Uploaded ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} files...`);
        }
    }
    console.log(`Uploaded directory ${localDir} to gs://${bucketName}/${destPrefix}`);
}

/**
 * Downloads a directory from GCS to local path
 * @param {string} prefix - GCS folder prefix (e.g. 'projects/123/')
 * @param {string} localDir - Local destination directory
 * @param {string} bucketName - (Optional) Bucket name
 */
async function downloadDirectory(prefix, localDir, bucketName = BUCKET_NAME) {
    const [files] = await storage.bucket(bucketName).getFiles({ prefix });
    
    if (files.length === 0) {
        console.warn(`No files found in gs://${bucketName}/${prefix}`);
        return false;
    }

    console.log(`Downloading ${files.length} files from gs://${bucketName}/${prefix} to ${localDir}...`);

    await Promise.all(files.map(async (file) => {
        // Remove the prefix from the file path to get relative path
        // e.g. projects/123/dist/index.html -> dist/index.html if prefix is projects/123/
        // Actually, we want to mirror the structure.
        // If prefix is 'projects/123', file.name is 'projects/123/dist/index.html'
        // We want localDir/dist/index.html.
        
        // Ensure prefix has trailing slash for replacement
        const normalizedPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
        const relativePath = file.name.replace(normalizedPrefix, '');
        
        if (!relativePath) return; // Skip the directory marker itself if it exists

        const destPath = path.join(localDir, relativePath);
        await fs.ensureDir(path.dirname(destPath));
        
        await file.download({ destination: destPath });
    }));
    
    console.log('Download complete.');
    return true;
}

// Helper to list all files recursively
async function getFiles(dir) {
    const subdirs = await fs.readdir(dir);
    const files = await Promise.all(subdirs.map(async (subdir) => {
        const res = path.resolve(dir, subdir);
        // Filter out node_modules, .git, and system files
        if (subdir === 'node_modules' || subdir === '.git' || subdir === '.DS_Store') {
            return [];
        }
        return (await fs.stat(res)).isDirectory() ? getFiles(res) : res;
    }));
    return files.reduce((a, f) => a.concat(f), []);
}

module.exports = { uploadFile, uploadDirectory, downloadDirectory, BUCKET_NAME, HOSTING_BUCKET };
