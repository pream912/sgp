#!/usr/bin/env node
/**
 * One-time GCS → R2 migration script.
 *
 * Source buckets (GCP):
 *   sgp1-projects-storage  → R2 genweb-projects
 *   site-{projectId}       → R2 genweb-sites/{projectId}/
 *   sgp1-sites-hosting     → R2 genweb-hosting
 *
 * Usage:
 *   node scripts/migrate-gcs-to-r2.js              # full copy (skips existing matching size)
 *   node scripts/migrate-gcs-to-r2.js --verify     # sample verify mode
 *   node scripts/migrate-gcs-to-r2.js --bucket=sgp1-projects-storage  # one bucket only
 *   node scripts/migrate-gcs-to-r2.js --dry-run    # list only, no writes
 *
 * Prereqs (one-time):
 *   npm install --no-save @google-cloud/storage
 *   GOOGLE_APPLICATION_CREDENTIALS=./gen-web-484805-firebase-adminsdk-*.json
 *   plus CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env
 */

const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

let Storage;
try {
    ({ Storage } = require('@google-cloud/storage'));
} catch (e) {
    console.error('Missing @google-cloud/storage. Run: npm install --no-save @google-cloud/storage');
    process.exit(1);
}

const {
    S3Client,
    PutObjectCommand,
    HeadObjectCommand,
    GetObjectCommand,
} = require('@aws-sdk/client-s3');

const args = parseArgs(process.argv.slice(2));
const DRY_RUN = args['dry-run'] === true;
const VERIFY = args['verify'] === true;
const SINGLE_BUCKET = typeof args['bucket'] === 'string' ? args['bucket'] : null;
const CONCURRENCY = parseInt(args['concurrency'] || '20', 10);

const PROJECTS_GCS = 'sgp1-projects-storage';
const HOSTING_GCS = 'sgp1-sites-hosting';
const PROJECTS_R2 = process.env.R2_BUCKET_NAME || 'genweb-projects';
const SITES_R2 = process.env.R2_SITES_BUCKET || 'genweb-sites';
const HOSTING_R2 = process.env.R2_HOSTING_BUCKET || 'genweb-hosting';

const gcs = new Storage();
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const stats = { copied: 0, skipped: 0, failed: 0, verified: 0, mismatched: 0 };

async function main() {
    if (!process.env.CF_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
        throw new Error('CF_ACCOUNT_ID and R2_ACCESS_KEY_ID must be set in env.');
    }

    console.log(`Mode: ${VERIFY ? 'VERIFY' : DRY_RUN ? 'DRY-RUN' : 'COPY'}`);
    console.log(`Concurrency: ${CONCURRENCY}\n`);

    if (SINGLE_BUCKET) {
        await migrateOneBucket(SINGLE_BUCKET);
    } else {
        await migrateBucket(PROJECTS_GCS, PROJECTS_R2, '');
        await migrateBucket(HOSTING_GCS, HOSTING_R2, '');
        await migrateAllSiteBuckets();
    }

    console.log('\n=== Summary ===');
    console.log(JSON.stringify(stats, null, 2));
    if (stats.failed > 0 || stats.mismatched > 0) process.exit(1);
}

async function migrateOneBucket(name) {
    if (name === PROJECTS_GCS) return migrateBucket(name, PROJECTS_R2, '');
    if (name === HOSTING_GCS) return migrateBucket(name, HOSTING_R2, '');
    if (name.startsWith('site-')) {
        const projectId = name.slice('site-'.length);
        return migrateBucket(name, SITES_R2, `${projectId}/`);
    }
    throw new Error(`Unrecognized bucket name: ${name}`);
}

async function migrateAllSiteBuckets() {
    const [buckets] = await gcs.getBuckets();
    const siteBuckets = buckets.filter((b) => b.name.startsWith('site-'));
    console.log(`Found ${siteBuckets.length} site-* buckets in GCS.\n`);
    for (const b of siteBuckets) {
        const projectId = b.name.slice('site-'.length);
        await migrateBucket(b.name, SITES_R2, `${projectId}/`);
    }
}

async function migrateBucket(srcBucket, dstBucket, dstPrefix) {
    console.log(`\n→ ${srcBucket}  →  r2://${dstBucket}/${dstPrefix}`);
    const bucket = gcs.bucket(srcBucket);

    let pageToken;
    do {
        const [files, , apiResp] = await bucket.getFiles({
            autoPaginate: false,
            maxResults: 1000,
            pageToken,
        });
        pageToken = apiResp?.nextPageToken;

        const sample = VERIFY ? sampleSubset(files, 4) : files;
        await runWithConcurrency(sample, CONCURRENCY, async (file) => {
            try {
                if (VERIFY) {
                    await verifyOne(file, dstBucket, dstPrefix);
                } else {
                    await copyOne(file, dstBucket, dstPrefix);
                }
            } catch (err) {
                stats.failed++;
                console.error(`  ! ${file.name}: ${err.message}`);
            }
        });
    } while (pageToken);
}

function sampleSubset(arr, perPage) {
    if (arr.length <= perPage) return arr;
    const out = [];
    for (let i = 0; i < perPage; i++) {
        out.push(arr[Math.floor(Math.random() * arr.length)]);
    }
    return out;
}

async function copyOne(srcFile, dstBucket, dstPrefix) {
    const [meta] = await srcFile.getMetadata();
    const key = dstPrefix + srcFile.name;
    const size = parseInt(meta.size, 10);

    // Skip if already in R2 with matching size.
    try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: dstBucket, Key: key }));
        if (head.ContentLength === size) {
            stats.skipped++;
            return;
        }
    } catch (_) {
        // Not present, continue with upload.
    }

    if (DRY_RUN) {
        console.log(`  [dry] ${srcFile.name} (${size}B)`);
        stats.copied++;
        return;
    }

    const [body] = await srcFile.download();
    const cacheControl = key.endsWith('.html')
        ? 'no-cache, max-age=0'
        : meta.cacheControl || 'public, max-age=31536000';

    await s3.send(new PutObjectCommand({
        Bucket: dstBucket,
        Key: key,
        Body: body,
        ContentType: meta.contentType || 'application/octet-stream',
        CacheControl: cacheControl,
    }));
    stats.copied++;
    if (stats.copied % 100 === 0) console.log(`  copied ${stats.copied}…`);
}

async function verifyOne(srcFile, dstBucket, dstPrefix) {
    const [meta] = await srcFile.getMetadata();
    const key = dstPrefix + srcFile.name;
    const size = parseInt(meta.size, 10);

    const head = await s3.send(new HeadObjectCommand({ Bucket: dstBucket, Key: key }));
    if (head.ContentLength !== size) {
        stats.mismatched++;
        console.error(`  size mismatch: ${key} gcs=${size} r2=${head.ContentLength}`);
        return;
    }

    // Compare first 1KB hash for sampling.
    const [srcChunk] = await srcFile.download({ start: 0, end: 1023 });
    const dstObj = await s3.send(new GetObjectCommand({
        Bucket: dstBucket,
        Key: key,
        Range: 'bytes=0-1023',
    }));
    const dstChunk = await streamToBuffer(dstObj.Body);

    if (sha1(srcChunk) !== sha1(dstChunk)) {
        stats.mismatched++;
        console.error(`  hash mismatch: ${key}`);
        return;
    }
    stats.verified++;
}

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    return Buffer.concat(chunks);
}

function sha1(buf) {
    return crypto.createHash('sha1').update(buf).digest('hex');
}

async function runWithConcurrency(items, n, fn) {
    const queue = [...items];
    const workers = Array.from({ length: n }, async () => {
        while (queue.length) await fn(queue.shift());
    });
    await Promise.all(workers);
}

function parseArgs(argv) {
    const out = {};
    for (const a of argv) {
        if (a.startsWith('--')) {
            const [k, v] = a.slice(2).split('=');
            out[k] = v === undefined ? true : v;
        }
    }
    return out;
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
