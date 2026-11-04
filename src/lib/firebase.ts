import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Falso cuando faltan las variables de entorno de Firebase: la app avisa en vez de fallar. */
export const firebaseConfigured: boolean = Boolean(config.apiKey && config.projectId && config.appId);

function app(): FirebaseApp {
  if (!firebaseConfigured) {
    throw new Error("Firebase no está configurado. Revisa las variables NEXT_PUBLIC_FIREBASE_* (ver README).");
  }
  return getApps().length > 0 ? getApp() : initializeApp(config);
}

export function auth(): Auth {
  return getAuth(app());
}

export function db(): Firestore {
  return getFirestore(app());
}
