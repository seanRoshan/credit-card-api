import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as path from 'path';
import * as fs from 'fs';
import { config } from './env';

// Path to service account key
const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');

// Initialize Firebase Admin
let initialized = false;

function initializeFirebase(): void {
  if (initialized) return;

  // Check if running in Firebase Functions environment
  if (process.env.FUNCTIONS_EMULATOR || process.env.FIREBASE_CONFIG) {
    // Running in Firebase Functions - use default credentials
    admin.initializeApp({
      storageBucket: config.storageBucket,
    });
  } else if (fs.existsSync(serviceAccountPath)) {
    // Running locally with service account
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: config.storageBucket,
    });
    console.log('Firebase initialized with service account');
    console.log(`   Project: ${serviceAccount.project_id}`);
  } else {
    console.error('Firebase service account key not found!');
    console.error('Please copy serviceAccountKey.json to the scraper directory');
    console.error(`Expected path: ${serviceAccountPath}`);
    process.exit(1);
  }

  initialized = true;
}

initializeFirebase();

export const db = getFirestore();
export const storage = getStorage();
export const bucket = storage.bucket();
