/**
 * Self-hosted Tailwind Play runtime.
 *
 * The public cdn.tailwindcss.com has repeated outages, and the CLI compile step
 * makes every draft edit slow. We pin one Play runtime version, host it on our
 * own R2 public domain (uploaded by scripts/update-tailwind-runtime.js), and
 * inject it into draft/preview documents. Published sites still get a compiled
 * static style.css (services/builder.js compileSite) — the runtime script is
 * for drafts, previews, and the agent pipeline's render step only.
 */
const db = require('./db');

const PINNED_VERSION = '3.4.17';
const HOSTING_BUCKET = process.env.R2_HOSTING_BUCKET || 'genweb-hosting';
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || 'pub-r2.genweb.in';

const FALLBACK_URL = `https://${R2_PUBLIC_DOMAIN}/${HOSTING_BUCKET}/assets/tailwind/v${PINNED_VERSION}/play.min.js`;

let cached = null; // { url, at }
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Resolution order: env override → platform_config (written by the update
 * script) → deterministic fallback URL for the pinned version.
 */
async function getRuntimeUrl() {
    if (process.env.TAILWIND_RUNTIME_URL) return process.env.TAILWIND_RUNTIME_URL;
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.url;
    try {
        const row = await db.one(`SELECT value FROM platform_config WHERE key = 'tailwind_runtime_url'`);
        const url = row && JSON.parse(row.value);
        if (url && typeof url === 'string') {
            cached = { url, at: Date.now() };
            return url;
        }
    } catch (e) {
        console.warn('[TailwindRuntime] config lookup failed, using fallback:', e.message);
    }
    cached = { url: FALLBACK_URL, at: Date.now() };
    return FALLBACK_URL;
}

/**
 * The <head> snippet that makes Tailwind classes resolve at runtime in a draft
 * document: self-hosted Play script + the project's theme config inline.
 */
async function runtimeInjectSnippet(twConfigObj) {
    const url = await getRuntimeUrl();
    return `<script src="${url}"></script>\n<script>tailwind.config = ${JSON.stringify(twConfigObj || {})};</script>`;
}

module.exports = { getRuntimeUrl, runtimeInjectSnippet, PINNED_VERSION, FALLBACK_URL };
