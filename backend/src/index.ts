import * as functions from 'firebase-functions';
import app from './app';

// Export Express app as Firebase Cloud Function
export const api = functions.https.onRequest(app);
