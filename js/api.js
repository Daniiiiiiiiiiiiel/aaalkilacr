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
//  getToken()   → lo busca en ambos almacenes.
//  clearToken() → lo elimina de ambos (usar en logout).

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


// ── safeFetch ─────────────────────────────────────────────────────────────────
//
//  Envuelve fetch en un try/catch para traducir errores de red (sin internet,
//  servidor caído, DNS fallido) en un mensaje legible para el usuario.
//
//  fetch lanza un TypeError cuando no hay conexión. Sin este wrapper, el catch
//  de app.js recibiría "Failed to fetch", que el usuario no entendería.

async function safeFetch(url, options = {}) {
    try {
        return await fetch(url, options);
    } catch {
        // TypeError: Failed to fetch → sin conexión o servidor inalcanzable
        throw new Error('Sin conexión. Verificá tu internet e intentá de nuevo.');
    }
}


// ── tryRefreshToken ───────────────────────────────────────────────────────────
//
//  POST /auth/refresh-token
//
//  Envía:   { token: string }  (el JWT actual, aunque haya expirado)
//  Espera:  200 OK  → { token: string }  (nuevo JWT válido)
//           401     → {}  (el refresh token también expiró → hay que volver a hacer login)
//
//  Uso interno de authFetch: el usuario nunca llama esta función directamente.
//  Si el refresh falla, borra el token viejo y redirige al login.

async function tryRefreshToken() {
    const token = getToken();
    if (!token) return false; // no hay token que refrescar

    try {
        const res = await fetch(`${API_BASE}/auth/refresh-token`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ token }),
        });
        if (!res.ok) return false; // el servidor rechazó el refresh

        const data    = await res.json();
        const remember = !!localStorage.getItem('token'); // mantiene la preferencia original
        saveToken(data.token, remember);
        return true; // token renovado exitosamente
    } catch {
        return false; // error de red durante el refresh
    }
}


// ── authFetch ─────────────────────────────────────────────────────────────────
//
//  Wrapper sobre safeFetch para peticiones autenticadas (rutas protegidas).
//  Adjunta automáticamente el JWT en Authorization: Bearer <token>.
//
//  Flujo cuando el servidor responde 401 (token expirado):
//    1. Llama a tryRefreshToken() para obtener un nuevo JWT.
//    2. Si logra renovarlo → reintenta la petición original con el nuevo token.
//    3. Si no puede renovar → borra el token y redirige al login.
//       El usuario tendrá que autenticarse de nuevo. Esto es el comportamiento
//       correcto: la sesión expiró por completo.
//
//  El parámetro _retry evita bucles infinitos: si el reintento también da 401,
//  se corta el ciclo y se desloguea al usuario.

async function authFetch(endpoint, options = {}, _retry = false) {
    const token = getToken();
    const res   = await safeFetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers, // permite sobrescribir headers desde el llamador
        },
    });

    // Si el servidor rechaza por token expirado y no es ya un reintento:
    if (res.status === 401 && !_retry) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
            return authFetch(endpoint, options, true); // reintenta con el nuevo token
        }
        // No se pudo renovar → sesión caducada por completo
        clearToken();
        window.location.href = '/'; // redirige al login
        return res; // no se usa, pero evita que el llamador explote
    }

    return res;
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
//  Solo guarda el token. La redirección la maneja app.js para que
//  en el futuro se pueda redirigir al usuario a donde estaba antes del login
//  sin tocar esta función.

async function loginUser(email, password, remember) {
    const res  = await safeFetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, remember }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error al iniciar sesión.');
    saveToken(data.token, remember); // guarda el token según la preferencia "Recuérdame"
}


// ── sendResetEmail ────────────────────────────────────────────────────────────
//
//  POST /auth/forgot-password
//
//  Envía:   { email: string }
//  Espera:  200 OK  → {} (vacío; el servidor envió el OTP al email)
//           404     → { message: string }  (email no registrado)
//
//  No devuelve nada. Si falla, lanza un Error que app.js captura y muestra inline.

async function sendResetEmail(email) {
    const res = await safeFetch(`${API_BASE}/auth/forgot-password`, {
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
//  El backend verifica que el OTP coincida y no haya expirado (normalmente 10–15 min).

async function verifyOtp(email, otp) {
    const res  = await safeFetch(`${API_BASE}/auth/verify-otp`, {
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
    const res = await safeFetch(`${API_BASE}/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Error al restablecer la contraseña.');
    }
}
