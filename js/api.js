'use strict';

// ══════════════════════════════════════════════════════════════════════════════
//  api.js  –  Capa de comunicación con el backend
//
//  Responsabilidad única: todas las llamadas HTTP viven aquí.
//  El resto de archivos nunca usan fetch directamente.
//
//  ┌─ MODO MOCK (MOCK = true) ──────────────────────────────────────────────┐
//  │  Simula las respuestas del servidor con un pequeño delay artificial.   │
//  │  Útil mientras el backend no está listo.                               │
//  │  Código OTP de prueba: 123456                                          │
//  │  Cambiar MOCK = false y ajustar API_BASE cuando el backend esté listo. │
//  └───────────────────────────────────────────────────────────────────────-┘
// ══════════════════════════════════════════════════════════════════════════════

const MOCK     = true;                    // ← cambiar a false en producción
const API_BASE = 'https://api.alkila.cr/v1'; // ← URL real del backend

// Simula latencia de red (solo en MOCK).
const delay = ms => new Promise(r => setTimeout(r, ms));


// ── TOKEN ─────────────────────────────────────────────────────────────────────
//
//  Problema original: el token se guardaba en localStorage pero nunca se usaba.
//  Solución: saveToken() decide dónde guardarlo según "Recuérdame",
//            y getToken() lo busca en ambos almacenes.
//
//  localStorage   → persiste aunque el usuario cierre el navegador (sesión larga)
//  sessionStorage → se borra al cerrar la pestaña/navegador   (sesión corta)

function saveToken(token, remember) {
    if (remember) {
        localStorage.setItem('token', token);   // sesión persistente
    } else {
        sessionStorage.setItem('token', token); // sesión temporal
    }
}

function getToken() {
    // Busca primero en localStorage; si no hay, en sessionStorage.
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
}

function clearToken() {
    localStorage.removeItem('token');   // limpia ambos al hacer logout
    sessionStorage.removeItem('token');
}


// ── authFetch ─────────────────────────────────────────────────────────────────
//
//  Wrapper sobre fetch que añade automáticamente el header de autorización.
//  Usar para CUALQUIER endpoint protegido (dashboard, perfil, listings, etc.).
//
//  Backend espera:  Authorization: Bearer <jwt-token>
//  El token fue emitido por el servidor en el login y guardado por saveToken().

async function authFetch(endpoint, options = {}) {
    const token = getToken();
    return fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}), // adjunta token si existe
            ...options.headers, // permite sobrescribir headers desde el llamador
        },
    });
}


// ── loginUser ─────────────────────────────────────────────────────────────────
//
//  POST /auth/login
//
//  Envía:   { email: string, password: string, remember: boolean }
//  Espera:  200 OK  → { token: string, user: { id, name, role } }
//           401     → { message: string }  (credenciales incorrectas)
//           400     → { message: string }  (campos inválidos)
//
//  Si el login es exitoso:
//    - Guarda el token según "remember" (ver saveToken).
//    - Redirige a /dashboard.

async function loginUser(email, password, remember) {
    if (MOCK) {
        await delay(900); // simula latencia
        // Validación mock: email válido + contraseña de al menos 8 caracteres → éxito
        if (!email.includes('@') || password.length < 8) {
            throw new Error('Credenciales incorrectas. Verifica tu email y contraseña.');
        }
        saveToken('mock-jwt-token-abc123', remember);
        window.location.href = '/dashboard'; // en real también redirige aquí
        return;
    }

    // ── REAL ──────────────────────────────────────────────────────────────────
    const res  = await fetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, remember }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al iniciar sesión.');
    saveToken(data.token, remember);
    window.location.href = '/dashboard';
}


// ── sendResetEmail ────────────────────────────────────────────────────────────
//
//  POST /auth/forgot-password
//
//  Envía:   { email: string }
//  Espera:  200 OK  → {} (vacío; el servidor ya mandó el correo)
//           404     → { message: string }  (email no registrado)
//
//  No devuelve nada. Si falla, lanza un Error que app.js captura.

async function sendResetEmail(email) {
    if (MOCK) {
        await delay(700);
        // En mock siempre tiene éxito (cualquier email "existe")
        return;
    }

    // ── REAL ──────────────────────────────────────────────────────────────────
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'No se pudo enviar el correo.');
    }
}


// ── verifyOtp ─────────────────────────────────────────────────────────────────
//
//  POST /auth/verify-otp
//
//  Envía:   { email: string, otp: string }  (otp = 6 dígitos como string)
//  Espera:  200 OK  → { verified: true }
//           400     → { verified: false, message: string }  (código incorrecto)
//
//  El backend verifica que el código coincida con el enviado al email
//  y que no haya expirado (normalmente 10–15 min de validez).

async function verifyOtp(email, otp) {
    if (MOCK) {
        await delay(700);
        // Código correcto de prueba: 123456
        if (otp !== '123456') throw new Error('Código incorrecto. Intenta de nuevo.');
        return;
    }

    // ── REAL ──────────────────────────────────────────────────────────────────
    const res  = await fetch(`${API_BASE}/auth/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok || !data.verified) throw new Error(data.message || 'Código incorrecto. Intenta de nuevo.');
}


// ── resetPassword ─────────────────────────────────────────────────────────────
//
//  POST /auth/reset-password
//
//  Envía:   { email: string, password: string }
//  Espera:  200 OK  → {} (vacío; contraseña actualizada)
//           400     → { message: string }  (contraseña débil u otro error)
//
//  El backend invalida el OTP usado y actualiza la contraseña del usuario.

async function resetPassword(email, password) {
    if (MOCK) {
        await delay(800);
        return; // siempre éxito en mock
    }

    // ── REAL ──────────────────────────────────────────────────────────────────
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Error al restablecer la contraseña.');
    }
}
