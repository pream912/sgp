/**
 * Download the pinned Tailwind Play runtime and self-host it on R2.
 *
 * Usage: node scripts/update-tailwind-runtime.js [version]
 *   (defaults to the version pinned in services/tailwind-runtime.js)
 *
 * Idempotent — rerun to bump the pin: it uploads to a versioned immutable path
 * and points platform_config.tailwind_runtime_url at the new file, so already-
 * generated drafts keep loading the version they were built with.
 */
require('dotenv').config({ override: true });
const fs = require('fs-extra');
const path = require('path');
const { uploadFile, HOSTING_BUCKET } = require('../services/storage');
const { PINNED_VERSION } = require('../services/tailwind-runtime');
const db = require('../services/db');

async function main() {
    const version = process.argv[2] || PINNED_VERSION;
    const sourceUrl = `https://cdn.tailwindcss.com/${version}`;
    const destKey = `assets/tailwind/v${version}/play.min.js`;

    console.log(`Downloading Tailwind Play runtime ${version} from ${sourceUrl}...`);
    const resp = await fetch(sourceUrl);
    if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
    const body = await resp.text();
    if (!body.includes('tailwind')) throw new Error('Downloaded file does not look like the Tailwind runtime.');

    const tmpPath = path.join(__dirname, '../temp', `tailwind-play-${version}.js`);
    await fs.ensureDir(path.dirname(tmpPath));
    await fs.writeFile(tmpPath, body);
    console.log(`Downloaded ${(body.length / 1024).toFixed(0)} KB.`);

    const url = await uploadFile(tmpPath, destKey, HOSTING_BUCKET, { cacheControl: 'public, max-age=31536000, immutable' });
    await fs.remove(tmpPath);
    console.log(`Self-hosted Tailwind runtime ready: ${url}`);

    // The config write needs D1 access; the versioned R2 path is deterministic,
    // so getRuntimeUrl()'s fallback works even if this part is skipped locally.
    try {
        await db.exec(
            `INSERT INTO platform_config (key, value, updated_at) VALUES ('tailwind_runtime_url', ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
            [JSON.stringify(url)]
        );
        console.log('platform_config.tailwind_runtime_url updated.');
    } catch (e) {
        console.warn(`platform_config write skipped (${e.message}) — rerun in an environment with D1 access, or rely on the pinned fallback URL.`);
    }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
