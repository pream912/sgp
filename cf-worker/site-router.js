/**
 * GenWeb Site Router — Cloudflare Worker
 *
 * Serves static sites from R2 for *.genweb.in subdomains and custom domains.
 * Forwards /api/* and /sites/* requests to the Express API running on
 * Cloudflare Containers.
 *
 * Bindings (in wrangler.toml):
 *   - SITES_BUCKET     R2 bucket binding (genweb-sites)
 *   - DOMAIN_CACHE     KV namespace for hostname → projectId cache
 *   - API_CONTAINER    Durable Object namespace fronting the API container
 *   - DB               D1 database binding for project lookups
 *   - ANALYTICS_API_URL    Express API URL for forwarding pageview counts
 */

const DOMAIN_SUFFIX = '.genweb.in';
const RESERVED_SUBDOMAINS = ['www', 'api', 'app', 'admin', 'mail'];
const CACHE_TTL_SECONDS = 60;
const NEGATIVE_CACHE_TTL_SECONDS = 30;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const host = url.hostname;

        // Forward API + preview routes to the Container.
        if (
            host === 'api.genweb.in' ||
            url.pathname.startsWith('/api/') ||
            url.pathname.startsWith('/sites/')
        ) {
            return forwardToContainer(request, env);
        }

        try {
            const lookup = await resolveProject(host, env, ctx);

            if (!lookup) {
                return new Response('Site not found', {
                    status: 404,
                    headers: { 'Content-Type': 'text/plain' },
                });
            }

            const { projectId, isExpired } = lookup;

            if (isExpired) {
                return new Response(expiredPageHTML(), {
                    status: 403,
                    headers: { 'Content-Type': 'text/html' },
                });
            }

            const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
            const r2Key = `${projectId}${filePath}`;

            const object = await env.SITES_BUCKET.get(r2Key);

            if (!object) {
                if (!filePath.includes('.')) {
                    const indexKey = `${projectId}${filePath.replace(/\/?$/, '/index.html')}`;
                    const indexObject = await env.SITES_BUCKET.get(indexKey);
                    if (indexObject) {
                        return buildResponse(indexObject, 'text/html');
                    }
                }
                return new Response('Not Found', { status: 404 });
            }

            const contentType = getContentType(filePath);
            if (contentType.includes('text/html') && env.ANALYTICS_API_URL) {
                ctx.waitUntil(trackPageview(env.ANALYTICS_API_URL, projectId).catch(() => {}));
            }

            return buildResponse(object, contentType);
        } catch (error) {
            console.error('Worker error:', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    },
};

/**
 * Forward request to the API Container via its Durable Object binding.
 * Uses a single named instance so child sessions stay sticky to one container.
 */
async function forwardToContainer(request, env) {
    if (!env.API_CONTAINER) {
        return new Response('API container binding missing', { status: 502 });
    }
    const id = env.API_CONTAINER.idFromName('genweb-api');
    const stub = env.API_CONTAINER.get(id);
    return stub.fetch(request);
}

/**
 * Resolve hostname → projectId via D1 (Worker binding).
 * KV cache is shared across PoPs and survives isolate recycle.
 */
async function resolveProject(host, env, ctx) {
    if (env.DOMAIN_CACHE) {
        const cached = await env.DOMAIN_CACHE.get(`host:${host}`, 'json');
        if (cached) return cached.data; // null is also a cached negative
    }

    let result = null;

    if (host.endsWith(DOMAIN_SUFFIX)) {
        const subdomain = host.slice(0, -DOMAIN_SUFFIX.length);
        if (!RESERVED_SUBDOMAINS.includes(subdomain) && subdomain.length > 0) {
            result = await d1ProjectLookup(env, 'subdomain', subdomain);
        }
    } else {
        result = await d1ProjectLookup(env, 'custom_domain', host);
    }

    const data = result ? { projectId: result.projectId, isExpired: result.isExpired } : null;

    if (env.DOMAIN_CACHE) {
        const ttl = data ? CACHE_TTL_SECONDS : NEGATIVE_CACHE_TTL_SECONDS;
        ctx.waitUntil(
            env.DOMAIN_CACHE.put(`host:${host}`, JSON.stringify({ data }), {
                expirationTtl: ttl,
            }).catch(() => {})
        );
    }

    return data;
}

async function d1ProjectLookup(env, column, value) {
    if (!env.DB) {
        console.error('D1 binding missing');
        return null;
    }
    try {
        const stmt = env.DB.prepare(
            `SELECT id, is_expired FROM projects WHERE ${column} = ? LIMIT 1`
        ).bind(value);
        const row = await stmt.first();
        if (!row) return null;
        return { projectId: row.id, isExpired: !!row.is_expired };
    } catch (err) {
        console.error('D1 query failed:', err);
        return null;
    }
}

function buildResponse(object, contentType) {
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set(
        'Cache-Control',
        contentType.includes('text/html')
            ? 'no-cache, max-age=0'
            : 'public, max-age=31536000'
    );
    headers.set('X-Served-By', 'genweb-cf-worker');
    if (object.httpEtag) headers.set('ETag', object.httpEtag);
    return new Response(object.body, { headers });
}

function getContentType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const types = {
        html: 'text/html',
        css: 'text/css',
        js: 'application/javascript',
        json: 'application/json',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        ico: 'image/x-icon',
        webp: 'image/webp',
        woff: 'font/woff',
        woff2: 'font/woff2',
        ttf: 'font/ttf',
        eot: 'application/vnd.ms-fontobject',
        pdf: 'application/pdf',
        xml: 'application/xml',
        txt: 'text/plain',
    };
    return types[ext] || 'application/octet-stream';
}

async function trackPageview(apiUrl, projectId) {
    await fetch(`${apiUrl}/api/analytics/pageview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
    });
}

function expiredPageHTML() {
    return `<!DOCTYPE html>
<html>
<head><title>Site Expired</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb}
.box{text-align:center;padding:2rem}.box h1{color:#111827;margin-bottom:0.5rem}.box p{color:#6b7280}</style></head>
<body><div class="box"><h1>This site has expired</h1><p>The owner's subscription has ended. Please contact them to renew.</p>
<p style="margin-top:2rem"><a href="https://genweb.in" style="color:#2563eb">Powered by GenWeb</a></p></div></body></html>`;
}
