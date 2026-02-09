const admin = require('firebase-admin');
require('dotenv').config({ path: '.env' });
// Also try to load env.yaml manually to check its format if possible, but dotenv is standard.
// We'll trust .env for now, but the issue is likely in Cloud Run's env.

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log('Successfully parsed JSON.');
  
  let key = serviceAccount.private_key;
  console.log('Original Key length:', key.length);
  
  if (key.includes('\\n')) {
      console.log('Key contains literal backslash-n.');
      key = key.replace(/\\n/g, '\n');
      console.log('Replaced \\n with newlines.');
  } else {
      console.log('Key does NOT contain literal backslash-n. Checking for actual newlines...');
      console.log('Has actual newlines:', key.includes('\n'));
  }

  console.log('First 50 chars:', key.substring(0, 50));
  
  // Try to create a credential to see if it throws
  const cred = admin.credential.cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: key
  });
  
  console.log('Credential created successfully.');
  
} catch (error) {
  console.error('Error:', error);
}
