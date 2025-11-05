// src/firebaseConfig.js
const admin = require('firebase-admin');

let db;

// Initialize Firebase Admin SDK
try {
  // Use environment variables instead of JSON file
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Fix newlines
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: "googleapis.com"
  };

  // Initialize the app with the service account credentials
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
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