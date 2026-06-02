'use strict'; // activa modo estricto: detecta errores antes de que causen bugs

// URL base de la API. Cambiar por la real antes de producción.
const API = 'https://api.alkila.cr/v1';

// Envía las credenciales al backend y guarda el token si el login es correcto.
async function loginUser(email, password, remember) {
    const res = await fetch(`${API}/auth/login`, { // POST al endpoint de login
        method:  'POST',
        headers: { 'Content-Type': 'application/json' }, // indica que el body es JSON
        body:    JSON.stringify({ email, password, remember }), // convierte los datos a JSON
    });
    const data = await res.json(); // parsea la respuesta JSON del servidor

    if (!res.ok) throw new Error(data.message || 'Error al iniciar sesión.'); // lanza error si el servidor respondió con fallo

    localStorage.setItem('token', data.token); // guarda el token para futuras peticiones autenticadas
    window.location.href = '/dashboard'; // redirige al dashboard tras login exitoso
}

// Solicita al backend que envíe un correo con el enlace/código de recuperación.
async function sendResetEmail(email) {
    const res = await fetch(`${API}/auth/forgot-password`, { // POST al endpoint de recuperación
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }), // envía solo el email
    });

    if (!res.ok) throw new Error('No se pudo enviar el correo.'); // lanza error si el servidor falló
}

// Envía el código OTP al backend para verificar que sea válido.
async function verifyOtp(email, otp) {
    const res  = await fetch(`${API}/auth/verify-otp`, { // POST al endpoint de verificación
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, otp }), // envía el email y el código ingresado
    });
    const data = await res.json(); // parsea la respuesta

    if (!res.ok || !data.verified) throw new Error('Código incorrecto. Intenta de nuevo.'); // lanza error si el código es inválido
}

// Envía la nueva contraseña al backend para actualizarla.
async function resetPassword(email, password) {
    const res = await fetch(`${API}/auth/reset-password`, { // POST al endpoint de reset
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }), // envía el email y la nueva contraseña
    });

    if (!res.ok) throw new Error('Error al restablecer la contraseña.'); // lanza error si el servidor falló
}
