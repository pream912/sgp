const admin = require('firebase-admin');
require('dotenv').config({ override: true });

let db;
let auth;

try {
  // Check if we have the service account key path or JSON content
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let serviceAccount;
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (parseError) {
        console.error('CRITICAL: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON.');
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (raw) {
            console.error('Raw content length:', raw.length);
            console.error('First 100 chars:', raw.substring(0, 100));
            console.error('Last 100 chars:', raw.substring(raw.length - 100));
            // Check for literal newlines
            console.error('Contains literal newline chars:', raw.includes('\n'));
        }
        throw parseError;
    }

    // Fix private_key newlines if they are escaped (common issue with .env)
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin Initialized successfully.');
  } else {
    console.warn('WARNING: FIREBASE_SERVICE_ACCOUNT not found in .env. Firebase features will not work.');
    // Initialize with default credentials (useful for GCP environments) or mock for dev if needed
    // admin.initializeApp(); 
  }

  if (admin.apps.length) {
      db = admin.firestore();
      auth = admin.auth();
  }
} catch (error) {
  console.error('Firebase Initialization Error:', error);
}

module.exports = { admin, db, auth };
