
/* =====================================
   CONFIGURACIÓN DE FIREBASE
===================================== */

const firebaseConfig = {
  apiKey: "AIzaSyAwfedEQiPUHNUcnmESaJ5kbKnoe4AWhao",
  authDomain: "cafe-cecytem.firebaseapp.com",
  projectId: "cafe-cecytem",
  storageBucket: "cafe-cecytem.firebasestorage.app",
  messagingSenderId: "535224949028",
  appId: "1:535224949028:web:308825412007551d15fbb1"
};

/* =====================================
   CORREO DE LA ENCARGADA
===================================== */

const CORREOS_AUTORIZADOS = [
    "encargadacecyte@gmail.com"
];

/* =====================================
   INICIALIZAR FIREBASE
===================================== */

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

/* =====================================
   SERVICIOS DE FIREBASE
===================================== */

const auth = firebase.auth();
const db = firebase.firestore();

/* =====================================
   CONFIGURACIÓN LISTA
===================================== */

const esConfiguracionLista =
    firebaseConfig.apiKey !== "PEGA_AQUI_TU_API_KEY_ORIGINAL" &&
    firebaseConfig.apiKey.length > 0;

/* =====================================
   FUNCIONES GENERALES
===================================== */

const dinero = n =>
    new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
    }).format(Number(n) || 0);

const escapar = s =>
    String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

console.log("Firebase conectado correctamente.");
