export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  appId: string;
}

/** Reads Vite env. Returns null when not configured (→ hotseat-only). */
export function readFirebaseConfig(): FirebaseConfig | null {
  const env = import.meta.env;
  const databaseURL = env.VITE_FIREBASE_DATABASE_URL as string | undefined;
  const apiKey = env.VITE_FIREBASE_API_KEY as string | undefined;
  if (!databaseURL || !apiKey) return null;
  return {
    apiKey,
    authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ?? "",
    databaseURL,
    projectId: (env.VITE_FIREBASE_PROJECT_ID as string | undefined) ?? "",
    appId: (env.VITE_FIREBASE_APP_ID as string | undefined) ?? "",
  };
}
