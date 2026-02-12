const axios = require('axios');
const dns = require('dns').promises;
require('dotenv').config();

// Google Cloud Compute & Certificate Manager Clients
const { BackendBucketsClient, UrlMapsClient, GlobalOperationsClient } = require('@google-cloud/compute');
const { CertificateManagerClient } = require('@google-cloud/certificate-manager');

const NAMESILO_API_KEY = process.env.NAMESILO_KEY;
const ENV = process.env.NAMESILO_ENV || 'PROD';
const GCP_LB_IP = process.env.GCP_LB_IP || '34.50.155.64'; 
const GCP_PROJECT_ID = process.env.GCP_PROJECT || 'gen-web-484805'; 
const LB_NAME = 'genweb-lb';
const CERT_MAP_NAME = 'genweb-cert-map'; // Must exist in GCP

const backendBucketsClient = new BackendBucketsClient();
const urlMapsClient = new UrlMapsClient();
const certificateManagerClient = new CertificateManagerClient();
const operationsClient = new GlobalOperationsClient();

const BASE_URL = ENV === 'PROD' 
    ? 'https://www.namesilo.com/api' 
    : 'https://sandbox.namesilo.com/api';

function formatPrice(priceUSD) {
    if (!priceUSD) return null;
    const rate = 85; 
    const priceINR = Math.round(parseFloat(priceUSD) * rate);
    return {
        amount: priceINR,
        currency: 'INR',
        display: `₹${priceINR.toLocaleString('en-IN')}`
    };
}

async function callNameSilo(operation, params = {}) {
    if (!NAMESILO_API_KEY) throw new Error("NameSilo API credentials missing.");

    try {
        console.log(`[NameSilo] Request: ${BASE_URL}/${operation} (Key: ...${NAMESILO_API_KEY.slice(-4)})`);
        const response = await axios.get(`${BASE_URL}/${operation}`, {
            params: {
                version: 1,
                type: 'json',
                key: NAMESILO_API_KEY,
                ...params
            }
        });

        const data = response.data.reply;
        const code = String(data.code);
        
        if (code !== '300' && code !== '301' && code !== '250') {
             console.error(`NameSilo Error [${operation}]:`, data);
             throw new Error(data.detail || `NameSilo API Error: ${code}`);
        }
        return data;
    } catch (error) {
        console.error(`NameSilo Request Failed [${operation}]:`, error.message);
        throw error;
    }
}

async function checkAvailability(domain) {
    console.log(`Checking availability for: ${domain}...`);
    try {
        const data = await callNameSilo('checkRegisterAvailability', { domains: domain });
        const availableData = data.available ? data.available.domain : null;
        const unavailableData = data.unavailable ? data.unavailable.domain : null;

        if (availableData) {
             const price = availableData.price || '10.95';
             return {
                 domain: availableData.name || domain,
                 available: true,
                 price: parseFloat(price) * 1000000,
                 priceDisplay: formatPrice(price),
                 currency: 'USD'
             };
        } else if (unavailableData) {
            return { domain: domain, available: false, error: null };
        } else {
             return { domain, available: false, error: "Invalid response from registrar" };
        }
    } catch (error) {
        return { domain, available: false, error: error.message };
    }
}

async function getSuggestions(query, limit = 5) {
    const tlds = ['com', 'net', 'org', 'co', 'info', 'biz', 'online'];
    const baseName = query.split('.')[0];
    const candidates = tlds.map(tld => `${baseName}.${tld}`).slice(0, 10);
    const domainsStr = candidates.join(',');
    
    try {
        const data = await callNameSilo('checkRegisterAvailability', { domains: domainsStr });
        const available = data.available ? (Array.isArray(data.available.domain) ? data.available.domain : [data.available.domain]) : [];
        return available.slice(0, limit).map(d => ({
            domain: d.name,
            available: true,
            price: parseFloat(d.price) * 1000000,
            currency: 'USD',
            priceDisplay: formatPrice(d.price)
        }));
    } catch (error) {
        return [];
    }
}

async function purchaseDomain(domain, details) {
    console.log(`Purchasing domain: ${domain}...`);
    try {
        const contact = details.contact || {};
        const params = {
            domain: domain,
            years: 1,
            private: 1,
            auto_renew: 1,
            // Contact Info Mapping
            fn: contact.nameFirst,
            ln: contact.nameLast,
            ad: contact.addressMailing?.address1,
            city: contact.addressMailing?.city,
            st: contact.addressMailing?.state,
            zip: contact.addressMailing?.postalCode,
            ct: contact.addressMailing?.country || 'US',
            em: contact.email,
            ph: contact.phone
        };

        // Filter out undefined
        Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

        const data = await callNameSilo('registerDomain', params);
        return {
            orderId: data.message || 'SUCCESS',
            domain: domain,
            status: 'PENDING',
            total: 0
        };
    } catch (error) {
        throw new Error(error.message);
    }
}

/**
 * Update NameServers at NameSilo (Legacy/Optional if using Custom NS)
 */
async function changeNameServers(domain, nsArray) {
    console.log(`Updating NameServers for ${domain} to: ${nsArray.join(', ')}`);
    const params = { domain };
    nsArray.forEach((ns, index) => {
        params[`ns${index + 1}`] = ns;
    });

    try {
        await callNameSilo('changeNameServers', params);
        return true;
    } catch (error) {
        throw error;
    }
}

/**
 * Add A Record to NameSilo
 */
async function addDNSRecord(domain, ip) {
    console.log(`Adding A Record for ${domain} -> ${ip}`);
    try {
        // NameSilo API: dnsAddRecord
        // rrhost: Subdomain (empty for root?) NameSilo uses '' or '@'? 
        // Docs say: rrhost (optional) - The hostname to prepend to the domain. 
        // To set root, we usually leave it empty or don't send it.
        
        await callNameSilo('dnsAddRecord', {
            domain: domain,
            rrtype: 'A',
            rrvalue: ip,
            rrttl: 3600
        });
        
        // Also add www?
        try {
            await callNameSilo('dnsAddRecord', {
                domain: domain,
                rrtype: 'CNAME',
                rrhost: 'www',
                rrvalue: domain,
                rrttl: 3600
            });
        } catch (e) {
            console.warn('Failed to add WWW CNAME (might exist):', e.message);
        }

        return true;
    } catch (error) {
        throw error;
    }
}

/**
 * List DNS Records (Generic)
 */
async function listDNSRecords(domain) {
    try {
        console.log(`Listing DNS records for ${domain}...`);
        const data = await callNameSilo('dnsListRecords', { domain });
        const records = data.resource_record || [];
        // NameSilo returns a single object if only 1 record, or array if multiple.
        return Array.isArray(records) ? records : [records];
    } catch (error) {
        throw error;
    }
}

/**
 * Add DNS Record (Generic)
 */
async function addDNSRecordGeneric(domain, record) {
    console.log(`Adding DNS Record for ${domain}:`, record);
    // record: { type, host, value, ttl, distance }
    try {
        const params = {
            domain: domain,
            rrtype: record.type,
            rrhost: record.host,
            rrvalue: record.value,
            rrttl: record.ttl || 3600
        };
        if (record.distance) params.rrdistance = record.distance; // Priority for MX

        const data = await callNameSilo('dnsAddRecord', params);
        return { success: true, id: data.record_id };
    } catch (error) {
        throw error;
    }
}

/**
 * Delete DNS Record (Generic)
 */
async function deleteDNSRecord(domain, rrid) {
    console.log(`Deleting DNS Record ${rrid} for ${domain}...`);
    try {
        await callNameSilo('dnsDeleteRecord', { domain, rrid });
        return { success: true };
    } catch (error) {
        throw error;
    }
}

/**
 * Verify if domain resolves to our LB IP
 */
async function verifyDomainDNS(domain) {
    try {
        console.log(`Verifying DNS for ${domain}...`);
        const addresses = await dns.resolve4(domain);
        const isConnected = addresses.includes(GCP_LB_IP);
        return { verified: isConnected, currentIPs: addresses };
    } catch (error) {
        console.warn(`DNS lookup failed for ${domain}:`, error.message);
        return { verified: false, error: error.message };
    }
}

// --- GCP Automation Helpers ---

async function waitForOperation(operation, name) {
    if (!operation) return;
    console.log(`Waiting for operation: ${name || 'unknown'}...`);
    
    // 1. If it has a promise() method (LRO wrapper)
    if (typeof operation.promise === 'function') {
        await operation.promise();
        return;
    }

    // 2. If it has a 'name' (Proto Operation), use GlobalOperationsClient to wait
    if (operation.name) {
        // Warning: This blocks until completion.
        await operationsClient.wait({
            project: GCP_PROJECT_ID,
            operation: operation.name
        });
        return;
    }
    
    // 3. Fallback: It might be a completed request or unexpected format
    console.warn(`[GCP] Operation '${name}' format unexpected, assuming complete or fire-and-forget.`);
}

async function ensureBackendBucket(projectId) {
    const bucketName = `backend-site-${projectId}`;
    const gcsBucketName = `site-${projectId}`;
    
    try {
        await backendBucketsClient.get({ project: GCP_PROJECT_ID, backendBucket: bucketName });
        console.log(`[GCP] Backend bucket '${bucketName}' already exists.`);
    } catch (err) {
        if (err.code === 404) {
            console.log(`[GCP] Creating Backend Bucket '${bucketName}'...`);
            const [operation] = await backendBucketsClient.insert({
                project: GCP_PROJECT_ID,
                backendBucketResource: {
                    name: bucketName,
                    bucketName: gcsBucketName,
                    enableCdn: false
                }
            });
            await waitForOperation(operation, 'Create Backend Bucket');
            console.log(`[GCP] Backend Bucket '${bucketName}' created.`);
        } else {
            throw err;
        }
    }
    return bucketName;
}

/**
 * Creates a Certificate Manager Certificate (New Scalable Way)
 */
async function ensureCertificateManagerCert(domain) {
    const certId = `cert-${domain.replace(/\./g, '-')}`;
    const parent = `projects/${GCP_PROJECT_ID}/locations/global`;
    const certName = `${parent}/certificates/${certId}`;
    
    try {
        await certificateManagerClient.getCertificate({ name: certName });
        console.log(`[GCP] Certificate Manager Cert '${certId}' already exists.`);
    } catch (err) {
        if (err.code === 5 || err.code === 404) { 
            console.log(`[GCP] Creating Certificate Manager Cert '${certId}'...`);
            const [operation] = await certificateManagerClient.createCertificate({
                parent: parent,
                certificateId: certId,
                certificate: {
                    managed: {
                        domains: [domain]
                    }
                }
            });
            await waitForOperation(operation, 'Create Certificate');
            console.log(`[GCP] Certificate '${certId}' created.`);
        } else {
            throw err;
        }
    }
    return certName;
}

async function updateUrlMap(domain, backendBucketName) {
    const [urlMap] = await urlMapsClient.get({ project: GCP_PROJECT_ID, urlMap: LB_NAME });
    
    const matcherName = `matcher-${backendBucketName.replace('backend-', '')}`;
    
    // Check Matchers
    let matchers = urlMap.pathMatchers || [];
    let matcher = matchers.find(m => m.name === matcherName);
    
    if (!matcher) {
        matcher = {
            name: matcherName,
            defaultService: `https://www.googleapis.com/compute/v1/projects/${GCP_PROJECT_ID}/global/backendBuckets/${backendBucketName}`
        };
        matchers.push(matcher);
    }
    
    // Check Host Rules
    let hostRules = urlMap.hostRules || [];
    let hostRule = hostRules.find(r => r.hosts && r.hosts.includes(domain));
    
    if (hostRule) {
        if (hostRule.pathMatcher !== matcherName) {
            hostRule.pathMatcher = matcherName;
        }
    } else {
        hostRules.push({
            hosts: [domain],
            pathMatcher: matcherName
        });
    }
    
    console.log(`[GCP] Patching URL Map '${LB_NAME}'...`);
    const [operation] = await urlMapsClient.patch({
        project: GCP_PROJECT_ID,
        urlMap: LB_NAME,
        urlMapResource: {
            hostRules: hostRules,
            pathMatchers: matchers,
            fingerprint: urlMap.fingerprint 
        }
    });
    await waitForOperation(operation, 'Update URL Map');
    console.log(`[GCP] URL Map updated.`);
}

/**
 * Adds the certificate to the Global Certificate Map
 */
async function addCertificateToMap(domain, certResourceName) {
    const mapId = CERT_MAP_NAME;
    const parent = `projects/${GCP_PROJECT_ID}/locations/global/certificateMaps/${mapId}`;
    
    const entryId = `entry-${domain.replace(/\./g, '-')}`;
    const entryName = `${parent}/certificateMapEntries/${entryId}`;
    
    try {
        await certificateManagerClient.getCertificateMapEntry({ name: entryName });
        console.log(`[GCP] Cert Map Entry '${entryId}' already exists.`);
    } catch (err) {
        if (err.code === 5 || err.code === 404) {
            console.log(`[GCP] Creating Cert Map Entry '${entryId}'...`);
            const [operation] = await certificateManagerClient.createCertificateMapEntry({
                parent: parent,
                certificateMapEntryId: entryId,
                certificateMapEntry: {
                    hostname: domain,
                    certificates: [certResourceName]
                }
            });
            await waitForOperation(operation, 'Create Cert Map Entry');
            console.log(`[GCP] Cert Map Entry '${entryId}' created.`);
        } else {
            throw err;
        }
    }
}

/**
 * Cleanup GCP Resources on Failure
 */
async function cleanupGCPDomain(domain, projectId) {
    console.log(`[GCP] Cleaning up resources for ${domain} due to failure...`);
    const bucketName = `backend-site-${projectId}`;
    const certId = `cert-${domain.replace(/\./g, '-')}`;
    const mapEntryId = `entry-${domain.replace(/\./g, '-')}`;
    const parent = `projects/${GCP_PROJECT_ID}/locations/global`;

    try {
        // 1. Remove from Certificate Map
        try {
            const entryName = `${parent}/certificateMaps/${CERT_MAP_NAME}/certificateMapEntries/${mapEntryId}`;
            console.log(`[GCP] Deleting Cert Map Entry '${mapEntryId}'...`);
            const [op] = await certificateManagerClient.deleteCertificateMapEntry({ name: entryName });
            await waitForOperation(op, 'Delete Map Entry');
        } catch (e) {
            console.warn(`[Cleanup] Failed to delete map entry (might not exist): ${e.message}`);
        }

        // 2. Delete Certificate
        try {
            const certName = `${parent}/certificates/${certId}`;
            console.log(`[GCP] Deleting Certificate '${certId}'...`);
            const [op] = await certificateManagerClient.deleteCertificate({ name: certName });
            await waitForOperation(op, 'Delete Certificate');
        } catch (e) {
            console.warn(`[Cleanup] Failed to delete certificate (might not exist): ${e.message}`);
        }

        // 3. Update URL Map (Remove Host Rule)
        try {
            const [urlMap] = await urlMapsClient.get({ project: GCP_PROJECT_ID, urlMap: LB_NAME });
            const matcherName = `matcher-${bucketName.replace('backend-', '')}`;
            
            const newHostRules = (urlMap.hostRules || []).filter(r => !r.hosts.includes(domain));
            const newMatchers = (urlMap.pathMatchers || []).filter(m => m.name !== matcherName);
            
            // Only update if changes needed
            if (newHostRules.length !== (urlMap.hostRules || []).length) {
                console.log(`[GCP] Removing Host Rule for ${domain}...`);
                const [op] = await urlMapsClient.patch({
                    project: GCP_PROJECT_ID,
                    urlMap: LB_NAME,
                    urlMapResource: {
                        hostRules: newHostRules,
                        pathMatchers: newMatchers,
                        fingerprint: urlMap.fingerprint
                    }
                });
                await waitForOperation(op, 'Clean URL Map');
            }
        } catch (e) {
            console.warn(`[Cleanup] Failed to update URL map: ${e.message}`);
        }

        // 4. Delete Backend Bucket
        try {
            console.log(`[GCP] Deleting Backend Bucket '${bucketName}'...`);
            const [op] = await backendBucketsClient.delete({ project: GCP_PROJECT_ID, backendBucket: bucketName });
            await waitForOperation(op, 'Delete Backend Bucket');
        } catch (e) {
            console.warn(`[Cleanup] Failed to delete backend bucket: ${e.message}`);
        }

        console.log(`[GCP] Cleanup complete for ${domain}.`);

    } catch (error) {
        console.error(`[GCP] Critical Cleanup Error: ${error.message}`);
    }
}

/**
 * Main Orchestrator: Setup Domain for GCP LB (Scalable Version)
 * Uses Certificate Manager Maps.
 */
async function setupGCPDomain(domain, projectId, isManagedByUs = false) {
    try {
        console.log(`[GCP] Starting automated setup for ${domain} (Project: ${projectId})...`);
        
        // 1. Create Backend Bucket
        const backendBucketName = await ensureBackendBucket(projectId);
        
        // 2. Update URL Map
        await updateUrlMap(domain, backendBucketName);
        
        // 3. Create Certificate Manager Cert
        const certResourceName = await ensureCertificateManagerCert(domain);
        
        // 4. Add to Certificate Map (Scalable Attachment)
        await addCertificateToMap(domain, certResourceName);

        console.log(`[GCP] Setup triggered successfully. Propagation takes 5-10 mins.`);

        if (isManagedByUs) {
            await addDNSRecord(domain, GCP_LB_IP);
            return {
                status: 'CONFIGURED',
                ip: GCP_LB_IP,
                message: 'Domain Configured. SSL & DNS propagating.'
            };
        } else {
            return {
                status: 'ACTION_REQUIRED',
                ip: GCP_LB_IP,
                message: `Setup initiated. Please add an A Record for '${domain}' pointing to: ${GCP_LB_IP}`
            };
        }

    } catch (error) {
        console.error("Setup GCP Domain Failed:", error);
        
        // Attempt Cleanup
        await cleanupGCPDomain(domain, projectId);

        // Throw simple error for frontend
        throw new Error(`Automation failed: ${error.message}. Changes rolled back. Please try again.`);
    }
}

module.exports = { 
    checkAvailability, 
    purchaseDomain, 
    getSuggestions, 
    changeNameServers, 
    verifyDomainDNS,
    setupGCPDomain,
    checkSubdomainAvailability,
    cleanupGCPDomain,
    listDNSRecords,
    addDNSRecordGeneric,
    deleteDNSRecord
};

const { db } = require('./firebase');

/**
 * Validate Subdomain Format
 * @param {string} subdomain 
 */
function validateSubdomain(subdomain) {
    const re = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!re.test(subdomain)) {
        return { valid: false, error: 'Subdomain must use only lowercase letters, numbers, and hyphens.' };
    }
    if (subdomain.length < 3 || subdomain.length > 63) {
        return { valid: false, error: 'Subdomain length must be between 3 and 63 characters.' };
    }
    return { valid: true };
}

/**
 * Check if a subdomain is available in our system
 * @param {string} subdomain 
 */
async function checkSubdomainAvailability(subdomain) {
    const validation = validateSubdomain(subdomain);
    if (!validation.valid) {
        return { available: false, error: validation.error };
    }

    if (!db) {
        console.warn('DB not connected, assuming subdomain available (Dev mode).');
        return { available: true };
    }

    try {
        const snapshot = await db.collection('projects').where('subdomain', '==', subdomain).get();
        if (snapshot.empty) {
            return { available: true };
        } else {
            return { available: false, error: 'Subdomain is already taken.' };
        }
    } catch (error) {
        console.error('Subdomain check failed:', error);
        throw error;
    }
}