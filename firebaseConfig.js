// src/firebaseConfig.js

const admin = require('firebase-admin');

// ⚠️ CRITICAL: Replace this path with the path to your downloaded JSON key
const serviceAccount = require('./serviceAccountKey.json'); 

let db;

// Initialize Firebase Admin SDK
try {
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