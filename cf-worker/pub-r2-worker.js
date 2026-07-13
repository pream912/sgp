/**
 * GenWeb pub-r2 — Cloudflare Worker
 *
 * Public read-only gateway for R2. Serves files from R2 buckets via URL pattern:
 *   https://pub-r2.genweb.in/<bucket>/<key>
 *
 * Only buckets that should be publicly readable are exposed here. `genweb-projects`
 * (project source code) is intentionally excluded.
 *
 * Bindings (in wrangler.pub-r2.toml):
 *   - SITES_BUCKET     R2 binding (genweb-sites)
 *   - HOSTING_BUCKET   R2 binding (genweb-hosting)
 */

const BUCKETS = {
    'genweb-sites': 'SITES_BUCKET',
    'genweb-hosting': 'HOSTING_BUCKET',
};

export default {
    async fetch(request, env) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        const url = new URL(request.url);
        const parts = url.pathname.replace(/^\/+/, '').split('/');
        const bucketName = parts[0];
        const key = parts.slice(1).join('/');

        if (!bucketName || !key) {
            return new Response('Not Found', { status: 404 });
        }

        const bindingName = BUCKETS[bucketName];
        if (!bindingName) {
            return new Response('Bucket not available', { status: 404 });
        }
        const bucket = env[bindingName];
        if (!bucket) {
            return new Response('Bucket binding missing', { status: 502 });
        }

        // ETag for cache validation
        const ifNoneMatch = request.headers.get('If-None-Match');
        const obj = ifNoneMatch
            ? await bucket.get(key, { onlyIf: { etagDoesNotMatch: ifNoneMatch.replace(/^"|"$/g, '') } })
            : await bucket.get(key);

        if (!obj) {
            // If the object exists but matched If-None-Match, R2 returns null; verify
            const head = await bucket.head(key);
            if (head) return new Response(null, { status: 304, headers: { ETag: head.httpEtag } });
            return new Response('Not Found', { status: 404 });
        }

        const headers = new Headers();
        const meta = obj.httpMetadata || {};
        headers.set('Content-Type', meta.contentType || 'application/octet-stream');
        headers.set('Cache-Control', meta.cacheControl || 'public, max-age=31536000, immutable');
        if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('X-Served-By', 'genweb-pub-r2');

        return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
    },
};
