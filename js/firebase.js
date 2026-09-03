import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';

const firebaseConfig = {
  databaseURL: 'https://lubajar-e9c33-default-rtdb.firebaseio.com',
  apiKey: 'AIzaSyDFXRSkLxSN1L21bS8wAbKmYiQeDeaQkNw',
  authDomain: 'lubajar-e9c33.firebaseapp.com',
  projectId: 'lubajar-e9c33',
  storageBucket: 'lubajar-e9c33.firebasestorage.app',
  messagingSenderId: '996569909193',
  appId: '1:996569909193:web:5513b53986b24f9b3a4a18',
  measurementId: 'G-LFVJP15SM3'
};
export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
