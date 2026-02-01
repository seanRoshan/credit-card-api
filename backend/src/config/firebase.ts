import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as path from 'path';
import * as fs from 'fs';

// Path to service account key
const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

// Check if service account exists
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase service account key not found!');
  console.error('Please download your service account key from Firebase Console:');
  console.error('1. Go to Project Settings > Service Accounts');
  console.error('2. Click "Generate new private key"');
  console.error(`3. Save the file as: ${serviceAccountPath}`);
  process.exit(1);
}

// Initialize Firebase Admin
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'credit-card-api-images',
});

export const db = getFirestore();
export const storage = getStorage();
export const bucket = storage.bucket();

console.log('✅ Firebase initialized successfully');
console.log(`   Project: ${serviceAccount.project_id}`);
