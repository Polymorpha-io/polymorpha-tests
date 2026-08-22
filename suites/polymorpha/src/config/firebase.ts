import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

/**
 * Initialize Firebase services. Call once at app bootstrap with config from appsettings.json.
 * If config is empty/missing, Firebase features are disabled gracefully.
 */
export function initFirebase(config: FirebaseConfig): boolean {
  if (!config.apiKey || !config.projectId) {
    return false;
  }
  app = initializeApp(config);
  auth = getAuth(app);
  // Keep the auth session in localStorage (not IndexedDB): it survives
  // Playwright storageState capture and is the SDK's classic default.
  void setPersistence(auth, browserLocalPersistence);
  // Offline-capable local cache: workspace metadata + recent reads are served
  // from IndexedDB instantly on repeat visits (multi-tab safe).
  db = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    "polymorpha-io",
  );
  storage = getStorage(app);
  return true;
}

export function getFirebaseAuth(): Auth | null {
  return auth;
}

export function getFirebaseDb(): Firestore | null {
  return db;
}

export function getFirebaseStorage(): FirebaseStorage | null {
  return storage;
}

export function isFirebaseEnabled(): boolean {
  return app !== null;
}
