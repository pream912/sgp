const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs-extra');
const mime = require('mime-types');
require('dotenv').config();

// Initialize R2 Client (S3-compatible)
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'genweb-projects';
const HOSTING_BUCKET = process.env.R2_HOSTING_BUCKET || 'genweb-hosting';
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || 'pub-r2.genweb.in';

async function uploadWithRetry(params, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await s3.send(new PutObjectCommand(params));
            return;
        } catch (error) {
            if (attempt === maxRetries) throw error;
            console.warn(`Upload failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`);
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}

async function uploadFile(localPath, destinationPath, bucketName = BUCKET_NAME, options = {}) {
    try {
        const fileContent = await fs.readFile(localPath);
        const contentType = mime.lookup(localPath) || 'application/octet-stream';

        await uploadWithRetry({
            Bucket: bucketName,
            Key: destinationPath,
            Body: fileContent,
            ContentType: contentType,
            ...(options.cacheControl ? { CacheControl: options.cacheControl } : {}),
        });

        const url = `https://${R2_PUBLIC_DOMAIN}/${bucketName}/${destinationPath}`;
        console.log(`Uploaded ${localPath} to r2://${bucketName}/${destinationPath}`);
        return url;
    } catch (error) {
        console.error('R2 Upload Error:', error);
        throw error;
    }
}

/**
 * Uploads a directory recursively to R2
 * @param {string} localDir - Local directory path
 * @param {string} destPrefix - Destination prefix (folder) in R2
 * @param {string} bucketName - (Optional) Target bucket name
 */
async function uploadDirectory(localDir, destPrefix, bucketName = BUCKET_NAME) {
    const files = await getFiles(localDir);

    const BATCH_SIZE = 20;
    console.log(`Starting upload of ${files.length} files to r2://${bucketName}/${destPrefix} (Batch size: ${BATCH_SIZE})...`);

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (filePath) => {
            const relativePath = path.relative(localDir, filePath);
            const destination = destPrefix
                ? path.join(destPrefix, relativePath).replace(/\\/g, '/')
                : relativePath.replace(/\\/g, '/');

            const fileContent = await fs.readFile(filePath);
            const contentType = mime.lookup(filePath) || 'application/octet-stream';
            const cacheControl = filePath.endsWith('.html') ? 'no-cache, max-age=0' : 'public, max-age=31536000';

            await uploadWithRetry({
                Bucket: bucketName,
                Key: destination,
                Body: fileContent,
                ContentType: contentType,
                CacheControl: cacheControl,
            });
        }));

        if ((i + BATCH_SIZE) < files.length) {
            console.log(`Uploaded ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} files...`);
        }
    }
    console.log(`Uploaded directory ${localDir} to r2://${bucketName}/${destPrefix}`);
}

/**
 * Downloads a directory from R2 to local path
 * @param {string} prefix - R2 folder prefix (e.g. 'projects/123/')
 * @param {string} localDir - Local destination directory
 * @param {string} bucketName - (Optional) Bucket name
 */
async function downloadDirectory(prefix, localDir, bucketName = BUCKET_NAME) {
    const normalizedPrefix = prefix.endsWith('/') ? prefix : prefix + '/';

    // List all objects with the given prefix
    let allObjects = [];
    let continuationToken;

    do {
        const listParams = {
            Bucket: bucketName,
            Prefix: normalizedPrefix,
            ContinuationToken: continuationToken,
        };
        const response = await s3.send(new ListObjectsV2Command(listParams));

        if (response.Contents) {
            allObjects = allObjects.concat(response.Contents);
        }
        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    if (allObjects.length === 0) {
        console.warn(`No files found in r2://${bucketName}/${prefix}`);
        return false;
    }

    console.log(`Downloading ${allObjects.length} files from r2://${bucketName}/${prefix} to ${localDir}...`);

    const BATCH_SIZE = 20;
    for (let i = 0; i < allObjects.length; i += BATCH_SIZE) {
        const batch = allObjects.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (obj) => {
            const relativePath = obj.Key.replace(normalizedPrefix, '');
            if (!relativePath) return; // Skip directory markers

            const destPath = path.join(localDir, relativePath);
            await fs.ensureDir(path.dirname(destPath));

            const response = await s3.send(new GetObjectCommand({
                Bucket: bucketName,
                Key: obj.Key,
            }));

            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            await fs.writeFile(destPath, Buffer.concat(chunks));
        }));
    }

    console.log('Download complete.');
    return true;
}

// Helper to list all files recursively
async function getFiles(dir) {
    const subdirs = await fs.readdir(dir);
    const files = await Promise.all(subdirs.map(async (subdir) => {
        const res = path.resolve(dir, subdir);
        if (subdir === 'node_modules' || subdir === '.git' || subdir === '.DS_Store') {
            return [];
        }
        return (await fs.stat(res)).isDirectory() ? getFiles(res) : res;
    }));
    return files.reduce((a, f) => a.concat(f), []);
}

async function uploadPreview(localPath, projectId) {
    const destination = `previews/${projectId}.jpg`;
    const fileContent = await fs.readFile(localPath);

    await uploadWithRetry({
        Bucket: HOSTING_BUCKET,
        Key: destination,
        Body: fileContent,
        ContentType: 'image/jpeg',
        CacheControl: 'no-cache, max-age=0',
    });

    const url = `https://${R2_PUBLIC_DOMAIN}/${HOSTING_BUCKET}/${destination}`;
    console.log(`[Preview] Uploaded to ${url}`);
    return url;
}

module.exports = { uploadFile, uploadDirectory, downloadDirectory, uploadPreview, BUCKET_NAME, HOSTING_BUCKET };
