// src/firebaseConfig.js
const admin = require('firebase-admin');

let db;

function normalizePrivateKey(value) {
  if (!value || typeof value !== 'string') return value;
  return value.replace(/\\n/g, '\n');
}

function loadServiceAccountFromEnv() {
  // Option 1: full JSON in one env var (useful on Render)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      parsed.private_key = normalizePrivateKey(parsed.private_key);
      return parsed;
    } catch (error) {
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${error.message}`);
    }
  }

  // Option 2: split env vars
  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: 'googleapis.com'
  };

  return serviceAccount;
}

function validateServiceAccount(serviceAccount) {
  const required = ['project_id', 'client_email', 'private_key'];
  const missing = required.filter((key) => !serviceAccount[key] || String(serviceAccount[key]).trim() === '');

  if (missing.length > 0) {
    throw new Error(
      `Firebase credentials missing required fields: ${missing.join(', ')}. ` +
      'Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.'
    );
  }
}

// Initialize Firebase Admin SDK
try {
  if (!admin.apps.length) {
    const serviceAccount = loadServiceAccountFromEnv();
    validateServiceAccount(serviceAccount);

    // Initialize the app with the service account credentials
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  
  // Get the Firestore database instance
  db = admin.firestore();
  
  console.log('✅ Firebase Admin SDK Initialized & Firestore Connected');
} catch (error) {
  // This catch block handles the common "app already exists" error during hot-reloading
  if (!/already exists/i.test(error.message)) {
    console.error('❌ Firebase initialization error:', error.message);
    throw error;
  }
  // If the app already exists, just get the existing Firestore instance
  db = admin.firestore(); 
}

// Export the initialized database instance for all other services to use
module.exports = { db, admin };