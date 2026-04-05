import admin from "firebase-admin";
import fs from "node:fs";

let firestoreInstance = null;
let authInstance = null;

function readServiceAccountFile() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    return null;
  }

  const fileContents = fs.readFileSync(serviceAccountPath, "utf8");
  const serviceAccount = JSON.parse(fileContents);

  return {
    projectId: serviceAccount.project_id,
    clientEmail: serviceAccount.client_email,
    privateKey: serviceAccount.private_key,
  };
}

function buildCredentials() {
  const fileCredentials = readServiceAccountFile();

  if (fileCredentials) {
    return fileCredentials;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function getAdminApp() {
  const credentials = buildCredentials();

  if (!credentials) {
    throw new Error(
      "Firebase credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
  }

  return admin.app();
}

export function getFirestore() {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  firestoreInstance = getAdminApp().firestore();
  return firestoreInstance;
}

export function getAdminAuth() {
  if (authInstance) {
    return authInstance;
  }

  authInstance = getAdminApp().auth();
  return authInstance;
}
