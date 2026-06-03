'use strict';

// ══════════════════════════════════════════════════════════════════════════════
//  api.js  –  Capa de comunicación con el backend
//
//  Responsabilidad única: todas las llamadas HTTP viven aquí.
//  El resto de archivos nunca usan fetch directamente.
//
//  Cambiar API_BASE por la URL real del backend antes de desplegar.
// ══════════════════════════════════════════════════════════════════════════════

const API_BASE = 'https://api.alkila.cr/v1'; // ← URL base del backend


// ── TOKEN ─────────────────────────────────────────────────────────────────────
//
//  saveToken() decide dónde guardar el JWT según "Recuérdame":
//    localStorage   → persiste aunque el usuario cierre el navegador (sesión larga)
//    sessionStorage → se borra al cerrar la pestaña/navegador   (sesión corta)
//
//  getToken() lo busca en ambos almacenes para usarlo en peticiones protegidas.
//  clearToken() lo elimina de ambos al hacer logout.

function saveToken(token, remember) {
    if (remember) {
        localStorage.setItem('token', token);   // sesión persistente
    } else {
        sessionStorage.setItem('token', token); // sesión temporal
    }
}

function getToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
}

function clearToken() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
}


// ── authFetch ─────────────────────────────────────────────────────────────────
//
//  Wrapper sobre fetch que adjunta automáticamente el JWT en el header
//  Authorization: Bearer <token>.
//
//  Usar para CUALQUIER endpoint protegido (dashboard, perfil, listings, etc.).
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
//  Si el login es exitoso guarda el token (según "remember") y redirige al dashboard.

async function loginUser(email, password, remember) {
    const res  = await fetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, remember }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al iniciar sesión.');
    saveToken(data.token, remember);
    window.location.href = '/dashboard'; // redirige al dashboard tras login exitoso
}


// ── sendResetEmail ────────────────────────────────────────────────────────────
//
//  POST /auth/forgot-password
//
//  Envía:   { email: string }
//  Espera:  200 OK  → {} (vacío; el servidor ya mandó el correo con el OTP)
//           404     → { message: string }  (email no registrado)
//
//  No devuelve nada. Si falla, lanza un Error que app.js captura y muestra inline.

async function sendResetEmail(email) {
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
//           400     → { verified: false, message: string }  (código incorrecto o expirado)
//
//  El backend verifica que el OTP coincida con el enviado al email
//  y que no haya expirado (normalmente 10–15 min de validez).

async function verifyOtp(email, otp) {
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
