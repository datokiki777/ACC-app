import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Public client config — safe to embed; access is enforced by Firestore security rules
// and the Authorized domains list, not by keeping this secret.
const firebaseConfig = {
  apiKey: 'AIzaSyBgyAE7fTqk5YsyHO-THoyVtDWB8SnTwvI',
  authDomain: 'client-totals-sync.firebaseapp.com',
  projectId: 'client-totals-sync',
  storageBucket: 'client-totals-sync.firebasestorage.app',
  messagingSenderId: '69584526058',
  appId: '1:69584526058:web:4c30e45583eac0036f5593',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const googleAuthProvider = new GoogleAuthProvider();
