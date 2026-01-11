const axios = require('axios');
require('dotenv').config();

const GODADDY_API_KEY = process.env.GODADDY_KEY;
const GODADDY_API_SECRET = process.env.GODADDY_SECRET;
const ENV = process.env.GODADDY_ENV || 'OTE'; // 'PROD' or 'OTE'

const BASE_URL = ENV === 'PROD' 
    ? 'https://api.godaddy.com' 
    : 'https://api.ote-godaddy.com';

const HEADERS = {
    'Authorization': `sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

// Helper to convert price (Micro-units)
// If currency is USD, convert to INR (Approx 1 USD = 85 INR)
function formatPrice(price, currency) {
    if (!price) return null;
    
    // Price is in micro-units (1/1,000,000)
    let value = price / 1000000;
    
    if (currency === 'USD') {
        value = value * 85; // Approx conversion
        currency = 'INR';
    }
    
    return {
        amount: Math.round(value),
        currency: currency,
        display: `₹${Math.round(value).toLocaleString('en-IN')}`
    };
}

async function checkAvailability(domain) {
    if (!GODADDY_API_KEY || !GODADDY_API_SECRET) {
        throw new Error("GoDaddy API credentials missing.");
    }

    try {
        console.log(`Checking availability for: ${domain} in ${ENV}...`);
        const response = await axios.get(`${BASE_URL}/v1/domains/available`, {
            params: { domain },
            headers: HEADERS
        });
        
        const data = response.data;
        if (data.price) {
            data.priceDisplay = formatPrice(data.price, data.currency);
        }
        
        return data;
    } catch (error) {
        console.error("GoDaddy Availability Check Failed:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Failed to check domain availability");
    }
}

async function purchaseDomain(domain, details) {
    if (!GODADDY_API_KEY || !GODADDY_API_SECRET) {
        throw new Error("GoDaddy API credentials missing.");
    }

    // Basic structure validation could happen here, but we'll rely on the API to validate details
    // details should contain: contactRegistrant, contactAdmin, contactTech, contactBilling, etc.
    
    // Construct the payload required by GoDaddy
    // NOTE: This is a simplified payload construction. 
    // In a real app, you'd likely map specific fields from 'details' to this structure to ensure safety.
    const payload = {
        domain: domain,
        consent: {
            agreedAt: new Date().toISOString(),
            agreedBy: details.ip || '127.0.0.1', // Should be passed from request
            agreementKeys: ['DNRA'] // "Domain Name Registration Agreement" - Standard for GoDaddy
        },
        period: 1,
        renewAuto: true,
        privacy: false,
        nameServers: details.nameServers, // Optional
        contactAdmin: details.contact,
        contactBilling: details.contact,
        contactRegistrant: details.contact,
        contactTech: details.contact
    };

    try {
        console.log(`Purchasing domain: ${domain} in ${ENV}...`);
        const response = await axios.post(`${BASE_URL}/v1/domains/purchase`, payload, {
            headers: HEADERS
        });
        return response.data;
    } catch (error) {
        console.error("GoDaddy Purchase Failed:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Failed to purchase domain");
    }
}

async function getSuggestions(query, limit = 5) {
    if (!GODADDY_API_KEY || !GODADDY_API_SECRET) {
        throw new Error("GoDaddy API credentials missing.");
    }

    try {
        console.log(`Fetching suggestions for: ${query} in ${ENV}...`);
        // 1. Get Suggestions
        const suggestResponse = await axios.get(`${BASE_URL}/v1/domains/suggest`, {
            params: { 
                query, 
                limit,
                tlds: ['com', 'net', 'org', 'co', 'io'].join(',') // Common TLDs
            },
            headers: HEADERS
        });
        
        const suggestions = suggestResponse.data;
        if (!suggestions || suggestions.length === 0) return [];

        // 2. Get Prices for Suggestions (Bulk Check)
        // suggestions is an array of objects: [{ domain: 'example.com' }, ...]
        const domainsToCheck = suggestions.map(s => s.domain);
        
        const availabilityResponse = await axios.post(`${BASE_URL}/v1/domains/available`, 
            domainsToCheck, 
            { headers: HEADERS }
        );

        // 3. Merge Price Data
        const availabilityMap = new Map();
        availabilityResponse.data.domains.forEach(d => {
            availabilityMap.set(d.domain, d);
        });

        return suggestions.map(s => {
            const avail = availabilityMap.get(s.domain);
            return {
                ...s,
                available: avail ? avail.available : false,
                price: avail ? avail.price : null,
                currency: avail ? avail.currency : null,
                priceDisplay: avail ? formatPrice(avail.price, avail.currency) : null
            };
        });

    } catch (error) {
        console.error("GoDaddy Suggestions Failed:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Failed to fetch domain suggestions");
    }
}

async function updateDnsRecords(domain, records) {
    if (!GODADDY_API_KEY || !GODADDY_API_SECRET) {
        throw new Error("GoDaddy API credentials missing.");
    }

    try {
        console.log(`Updating DNS records for: ${domain} in ${ENV}...`);
        // records should be an array of { type: 'A', name: '@', data: '1.2.3.4', ttl: 600 }
        const response = await axios.put(`${BASE_URL}/v1/domains/${domain}/records`, records, {
            headers: HEADERS
        });
        return response.data;
    } catch (error) {
        console.error("GoDaddy DNS Update Failed:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "Failed to update DNS records");
    }
}

module.exports = { checkAvailability, purchaseDomain, getSuggestions, updateDnsRecords };