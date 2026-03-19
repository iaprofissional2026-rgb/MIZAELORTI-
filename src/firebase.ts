import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// We'll use a simpler approach for the config to avoid top-level await issues
// In AI Studio, the file exists. In external, we use env vars.
let firebaseConfig: any;

// This is a trick to handle the optional import without top-level await
// We'll try to use the injected config if available, otherwise fallback to env
try {
  // @ts-ignore
  const config = import.meta.glob('../firebase-applet-config.json', { eager: true });
  const configPath = '../firebase-applet-config.json';
  if (config[configPath]) {
    firebaseConfig = (config[configPath] as any).default;
  }
} catch (e) {
  // Ignore error
}

if (!firebaseConfig) {
  const env = (import.meta as any).env || {};
  firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)'
  };
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
