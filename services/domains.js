const axios = require('axios');
const dns = require('dns').promises;
require('dotenv').config();

// Cloudflare API
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

// NameSilo fallback (for .in domains and TLDs not supported by CF)
const NAMESILO_API_KEY = process.env.NAMESILO_KEY;
const NAMESILO_ENV = process.env.NAMESILO_ENV || 'PROD';
const NAMESILO_BASE_URL = NAMESILO_ENV === 'PROD'
    ? 'https://www.namesilo.com/api'
    : 'https://sandbox.namesilo.com/api';

// TLDs that must use NameSilo (CF Registrar doesn't support these)
const NAMESILO_ONLY_TLDS = ['.in', '.co.in', '.us'];

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

function shouldUseNameSilo(domain) {
    return NAMESILO_ONLY_TLDS.some(tld => domain.toLowerCase().endsWith(tld));
}

// --- Cloudflare API helpers ---

async function cfApi(method, path, body = null) {
    if (!CF_API_TOKEN) throw new Error('CF_API_TOKEN not configured');
    const config = {
        method,
        url: `${CF_API_BASE}${path}`,
        headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
    };
    if (body) config.data = body;

    const response = await axios(config);
    if (!response.data.success) {
        const errors = response.data.errors?.map(e => e.message).join(', ') || 'Unknown CF API error';
        throw new Error(`Cloudflare API Error: ${errors}`);
    }
    return response.data;
}

// --- NameSilo fallback helpers ---

async function callNameSilo(operation, params = {}) {
    if (!NAMESILO_API_KEY) throw new Error('NameSilo API credentials missing.');
    try {
        const response = await axios.get(`${NAMESILO_BASE_URL}/${operation}`, {
            params: { version: 1, type: 'json', key: NAMESILO_API_KEY, ...params }
        });
        const data = response.data.reply;
        const code = String(data.code);
        if (code !== '300' && code !== '301' && code !== '250') {
            throw new Error(data.detail || `NameSilo API Error: ${code}`);
        }
        return data;
    } catch (error) {
        console.error(`NameSilo Request Failed [${operation}]:`, error.message);
        throw error;
    }
}

// --- Domain availability ---

async function checkAvailability(domain) {
    console.log(`Checking availability for: ${domain}...`);

    if (shouldUseNameSilo(domain)) {
        return checkAvailabilityNameSilo(domain);
    }

    try {
        // CF Registrar: check domain availability
        const data = await cfApi('POST', `/accounts/${CF_ACCOUNT_ID}/registrar/domains/check`, {
            domains: [domain]
        });

        const result = data.result?.[0];
        if (result && result.available) {
            return {
                domain: domain,
                available: true,
                price: parseFloat(result.price?.registration_price || '10') * 1000000,
                priceDisplay: formatPrice(result.price?.registration_price || '10'),
                currency: 'USD'
            };
        }
        return { domain, available: false, error: null };
    } catch (error) {
        // Fallback to NameSilo if CF API fails
        console.warn(`CF availability check failed, falling back to NameSilo: ${error.message}`);
        return checkAvailabilityNameSilo(domain);
    }
}

async function checkAvailabilityNameSilo(domain) {
    try {
        const data = await callNameSilo('checkRegisterAvailability', { domains: domain });
        const availableData = data.available ? data.available.domain : null;
        if (availableData) {
            const price = availableData.price || '10.95';
            return {
                domain: availableData.name || domain,
                available: true,
                price: parseFloat(price) * 1000000,
                priceDisplay: formatPrice(price),
                currency: 'USD'
            };
        }
        return { domain, available: false, error: null };
    } catch (error) {
        return { domain, available: false, error: error.message };
    }
}

// --- Domain suggestions ---

async function getSuggestions(query, limit = 5) {
    const tlds = ['com', 'net', 'org', 'co', 'info', 'biz', 'online'];
    const baseName = query.split('.')[0];
    const candidates = tlds.map(tld => `${baseName}.${tld}`).slice(0, 10);

    try {
        // Try CF bulk check first
        const data = await cfApi('POST', `/accounts/${CF_ACCOUNT_ID}/registrar/domains/check`, {
            domains: candidates
        });

        const available = (data.result || [])
            .filter(d => d.available)
            .slice(0, limit)
            .map(d => ({
                domain: d.domain,
                available: true,
                price: parseFloat(d.price?.registration_price || '10') * 1000000,
                currency: 'USD',
                priceDisplay: formatPrice(d.price?.registration_price || '10')
            }));

        return available;
    } catch (error) {
        // Fallback to NameSilo
        console.warn(`CF suggestions failed, falling back to NameSilo: ${error.message}`);
        const domainsStr = candidates.join(',');
        try {
            const data = await callNameSilo('checkRegisterAvailability', { domains: domainsStr });
            const avail = data.available ? (Array.isArray(data.available.domain) ? data.available.domain : [data.available.domain]) : [];
            return avail.slice(0, limit).map(d => ({
                domain: d.name,
                available: true,
                price: parseFloat(d.price) * 1000000,
                currency: 'USD',
                priceDisplay: formatPrice(d.price)
            }));
        } catch {
            return [];
        }
    }
}

// --- Domain purchase ---

const indianStates = {
    'AP': 'Andhra Pradesh', 'AR': 'Arunachal Pradesh', 'AS': 'Assam', 'BR': 'Bihar',
    'CG': 'Chhattisgarh', 'CH': 'Chandigarh', 'DN': 'Dadra and Nagar Haveli',
    'DD': 'Daman and Diu', 'DL': 'Delhi', 'GA': 'Goa', 'GJ': 'Gujarat',
    'HR': 'Haryana', 'HP': 'Himachal Pradesh', 'JK': 'Jammu and Kashmir',
    'JH': 'Jharkhand', 'KA': 'Karnataka', 'KL': 'Kerala', 'LA': 'Ladakh',
    'LD': 'Lakshadweep', 'MP': 'Madhya Pradesh', 'MH': 'Maharashtra',
    'MN': 'Manipur', 'ML': 'Meghalaya', 'MZ': 'Mizoram', 'NL': 'Nagaland',
    'OR': 'Odisha', 'PY': 'Puducherry', 'PB': 'Punjab', 'RJ': 'Rajasthan',
    'SK': 'Sikkim', 'TN': 'Tamil Nadu', 'TS': 'Telangana', 'TR': 'Tripura',
    'UP': 'Uttar Pradesh', 'UK': 'Uttarakhand', 'WB': 'West Bengal'
};

function sanitizeForRegistry(str) {
    if (!str) return str;
    return str.toString().replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function purchaseDomain(domain, details) {
    console.log(`Purchasing domain: ${domain}...`);

    if (shouldUseNameSilo(domain)) {
        return purchaseDomainNameSilo(domain, details);
    }

    try {
        // CF Registrar: register domain
        const contact = details.contact || {};
        const data = await cfApi('POST', `/accounts/${CF_ACCOUNT_ID}/registrar/domains`, {
            name: domain,
            auto_renew: true,
            years: 1,
            registrant: {
                first_name: contact.nameFirst || 'GenWeb',
                last_name: contact.nameLast || 'User',
                email: contact.email,
                phone: contact.phone,
                address: contact.addressMailing?.address1,
                city: contact.addressMailing?.city,
                state: contact.addressMailing?.state,
                zip: contact.addressMailing?.postalCode,
                country: contact.addressMailing?.country || 'US',
            }
        });

        // After registration, domain is automatically on CF DNS — add custom domain to Worker
        await setupCFDomain(domain);

        return {
            orderId: data.result?.id || 'SUCCESS',
            domain: domain,
            status: 'CONFIGURED',
            total: 0
        };
    } catch (error) {
        console.warn(`CF registration failed, falling back to NameSilo: ${error.message}`);
        return purchaseDomainNameSilo(domain, details);
    }
}

async function purchaseDomainNameSilo(domain, details) {
    try {
        const isPrivacyAllowed = !domain.toLowerCase().endsWith('.in') && !domain.toLowerCase().endsWith('.us');
        const contact = details.contact || {};

        let state = contact.addressMailing?.state?.trim();
        const country = contact.addressMailing?.country?.trim() || 'US';

        if (country.toUpperCase() === 'IN' && state && state.length === 2) {
            state = indianStates[state.toUpperCase()] || state;
        }

        const params = {
            domain, years: 1, private: isPrivacyAllowed ? 1 : 0, auto_renew: 1,
            fn: sanitizeForRegistry(contact.nameFirst),
            ln: sanitizeForRegistry(contact.nameLast),
            ad: sanitizeForRegistry(contact.addressMailing?.address1),
            cy: sanitizeForRegistry(contact.addressMailing?.city),
            st: sanitizeForRegistry(state),
            zp: sanitizeForRegistry(contact.addressMailing?.postalCode),
            ct: country,
            em: contact.email?.trim(),
            ph: contact.phone?.trim()
        };
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

// --- DNS Management (Cloudflare) ---

async function getZoneId(domain) {
    // Get the root domain (e.g., example.com from www.example.com)
    const parts = domain.split('.');
    const rootDomain = parts.slice(-2).join('.');

    const data = await cfApi('GET', `/zones?name=${rootDomain}`);
    if (data.result && data.result.length > 0) {
        return data.result[0].id;
    }
    throw new Error(`Zone not found for ${rootDomain}`);
}

async function addDNSRecord(domain, ip) {
    console.log(`Setting up DNS for ${domain} (CF)...`);
    try {
        const zoneId = await getZoneId(domain);

        // Add A record (proxied through CF for SSL + CDN)
        await cfApi('POST', `/zones/${zoneId}/dns_records`, {
            type: 'A',
            name: domain,
            content: ip,
            proxied: true,
            ttl: 1, // Auto
        });

        // Add www CNAME
        try {
            await cfApi('POST', `/zones/${zoneId}/dns_records`, {
                type: 'CNAME',
                name: `www.${domain}`,
                content: domain,
                proxied: true,
                ttl: 1,
            });
        } catch (e) {
            console.warn('Failed to add WWW CNAME (might exist):', e.message);
        }

        return true;
    } catch (error) {
        throw error;
    }
}

async function listDNSRecords(domain) {
    try {
        console.log(`Listing DNS records for ${domain} (CF)...`);
        const zoneId = await getZoneId(domain);
        const data = await cfApi('GET', `/zones/${zoneId}/dns_records?name=${domain}`);
        return data.result || [];
    } catch (error) {
        throw error;
    }
}

async function addDNSRecordGeneric(domain, record) {
    console.log(`Adding DNS Record for ${domain}:`, record);
    try {
        const zoneId = await getZoneId(domain);
        const data = await cfApi('POST', `/zones/${zoneId}/dns_records`, {
            type: record.type,
            name: record.host || domain,
            content: record.value,
            ttl: record.ttl || 1,
            priority: record.distance || undefined,
            proxied: (record.type === 'A' || record.type === 'CNAME') ? true : false,
        });
        return { success: true, id: data.result?.id };
    } catch (error) {
        throw error;
    }
}

async function deleteDNSRecord(domain, recordId) {
    console.log(`Deleting DNS Record ${recordId} for ${domain} (CF)...`);
    try {
        const zoneId = await getZoneId(domain);
        await cfApi('DELETE', `/zones/${zoneId}/dns_records/${recordId}`);
        return { success: true };
    } catch (error) {
        throw error;
    }
}

// --- Domain setup for CF Worker ---

/**
 * Setup a custom domain to be served by the CF Worker.
 * For CF-registered domains, DNS is automatic.
 * For external domains, user needs to point NS to Cloudflare.
 */
async function setupCFDomain(domain, projectId, isManagedByUs = false) {
    try {
        console.log(`[CF] Setting up domain ${domain} for project ${projectId || 'N/A'}...`);

        // For CF-managed domains, just ensure DNS points to the Worker
        // The Worker handles routing via Firestore lookup
        // SSL is automatic via Cloudflare

        if (isManagedByUs) {
            // Domain is on CF — DNS is already managed
            console.log(`[CF] Domain ${domain} is CF-managed. SSL and CDN are automatic.`);
            return {
                status: 'CONFIGURED',
                message: 'Domain configured. SSL is automatic via Cloudflare.'
            };
        } else {
            // External domain — user needs to add CF nameservers or CNAME
            return {
                status: 'ACTION_REQUIRED',
                message: `Please update your domain's nameservers to Cloudflare, or add a CNAME record pointing to genweb.in`
            };
        }
    } catch (error) {
        console.error('Setup CF Domain Failed:', error);
        throw new Error(`Domain setup failed: ${error.message}`);
    }
}

/**
 * Cleanup domain resources (minimal in CF — no backend buckets, cert maps, etc.)
 */
async function cleanupCFDomain(domain, projectId) {
    console.log(`[CF] Cleaning up domain ${domain}...`);
    // In CF, there's no complex cleanup needed.
    // The Worker routes based on Firestore, so just updating Firestore is sufficient.
    // DNS records can be cleaned up if the domain is on CF.
    try {
        const zoneId = await getZoneId(domain);
        const records = await cfApi('GET', `/zones/${zoneId}/dns_records?name=${domain}`);
        for (const record of (records.result || [])) {
            await cfApi('DELETE', `/zones/${zoneId}/dns_records/${record.id}`);
        }
        console.log(`[CF] DNS records cleaned up for ${domain}`);
    } catch (e) {
        console.warn(`[CF] Cleanup skipped (zone may not exist): ${e.message}`);
    }
}

// --- DNS verification ---

async function verifyDomainDNS(domain) {
    try {
        console.log(`Verifying DNS for ${domain}...`);
        const addresses = await dns.resolve4(domain);
        // For CF, we check if it resolves to any Cloudflare IP (or just that it resolves)
        const isConnected = addresses.length > 0;
        return { verified: isConnected, currentIPs: addresses };
    } catch (error) {
        console.warn(`DNS lookup failed for ${domain}:`, error.message);
        return { verified: false, error: error.message };
    }
}

// --- Subdomain management ---

const db = require('./db');

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

async function checkSubdomainAvailability(subdomain) {
    const validation = validateSubdomain(subdomain);
    if (!validation.valid) {
        return { available: false, error: validation.error };
    }

    try {
        const existing = await db.one('SELECT id FROM projects WHERE subdomain = ?', [subdomain]);
        if (!existing) return { available: true };
        return { available: false, error: 'Subdomain is already taken.' };
    } catch (error) {
        console.error('Subdomain check failed:', error);
        throw error;
    }
}

module.exports = {
    checkAvailability,
    purchaseDomain,
    getSuggestions,
    verifyDomainDNS,
    setupCFDomain,
    cleanupCFDomain,
    checkSubdomainAvailability,
    listDNSRecords,
    addDNSRecordGeneric,
    deleteDNSRecord
};
