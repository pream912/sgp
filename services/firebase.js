const admin = require('firebase-admin');
require('dotenv').config();

let db;
let auth;

try {
  // Check if we have the service account key path or JSON content
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
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
