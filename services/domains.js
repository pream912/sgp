const axios = require('axios');
require('dotenv').config();

const NAMESILO_API_KEY = process.env.NAMESILO_KEY;
const ENV = process.env.NAMESILO_ENV || 'PROD'; // Default to PROD as Sandbox is unreliable

// NameSilo API URLs
const BASE_URL = ENV === 'PROD' 
    ? 'https://www.namesilo.com/api' 
    : 'https://sandbox.namesilo.com/api';

// Helper to format price (NameSilo returns standard USD)
function formatPrice(priceUSD) {
    if (!priceUSD) return null;
    const rate = 85; // Approx 1 USD = 85 INR
    const priceINR = Math.round(parseFloat(priceUSD) * rate);
    
    return {
        amount: priceINR,
        currency: 'INR',
        display: `₹${priceINR.toLocaleString('en-IN')}`
    };
}

// Helper to make NameSilo Request
async function callNameSilo(operation, params = {}) {
    if (!NAMESILO_API_KEY) {
        throw new Error("NameSilo API credentials missing.");
    }

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
        const code = String(data.code); // Convert to string to be safe
        
        if (code !== '300' && code !== '301' && code !== '250') {
             // 300=Success, 301=Successful(some details), 250=Domain Available
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
    console.log(`Checking availability for: ${domain} in ${ENV}...`);
    
    try {
        const data = await callNameSilo('checkRegisterAvailability', { domains: domain });
        
        // NameSilo returns 'available' object
        // Structure: data.available.domain (if single) or array
        
        const availableData = data.available ? data.available.domain : null;
        const unavailableData = data.unavailable ? data.unavailable.domain : null;

        if (availableData) {
             // It is available
             // Sandbox might not return price, or returns standard price.
             // data.available.domain.price exists
             const price = availableData.price || '10.95'; // Fallback if missing
             
             return {
                 domain: availableData.name || domain,
                 available: true,
                 price: parseFloat(price) * 1000000, // Matching previous GoDaddy micro-unit format for frontend compat? Or just standard? 
                 // Frontend expects micro-units / 1000000. Let's fix frontend or adapt here.
                 // Let's adapt here to match GoDaddy structure for minimal frontend breakage.
                 // GoDaddy price 1000000 = $1.00. 
                 // So NameSilo 10.95 -> 10950000.
                 priceDisplay: formatPrice(price),
                 currency: 'USD'
             };
        } else if (unavailableData) {
            return {
                domain: domain,
                available: false,
                error: null
            };
        } else {
             // Sometimes response is empty if invalid
             return { domain, available: false, error: "Invalid response from registrar" };
        }

    } catch (error) {
        return { domain, available: false, error: error.message };
    }
}

async function getSuggestions(query, limit = 5) {
    // NameSilo doesn't have "suggest". We will generate standard TLD variations.
    const tlds = ['com', 'net', 'org', 'co', 'info', 'biz', 'online'];
    const baseName = query.split('.')[0];
    
    // Generate list
    const candidates = tlds.map(tld => `${baseName}.${tld}`).slice(0, 10); // Check up to 10
    const domainsStr = candidates.join(',');
    
    console.log(`Fetching suggestions (checking variations) for: ${baseName}...`);

    try {
        const data = await callNameSilo('checkRegisterAvailability', { domains: domainsStr });
        
        const available = data.available ? (Array.isArray(data.available.domain) ? data.available.domain : [data.available.domain]) : [];
        
        // Map to our format
        return available.slice(0, limit).map(d => ({
            domain: d.name,
            available: true,
            price: parseFloat(d.price) * 1000000,
            currency: 'USD',
            priceDisplay: formatPrice(d.price)
        }));

    } catch (error) {
        console.error("Suggestion check failed:", error);
        return [];
    }
}

async function purchaseDomain(domain, details) {
    console.log(`Purchasing domain: ${domain} in ${ENV}...`);
    
    // NameSilo registerDomain
    // Required: domain, years, private, auto_renew
    // We strictly use private=1 and auto_renew=1
    
    try {
        const data = await callNameSilo('registerDomain', {
            domain: domain,
            years: 1,
            private: 1,
            auto_renew: 1
        });
        
        return {
            orderId: data.message || 'SUCCESS', // NameSilo doesn't return discrete order ID in sandbox sometimes
            domain: domain,
            status: 'PENDING', // Async
            total: 0 // Unknown from this response
        };
    } catch (error) {
        throw new Error(error.message);
    }
}

async function updateDnsRecords(domain, records) {
    console.log(`Updating DNS for ${domain}...`);
    // NameSilo DNS is complex: list -> delete -> add.
    // For MVP, we just ADD the A record (host=@).
    
    try {
        // records: [{ type: 'A', name: '@', data: '1.2.3.4' }]
        for (const record of records) {
            if (record.type === 'A') {
                // dnsAddRecord
                // rrhost: The hostname (e.g. "www" or just leave empty for apex?)
                // NameSilo: rrhost= (empty for @), rrvalue=IP, rrttl=3600
                
                const rrhost = record.name === '@' ? '' : record.name;
                
                await callNameSilo('dnsAddRecord', {
                    domain: domain,
                    rrtype: 'A',
                    rrhost: rrhost,
                    rrvalue: record.data,
                    rrttl: 7207 // Standard
                });
            }
        }
        return { success: true };
    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = { checkAvailability, purchaseDomain, getSuggestions, updateDnsRecords };
