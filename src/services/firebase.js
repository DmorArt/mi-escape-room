import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

// ============================================================
// 🔥 CONFIGURACIÓN DE FIREBASE
// ============================================================
// OPCIÓN 1: Modo local (sin Firebase) — funciona sin credenciales
// OPCIÓN 2: Modo Firebase — reemplaza las credenciales below
//
// Para obtener tus credenciales:
// 1. Ir a https://console.firebase.google.com
// 2. Crear o seleccionar un proyecto
// 3. Ir a Configuración del proyecto → General → Tus apps → App Web
// 4. Copiar el objeto firebaseConfig
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCVzt9g3sZtrd_Htngeqb9mOfkkuRg2S4U",
  authDomain: "escape-maker.firebaseapp.com",
  projectId: "escape-maker",
  storageBucket: "escape-maker.firebasestorage.app",
  messagingSenderId: "173138856190",
  appId: "1:173138856190:web:faa46e4d3d0287cacbbdaf",
  measurementId: "G-XJT0RL2S8G"
};

export const appId = "escape-room-editor";

// Detectar si Firebase está configurado (no son placeholders)
export const isFirebaseConfigured = firebaseConfig.apiKey !== "TU_API_KEY";

// --- Instancias de Firebase ---
let app = null;
let auth = null;
let db = null;

function getFirebaseApp() {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getAuthInstance() {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getDbInstance() {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

// --- Autenticación ---
export async function initAuth(customToken = null) {
  if (!isFirebaseConfigured) {
    console.warn("Firebase no configurado. Modo local activo.");
    return null;
  }
  try {
    const authInstance = getAuthInstance();
    if (customToken) {
      return await signInWithCustomToken(authInstance, customToken);
    } else {
      return await signInAnonymously(authInstance);
    }
  } catch (error) {
    console.error("Error en autenticación Firebase:", error);
    return null;
  }
}

export function onAuthChange(callback) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  const authInstance = getAuthInstance();
  return onAuthStateChanged(authInstance, callback);
}

// --- Firestore: Guardar / Cargar / Escuchar ---
export async function saveProjectToFirestore(projectId, projectData) {
  if (!isFirebaseConfigured) return false;
  try {
    const dbInstance = getDbInstance();
    await setDoc(doc(dbInstance, "apps", appId, "projects", projectId), {
      ...projectData,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Error guardando en Firestore:", error);
    return false;
  }
}

export async function loadProjectFromFirestore(projectId) {
  if (!isFirebaseConfigured) return null;
  try {
    const dbInstance = getDbInstance();
    const docSnap = await getDoc(doc(dbInstance, "apps", appId, "projects", projectId));
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error("Error cargando desde Firestore:", error);
    return null;
  }
}

export function subscribeToProject(projectId, callback) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  try {
    const dbInstance = getDbInstance();
    return onSnapshot(
      doc(dbInstance, "apps", appId, "projects", projectId),
      (docSnap) => {
        callback(docSnap.exists() ? docSnap.data() : null);
      },
      (error) => {
        console.error("Error en snapshot:", error);
        callback(null);
      }
    );
  } catch (error) {
    console.error("Error suscribiendo:", error);
    callback(null);
    return () => {};
  }
}
