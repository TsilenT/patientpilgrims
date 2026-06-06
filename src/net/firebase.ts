import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth } from "firebase/auth";
import { getDatabase, type Database } from "firebase/database";
import { readFirebaseConfig } from "./config";

let app: FirebaseApp | null = null;
let db: Database | null = null;
let auth: Auth | null = null;

export function isFirebaseConfigured(): boolean {
  return readFirebaseConfig() !== null;
}

function ensureApp(): { db: Database; auth: Auth } {
  if (app === null) {
    const config = readFirebaseConfig();
    if (config === null) throw new Error("Firebase is not configured");
    app = initializeApp(config);
    db = getDatabase(app);
    auth = getAuth(app);
  }
  return { db: db!, auth: auth! };
}

/** Signs in anonymously (idempotent) and resolves the stable uid for this browser. */
export function ensureSignedIn(): Promise<string> {
  const { auth } = ensureApp();
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user.uid); }
    });
    signInAnonymously(auth).catch((e) => { unsub(); reject(e); });
  });
}

export function database(): Database {
  return ensureApp().db;
}
