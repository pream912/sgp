const http = require('http');
const https = require('https');
const url = require('url');

// Configuration
const BACKEND_API = process.env.BACKEND_API || 'https://sgp1-backend.run.app'; // Your Main Backend URL
const GCS_BUCKET_URL = 'https://storage.googleapis.com/sgp1-sites-hosting';
const PORT = 3000;

// Simple In-Memory Cache for Domain -> ProjectID
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5; // 5 Minutes

/**
 * Fetch Project ID from Main Backend
 */
async function getProjectId(domain) {
    // Check Cache
    if (cache.has(domain)) {
        const entry = cache.get(domain);
        if (Date.now() - entry.timestamp < CACHE_TTL) {
            return entry.projectId;
        }
    }

    // Fetch from Backend
    return new Promise((resolve, reject) => {
        const lookupUrl = `${BACKEND_API}/api/domain-lookup?domain=${domain}`;
        
        https.get(lookupUrl, (res) => {
            if (res.statusCode !== 200) {
                // If 404, valid domain but not found. If 500, error.
                if (res.statusCode === 404) return resolve(null);
                return reject(new Error(`Backend returned ${res.statusCode}`));
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.projectId) {
                        // Update Cache
                        cache.set(domain, { projectId: json.projectId, timestamp: Date.now() });
                        resolve(json.projectId);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

/**
 * Main Proxy Handler
 */
const server = http.createServer(async (req, res) => {
    const host = req.headers.host; // e.g., "myshop.com"
    if (!host) {
        res.statusCode = 400;
        return res.end('Host header missing');
    }

    try {
        console.log(`[Proxy] Request: ${host} ${req.url}`);
        
        // --- Special Route: Caddy "Ask" (SSL Permission) ---
        // Caddy sends: GET /ask-permission?domain=example.com
        const parsedUrl = url.parse(req.url, true);
        if (parsedUrl.pathname === '/ask-permission') {
            const domainToCheck = parsedUrl.query.domain;
            if (!domainToCheck) {
                res.statusCode = 400;
                return res.end('Domain param missing');
            }

            const pid = await getProjectId(domainToCheck);
            if (pid) {
                res.statusCode = 200; // Allow
                return res.end('Allowed');
            } else {
                res.statusCode = 403; // Deny
                return res.end('Denied');
            }
        }

        // --- Normal Proxy Request ---
        
        // 1. Lookup Project ID
        const projectId = await getProjectId(host);

        if (!projectId) {
            res.statusCode = 404;
            return res.end('Domain not connected to any site.');
        }

        // 2. Proxy to GCS
        // URL Structure: https://storage.googleapis.com/BUCKET/PROJECT_ID/index.html
        // We ignore the path for now (Single Page App) or map it?
        // Since it's a generated static site, usually everything is in root.
        // If request is for assets (e.g. /assets/img.png), we append that.
        
        const targetPath = req.url === '/' ? '/index.html' : req.url;
        const targetUrl = `${GCS_BUCKET_URL}/${projectId}${targetPath}`;
        
        https.get(targetUrl, (proxyRes) => {
            // Forward Status
            res.statusCode = proxyRes.statusCode;
            
            // Forward Headers (optional filtering)
            Object.keys(proxyRes.headers).forEach(key => {
                res.setHeader(key, proxyRes.headers[key]);
            });

            // Pipe Data
            proxyRes.pipe(res);
        }).on('error', (err) => {
            console.error('Proxy Error:', err);
            res.statusCode = 502;
            res.end('Upstream Error');
        });

    } catch (error) {
        console.error('Router Error:', error);
        res.statusCode = 500;
        res.end('Internal Server Error');
    }
});

server.listen(PORT, () => {
    console.log(`Router running on port ${PORT}`);
});
