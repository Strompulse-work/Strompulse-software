import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAeNi3XLagU6LK1BZw-msoiwEXVMkOjXfk",
  authDomain: "simmodules.firebaseapp.com",
  databaseURL: "https://simmodules-default-rtdb.firebaseio.com",
  projectId: "simmodules",
  storageBucket: "simmodules.firebasestorage.app",
  messagingSenderId: "685883223446",
  appId: "1:685883223446:web:2d8eda35bc80914bd4c1b7"
};

// Initialize Firebase only if it hasn't been initialized already
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firebaseDb = getDatabase(app);