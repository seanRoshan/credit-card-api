import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase configuration for Credit Card API project
const firebaseConfig = {
  apiKey: 'AIzaSyBkaHxUabmQ88yVcl3VYwa5ZCTnwDjx0b4',
  authDomain: 'credit-card-api-app.firebaseapp.com',
  projectId: 'credit-card-api-app',
  storageBucket: 'credit-card-api-app.firebasestorage.app',
  messagingSenderId: '999336300297',
  appId: '1:999336300297:web:256bce74d6dff7513b0dd8',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

export default app;
