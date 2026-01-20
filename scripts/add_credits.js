const { addCredits } = require('../services/credits');
const { admin } = require('../services/firebase');

// Usage: node scripts/add_credits.js <UID> <AMOUNT>
// Example: node scripts/add_credits.js abc12345 1000

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.error('Usage: node scripts/add_credits.js <UID> <AMOUNT>');
        process.exit(1);
    }

    const userId = args[0];
    const amount = parseInt(args[1], 10);

    if (isNaN(amount)) {
        console.error('Amount must be a number');
        process.exit(1);
    }

    console.log(`Adding ${amount} credits to user: ${userId}...`);

    try {
        await addCredits(userId, amount, 'Manual adjustment via CLI script', 'manual-' + Date.now());
        console.log('Success!');
        process.exit(0);
    } catch (error) {
        console.error('Failed:', error.message);
        process.exit(1);
    }
}

main();
