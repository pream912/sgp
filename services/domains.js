const axios = require('axios');
const dns = require('dns').promises;
const { addZone, linkDomainToProject } = require('./cloudflare');
require('dotenv').config();

const NAMESILO_API_KEY = process.env.NAMESILO_KEY;
const ENV = process.env.NAMESILO_ENV || 'PROD';

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
        // We purchase it first. Setup happens later or via webhooks/next step.
        const data = await callNameSilo('registerDomain', {
            domain: domain,
            years: 1,
            private: 1,
            auto_renew: 1
        });
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
 * Update NameServers at NameSilo
 */
async function changeNameServers(domain, nsArray) {
    console.log(`Updating NameServers for ${domain} to: ${nsArray.join(', ')}`);
    
    // NameSilo expects ns1, ns2, etc.
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
 * Verify if domain is using Cloudflare Nameservers
 */
async function verifyNameservers(domain) {
    try {
        console.log(`Verifying NS for ${domain}...`);
        const nsRecords = await dns.resolveNs(domain);
        const isCloudflare = nsRecords.some(ns => ns.includes('cloudflare.com'));
        return { verified: isCloudflare, currentNs: nsRecords };
    } catch (error) {
        console.warn(`NS lookup failed for ${domain}:`, error.message);
        return { verified: false, error: error.message };
    }
}

/**
 * Main Orchestrator: Setup Domain on Cloudflare
 * 1. Add Zone to Cloudflare
 * 2. Link to Pages Project
 * 3. Update NameSilo NS (if we manage it)
 * @param {string} domain 
 * @param {string} projectId 
 * @param {boolean} isManagedByUs - If true, we update NS automatically
 */
async function setupCloudflareDomain(domain, projectId, isManagedByUs = false) {
    try {
        // 1. Add to Cloudflare (Get assigned NS)
        const zone = await addZone(domain);
        
        // 2. Link to Pages Project
        await linkDomainToProject(`site-${projectId}`, domain);

        // 3. Update NS (if managed)
        if (isManagedByUs && zone.name_servers && zone.name_servers.length > 0) {
            await changeNameServers(domain, zone.name_servers);
            return {
                status: 'CONFIGURED',
                nameservers: zone.name_servers,
                message: 'Domain purchased and configured. Propagation takes 24-48h.'
            };
        } else {
            // Return NS for user to update manually
            return {
                status: 'ACTION_REQUIRED',
                nameservers: zone.name_servers,
                message: 'Please update your NameServers to the ones provided.'
            };
        }

    } catch (error) {
        console.error("Setup Cloudflare Domain Failed:", error);
        throw error;
    }
}

module.exports = { 
    checkAvailability, 
    purchaseDomain, 
    getSuggestions, 
    changeNameServers, 
    verifyNameservers,
    setupCloudflareDomain
};