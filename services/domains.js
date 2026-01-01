async function purchaseDomain(domainName) {
    console.log(`Purchasing domain: ${domainName}`);
     if (!process.env.GODADDY_KEY) {
        console.warn("GODADDY_KEY not found.");
        return false;
    }
    return true;
}

module.exports = { purchaseDomain };
