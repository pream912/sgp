require('dotenv').config();
const { callNameSilo } = require('./services/domains');

async function fixDNS() {
    try {
        console.log("Checking DNS...");
        // This is handled by curl above.
    } catch(e) { console.error(e); }
}
