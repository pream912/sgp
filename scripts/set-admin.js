#!/usr/bin/env node
/**
 * Promote a user to admin in D1.
 * Usage: node scripts/set-admin.js <email>
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../services/db');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/set-admin.js <email>');
    process.exit(1);
  }
  const user = await db.one('SELECT id, email, is_admin FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  await db.exec('UPDATE users SET is_admin = 1 WHERE id = ?', [user.id]);
  console.log(`Granted admin to ${user.email} (uid ${user.id}).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
