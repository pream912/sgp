#!/usr/bin/env node

/**
 * Set admin custom claim on a Firebase user.
 * Usage: node scripts/set-admin-claim.js <USER_UID>
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { auth } = require('../services/firebase');

async function setAdminClaim(uid) {
  if (!uid) {
    console.error('Usage: node scripts/set-admin-claim.js <USER_UID>');
    process.exit(1);
  }

  if (!auth) {
    console.error('Firebase Auth not initialized. Check FIREBASE_SERVICE_ACCOUNT in .env');
    process.exit(1);
  }

  try {
    // Verify user exists
    const user = await auth.getUser(uid);
    console.log(`Found user: ${user.displayName || user.phoneNumber || user.email || uid}`);

    // Set admin claim
    await auth.setCustomUserClaims(uid, { admin: true });
    console.log(`Successfully set admin claim for user ${uid}`);

    // Verify
    const updated = await auth.getUser(uid);
    console.log('Custom claims:', updated.customClaims);
  } catch (error) {
    console.error('Failed to set admin claim:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

setAdminClaim(process.argv[2]);
