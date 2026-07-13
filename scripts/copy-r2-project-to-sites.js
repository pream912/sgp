#!/usr/bin/env node
// One-shot: copy a completed project's dist/ from genweb-projects to genweb-sites
// Usage: node scripts/copy-r2-project-to-sites.js <projectId>

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { S3Client, ListObjectsV2Command, CopyObjectCommand } = require('@aws-sdk/client-s3');

const SOURCE_BUCKET = process.env.R2_BUCKET_NAME || 'genweb-projects';
const DEST_BUCKET = process.env.R2_SITES_BUCKET || 'genweb-sites';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error('Usage: node scripts/copy-r2-project-to-sites.js <projectId>');
    process.exit(1);
  }
  const sourcePrefix = `projects/${projectId}/dist/`;
  console.log(`Listing r2://${SOURCE_BUCKET}/${sourcePrefix} ...`);

  let continuationToken;
  let total = 0;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: SOURCE_BUCKET,
      Prefix: sourcePrefix,
      ContinuationToken: continuationToken,
    }));
    const objects = res.Contents || [];
    for (const obj of objects) {
      const srcKey = obj.Key;
      const destKey = `${projectId}/${srcKey.slice(sourcePrefix.length)}`;
      process.stdout.write(`  copy ${srcKey} -> ${DEST_BUCKET}/${destKey} ... `);
      await s3.send(new CopyObjectCommand({
        Bucket: DEST_BUCKET,
        Key: destKey,
        CopySource: `/${SOURCE_BUCKET}/${encodeURIComponent(srcKey).replace(/%2F/g, '/')}`,
      }));
      console.log('OK');
      total++;
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`\nCopied ${total} object(s). Public URL pattern: https://${process.env.R2_PUBLIC_DOMAIN || 'pub-r2.genweb.in'}/${DEST_BUCKET}/${projectId}/index.html`);
}

main().catch(err => { console.error(err); process.exit(1); });
