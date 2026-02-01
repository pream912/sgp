const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const FormData = require('form-data');
const { getFiles } = require('./storage'); // Reusing the recursive file lister
require('dotenv').config();

const CF_API_URL = 'https://api.cloudflare.com/client/v4';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// Validation
if (!ACCOUNT_ID || !API_TOKEN) {
    console.warn("WARNING: Cloudflare credentials missing. Cloudflare services will fail.");
}

const cfClient = axios.create({
    baseURL: CF_API_URL,
    headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
    }
});

/**
 * Sanitize project name for Cloudflare Pages
 * Rules: lowercase, alphanumeric, hyphens only, max 28 chars? (Standard is stricter)
 */
function sanitizeProjectName(name) {
    return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50); // Safe limit
}

/**
 * 1. Create (or ensure) a Cloudflare Pages Project exists
 */
async function ensureProjectExists(projectName) {
    const safeName = sanitizeProjectName(projectName);
    console.log(`[Cloudflare] Ensuring Pages project '${safeName}' exists...`);

    try {
        // Try to get project
        await cfClient.get(`/accounts/${ACCOUNT_ID}/pages/projects/${safeName}`);
        return safeName; // Exists
    } catch (error) {
        if (error.response && error.response.status === 404) {
            // Create it
            try {
                await cfClient.post(`/accounts/${ACCOUNT_ID}/pages/projects`, {
                    name: safeName,
                    production_branch: "main", // Default required
                    // No build config needed for direct uploads
                });
                console.log(`[Cloudflare] Created new project: ${safeName}`);
                return safeName;
            } catch (createError) {
                console.error("[Cloudflare] Project creation failed:", createError.response?.data || createError.message);
                throw createError;
            }
        } else {
            throw error;
        }
    }
}

/**
 * 2. Upload Files to Pages Project (Direct Upload)
 */
async function deployToPages(projectName, distPath) {
    const safeName = await ensureProjectExists(projectName);
    console.log(`[Cloudflare] Deploying '${distPath}' to project '${safeName}'...`);

    // 1. Prepare File List and Hashes
    const allFiles = await getFiles(distPath); // Helper from storage.js returns absolute paths
    const filesData = [];

    // Max upload size per request is 100MB, let's assume site is small for MVP.
    // If large, we need to split.

    for (const filePath of allFiles) {
        const fileContent = await fs.readFile(filePath);
        const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
        
        // Relative path from dist root, e.g., /index.html
        // Ensure starting with /
        const relativePath = '/' + path.relative(distPath, filePath).split(path.sep).join('/');
        
        filesData.push({
            path: relativePath,
            hash: hash,
            content: fileContent
        });
    }

    // 2. Build FormData
    // Cloudflare expects: 
    // - 'manifest': JSON string { "/path": "hash" }
    // - Each file appended with key as its HASH
    
    const form = new FormData();
    const manifest = {};
    
    filesData.forEach(f => {
        manifest[f.path] = f.hash;
        form.append(f.hash, f.content, { filename: f.path }); // Filename optional but good for debug
    });
    
    form.append('manifest', JSON.stringify(manifest));

    // 3. Send Request
    try {
        const headers = {
            ...form.getHeaders(),
            'Authorization': `Bearer ${API_TOKEN}`
        };

        const res = await axios.post(
            `${CF_API_URL}/accounts/${ACCOUNT_ID}/pages/projects/${safeName}/deployments`,
            form,
            { headers }
        );

        const deployData = res.data.result;
        console.log(`[Cloudflare] Deployment Success! URL: ${deployData.url}`);
        return {
            success: true,
            url: deployData.url, // e.g. https://hash.project.pages.dev
            alias: deployData.aliases ? deployData.aliases[0] : null // e.g. https://project.pages.dev
        };

    } catch (error) {
        console.error("[Cloudflare] Deployment Failed:", error.response?.data || error.message);
        throw error;
    }
}

/**
 * 3. Add a Zone (Domain) to Cloudflare
 * Returns nameservers to setup.
 */
async function addZone(domainName) {
    console.log(`[Cloudflare] Adding zone for: ${domainName}`);
    
    try {
        const res = await cfClient.post('/zones', {
            name: domainName,
            account: { id: ACCOUNT_ID },
            jump_start: true // Attempt to scan DNS records automatically
        });
        
        const zone = res.data.result;
        return {
            id: zone.id,
            name: zone.name,
            status: zone.status,
            name_servers: zone.name_servers // Array of strings
        };
    } catch (error) {
        if (error.response?.data?.errors?.[0]?.code === 1061) {
            // Zone already exists
            console.log(`[Cloudflare] Zone ${domainName} already exists. Fetching details...`);
            const zones = await cfClient.get('/zones', { params: { name: domainName }});
            const zone = zones.data.result[0];
            return {
                id: zone.id,
                name: zone.name,
                status: zone.status,
                name_servers: zone.name_servers
            };
        }
        console.error("[Cloudflare] Add Zone Failed:", error.response?.data || error.message);
        throw error;
    }
}

/**
 * 4. Link Domain to Pages Project
 * This automatically configures DNS if the Zone is active in this account.
 */
async function linkDomainToProject(projectName, domainName) {
    const safeName = sanitizeProjectName(projectName);
    console.log(`[Cloudflare] Linking ${domainName} to Pages project ${safeName}...`);

    try {
        await cfClient.post(`/accounts/${ACCOUNT_ID}/pages/projects/${safeName}/domains`, {
            name: domainName
        });
        console.log(`[Cloudflare] Domain linked successfully.`);
        return true;
    } catch (error) {
        // Ignore if already active
        if (error.response?.data?.errors?.[0]?.code === 8000013) { // Domain already exists
             return true;
        }
        console.error("[Cloudflare] Link Domain Failed:", error.response?.data || error.message);
        throw error;
    }
}

/**
 * 5. Update DNS Records (Import)
 * Useful for "Bring Your Own Domain" flow where we scan and re-add records.
 */
async function addDnsRecord(zoneId, record) {
    // record: { type, name, content, ttl, proxied }
    try {
        await cfClient.post(`/zones/${zoneId}/dns_records`, record);
    } catch (error) {
        console.error(`[Cloudflare] Failed to add DNS ${record.type} ${record.name}:`, error.response?.data || error.message);
        // Don't throw, just log. We want to try importing as much as possible.
    }
}

async function getZoneId(domainName) {
    const zones = await cfClient.get('/zones', { params: { name: domainName }});
    return zones.data.result[0]?.id;
}

module.exports = {
    deployToPages,
    addZone,
    linkDomainToProject,
    addDnsRecord,
    getZoneId
};
