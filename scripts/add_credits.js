#!/usr/bin/env node
/**
 * Add credits to a user (manual adjustment).
 * Usage: node scripts/add_credits.js <uid> <amount>
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { addCredits } = require('../services/credits');

async function main() {
  const [uid, amountStr] = process.argv.slice(2);
  if (!uid || !amountStr) {
    console.error('Usage: node scripts/add_credits.js <uid> <amount>');
    process.exit(1);
  }
  const amount = parseInt(amountStr, 10);
  if (isNaN(amount)) {
    console.error('Amount must be a number');
    process.exit(1);
  }
  console.log(`Adding ${amount} credits to user ${uid}...`);
  await addCredits(uid, amount, 'Manual adjustment via CLI script', 'manual-' + Date.now());
  console.log('Success!');
}

main().catch((err) => { console.error(err); process.exit(1); });
