import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const emulator = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST,
  );
  if (!emulator && !process.env.FIREBASE_PROJECT_ID) {
    // Firebase App Hosting supplies FIREBASE_CONFIG and application-default
    // credentials to the Admin SDK. Avoid duplicating that platform config.
    return initializeApp();
  }
  return initializeApp({
    ...(emulator ? {} : { credential: applicationDefault() }),
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export const adminAuth = () => getAuth(getAdminApp());
export const adminDb = () => getFirestore(getAdminApp());
export const adminStorage = () => getStorage(getAdminApp());
