'use strict';

// ══════════════════════════════════════════════════════════════════════════════
//  api.js (Auth)  –  Capa de datos para autenticación
//
//  Contiene tokens, safeFetch, authFetch, tryRefreshToken, getUserProfile
//  y todas las llamadas HTTP del flujo de login y registro.
//
//  Depende de: ../../js/core.js  (API_BASE)
// ══════════════════════════════════════════════════════════════════════════════


// ── TOKEN ─────────────────────────────────────────────────────────────────────
//
//  saveToken() decide dónde guardar el JWT según "Recuérdame":
//    localStorage   → persiste aunque el usuario cierre el navegador (sesión larga)
//    sessionStorage → se borra al cerrar la pestaña/navegador   (sesión corta)
//
//  getToken()   → lo busca en sessionStorage.
//  clearToken() → lo elimina de ambos (usar en logout).

function saveToken(accessToken, remember, refreshToken = null) {
    sessionStorage.setItem('token', accessToken); // El token normal siempre va en sessionStorage
    if (remember && refreshToken) {
        localStorage.setItem('refresh_token', refreshToken); // El refresh token va en localStorage si se activa "Recuérdame"
    } else if (!remember) {
        localStorage.removeItem('refresh_token'); // Limpiamos en caso contrario
    }
}

function getToken() {
    return sessionStorage.getItem('token') || null;
}

function getRefreshToken() {
    return localStorage.getItem('refresh_token') || null;
}

function clearToken() {
    sessionStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user_profile'); // Limpia el perfil de usuario al cerrar sesión
}

// ── PERFIL DE USUARIO ─────────────────────────────────────────────────────────
//
//  Persiste el objeto de perfil del usuario (nombre, avatar, rol) en
//  sessionStorage para que el dashboard pueda mostrar datos reales sin
//  un fetch adicional. Se limpia automáticamente al cerrar sesión.

function saveUserProfile(profile) {
    if (profile && typeof profile === 'object') {
        sessionStorage.setItem('user_profile', JSON.stringify(profile));
    }
}

function getUserProfile() {
    try {
        const raw = sessionStorage.getItem('user_profile');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
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
//  POST /auth/refresh_token
//
//  Envía:   { refresh_token: string }
//  Espera:  200 OK  → { token: string, refresh_token?: string }  (nuevo JWT válido)
//           401     → {}  (el refresh token también expiró → hay que volver a hacer login)
//
//  Uso interno de authFetch: el usuario nunca llama esta función directamente.
//  Si el refresh falla, borra el token viejo y redirige al login.

async function tryRefreshToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false; // no hay token de actualización

    try {
        const res = await fetch(`${API_BASE}/auth/refresh_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) {
            clearToken(); // El refresh token también expiró o es inválido en la DB → limpiamos
            return false;
        }

        const data = await res.json();

        // Guardamos los nuevos tokens manteniendo la persistencia
        saveToken(data.token, true, data.refresh_token || refreshToken);
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
//
//  El parámetro _retry evita bucles infinitos: si el reintento también da 401,
//  se corta el ciclo y se desloguea al usuario.

async function authFetch(endpoint, options = {}, _retry = false) {
    const token = getToken();
    const res = await safeFetch(`${API_BASE}${endpoint}`, {
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
        window.location.href = '../auth/index.html';
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
//
//  Solo guarda el token. La redirección la maneja app.js.

async function loginUser(email, password, remember) {
    const res = await safeFetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, remember }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error al iniciar sesión.');
    saveToken(data.token, remember, data.refresh_token); // guarda el token normal y el refresh token
    if (data.user) saveUserProfile(data.user); // Guarda perfil si el backend lo retorna
}

// ── sendResetEmail ────────────────────────────────────────────────────────────
//
//  POST /auth/send_otp
//  Envía: { email } → el servidor envía el OTP al email indicado.

async function sendResetEmail(email) {
    const res = await safeFetch(`${API_BASE}/auth/send_otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'No se pudo enviar el correo.');
    }
}

// ── verifyOtp ─────────────────────────────────────────────────────────────────
//
//  POST /auth/verify_otp
//
//  Envía:   { email, token (otp), type: 'recovery' }
//  Espera:  200 OK  → { token, refresh_token }  (tokens de recuperación)
//           400     → { detail }  (código incorrecto o expirado)

async function verifyOtp(email, otp) {
    const res = await safeFetch(`${API_BASE}/auth/verify_otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            token: otp,          // El backend espera "token" en vez de "otp"
            type: 'recovery'     // Flujo de recuperación de contraseña
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Código incorrecto. Intenta de nuevo.');

    // Guarda los tokens de recuperación directamente en el almacenamiento
    saveToken(data.token, true, data.refresh_token);
}

// ── resetPassword ─────────────────────────────────────────────────────────────
//
//  POST /auth/reset_password
//  Envía: { token, refresh_token, new_password }

async function resetPassword(token, refreshToken, newPassword) {
    const res = await safeFetch(`${API_BASE}/auth/reset_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: token,
            refresh_token: refreshToken,
            new_password: newPassword
        }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Error al restablecer la contraseña.');
    }
}

// ── verifyFace ────────────────────────────────────────────────────────────────
//
//  POST /auth/rekognition
//
//  Compara la selfie con la foto del documento en Base64 Y verifica que el
//  número de cédula digitado coincida con el detectado en el documento.
//
//  Lanza un Error si las caras no coinciden (match === false) o si la cédula
//  no coincide (cedula_match === false). Solo retorna true cuando AMBAS pasan.

async function verifyFace(sourceBase64, targetBase64, identificationNumber) {
    const res = await safeFetch(`${API_BASE}/auth/rekognition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            SourceImage64x: sourceBase64,
            TargetImage64x: targetBase64,
            cedula: identificationNumber    // Número de identificación digitado por el usuario
        })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || 'No se pudo realizar la comparación facial.');
    if (!data.match) throw new Error(data.detail || 'Las fotografías no coinciden. Asegúrate de subir tu selfie y tu documento correctamente.');
    if (!data.cedula_match) throw new Error(data.detail || 'El número de identificación ingresado no coincide con el del documento fotografiado.');

    return true; // Ambas validaciones pasaron
}

// ── verifyRegistroOficial ─────────────────────────────────────────────────────
//
//  POST /auth/verify-registro
//
//  Se ejecuta DESPUÉS de verifyFace. Consulta al backend si la persona
//  fue encontrada en el registro oficial (ej: padrón electoral, Registro Civil).
//
//  Envía:   { identificationNumber, identificationType }
//  Espera:  200 OK  → { encontrado: boolean }
//           400     → { detail: string }

async function verifyRegistroOficial(identificationNumber, identificationType = 'CEDULA') {
    const res = await safeFetch(`${API_BASE}/auth/verify-registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            identificationNumber,   // Número del documento
            identificationType      // Tipo: CEDULA, DIMEX, PASAPORTE, CEDULA_JURIDICA
        })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || 'No se pudo consultar el registro oficial.');
    if (!data.encontrado) throw new Error(data.detail || 'No se encontró tu identificación en el registro oficial. Verifica el número ingresado.');

    return true; // Persona validada en el registro oficial
}

// ── registerArrendatario ──────────────────────────────────────────────────────
//
//  POST /auth/register  (role: arrendatario)
//  Registro simple sin verificación biométrica.

async function registerArrendatario(username, email, password, identificationType, identificationNumber) {
    const res = await safeFetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username,
            email,
            password,
            identificationType,     // Tipo de documento: CEDULA, DIMEX, PASAPORTE, etc.
            identificationNumber,   // Número del documento
            role: 'arrendatario'    // Indica al backend el tipo de cuenta
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'No se pudo crear la cuenta. Intenta de nuevo.');
    return true;
}

// ── registerArrendador ───────────────────────────────────────────────────────
//
//  POST /auth/register  (role: arrendador)
//  Se llama DESPUÉS de que verifyFace + verifyRegistroOficial retornen éxito.

async function registerArrendador(username, email, password, identificationType, identificationNumber) {
    const res = await safeFetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username,
            email,
            password,
            identificationType,     // Tipo de documento: CEDULA, DIMEX, PASAPORTE, etc.
            identificationNumber,   // Número del documento (ya validado biométricamente)
            role: 'arrendador'      // Indica al backend el tipo de cuenta
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'No se pudo crear la cuenta. Intenta de nuevo.');
    return true;
}

// ── validateImageFile ─────────────────────────────────────────────────────────
//
//  Verifica que el archivo:
//    1. Sea un formato de imagen permitido: JPG, PNG, WEBP o GIF
//    2. No supere el límite máximo de tamaño (por defecto 4 MB)
//
//  Lanza un error descriptivo si alguna de las dos condiciones falla.

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function validateImageFile(file, maxMb = 4) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new Error('Formato no permitido. Solo se aceptan imágenes JPG, PNG, WEBP o GIF.');
    }
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
        throw new Error(`El archivo supera el límite permitido de ${maxMb} MB (Tamaño actual: ${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
    }
    return true;
}
