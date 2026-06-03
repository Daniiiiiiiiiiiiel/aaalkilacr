'use strict';

// ══════════════════════════════════════════════════════════════════════════════
//  app.js  –  Capa de control (Controller)
//
//  Responsabilidad: conecta la UI con la API.
//  Solo contiene event listeners. Nunca manipula el DOM directamente
//  (eso es trabajo de ui.js) ni llama a fetch directamente (eso es api.js).
//
//  Patrón de cada listener async:
//    1. Leer valores del DOM
//    2. Validación rápida del lado del cliente
//    3. setLoading(btn, true)   ← deshabilita botón
//    4. await función_de_api()
//    5. Manejar éxito o mostrar error inline
//    6. setLoading(btn, false)  ← en el bloque finally (siempre se ejecuta)
// ══════════════════════════════════════════════════════════════════════════════


// ── PANTALLA 1: LOGIN ─────────────────────────────────────────────────────────

// Enlace "¿Olvidaste tu contraseña?" → navega a la pantalla de recuperación.
document.getElementById('btn-forgot').addEventListener('click', e => {
    e.preventDefault();          // evita que el <a> navegue por defecto
    showScreen('screen-forgot'); // delega a ui.js
});

// Botón "Iniciar sesión" → valida campos y llama al backend.
document.getElementById('btn-login').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('remember-me').checked;
    const btn      = document.getElementById('btn-login');

    // Validación cliente: ambos campos requeridos
    if (!email || !password) {
        showError('error-login', 'Por favor completa todos los campos.');
        return;
    }

    clearError('error-login'); // limpia error anterior si existía
    setLoading(btn, true);     // deshabilita botón y muestra "Cargando…"

    try {
        // api.js: POST /auth/login → guarda token → redirige a /dashboard
        await loginUser(email, password, remember);
    } catch (err) {
        showError('error-login', err.message); // muestra el mensaje del servidor inline
    } finally {
        setLoading(btn, false); // siempre reactiva el botón, haya error o no
    }
});

// Botones sociales: stubs para integración futura con OAuth (Google / Facebook).
// Cuando el backend tenga los endpoints de OAuth, reemplazar el showError
// por window.location.href = '/auth/google'  (o el flujo que corresponda).
['btn-google', 'btn-facebook'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
        showError('error-login', 'Login social próximamente disponible.');
    });
});

// Enlace "Regístrate": stub hasta que la pantalla/página de registro esté lista.
document.getElementById('btn-go-register')?.addEventListener('click', e => {
    e.preventDefault();
    showError('error-login', 'Registro próximamente disponible.');
});


// ── PANTALLA 2: RECUPERAR CONTRASEÑA ──────────────────────────────────────────

// Botón "Reiniciar contraseña" → valida el email y solicita el código OTP.
document.getElementById('btn-send-reset').addEventListener('click', async () => {
    const emailInput = document.getElementById('forgot-email');
    const email      = emailInput.value.trim();
    const btn        = document.getElementById('btn-send-reset');

    // Validación cliente: formato de email con regex simple
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('error-forgot', 'Ingresa un email válido.');
        emailInput.focus();
        return;
    }

    clearError('error-forgot');
    setLoading(btn, true);

    try {
        // api.js: POST /auth/forgot-password
        // El servidor envía un email con el código OTP de 6 dígitos al usuario.
        await sendResetEmail(email);

        // Guarda el email visible en la pantalla OTP (se reutiliza en verifyOtp y resetPassword)
        document.getElementById('otp-email-display').textContent = email;
        openModal('modal-email'); // modal de confirmación "revisa tu email"

        setTimeout(() => {
            closeModal('modal-email');
            showScreen('screen-otp'); // navega a verificación OTP
            startOtpTimer(135);       // 2 min 15 seg de ventana para ingresar el código
            otpBoxes[0]?.focus();     // foco en la primera caja OTP
        }, 2500);

    } catch (err) {
        showError('error-forgot', err.message);
    } finally {
        setLoading(btn, false);
    }
});


// ── PANTALLA 3: VERIFICACIÓN OTP ──────────────────────────────────────────────

// Botón "Verificar" → recoge el código y lo valida contra el backend.
document.getElementById('btn-verify-otp').addEventListener('click', async () => {
    const otp   = getOtp(); // une las 6 cajas → "123456"
    const email = document.getElementById('otp-email-display').textContent;
    const btn   = document.getElementById('btn-verify-otp');

    // Validación cliente: los 6 dígitos deben estar completos
    if (otp.length < 6) {
        showError('error-otp', 'Ingresa el código completo de 6 dígitos.');
        return;
    }

    clearError('error-otp');
    setLoading(btn, true);

    try {
        // api.js: POST /auth/verify-otp { email, otp }
        // El backend confirma que el código es correcto y no ha expirado.
        await verifyOtp(email, otp);
        showScreen('screen-newpass'); // si es válido, avanza a crear nueva contraseña
    } catch (err) {
        showError('error-otp', err.message);
        // Limpia las cajas OTP para que el usuario lo intente de nuevo limpio
        otpBoxes.forEach(b => b.value = '');
        otpBoxes[0]?.focus();
    } finally {
        setLoading(btn, false);
    }
});

// Botón "Reenviar código" → visible solo cuando el timer llega a 0 (lógica en ui.js).
// Vuelve a llamar a sendResetEmail con el mismo email y reinicia el timer.
document.getElementById('btn-resend-otp').addEventListener('click', async () => {
    const email = document.getElementById('otp-email-display').textContent;
    const btn   = document.getElementById('btn-resend-otp');

    clearError('error-otp');
    setLoading(btn, true);

    try {
        // Misma llamada que en pantalla 2: solicita un nuevo código al backend.
        await sendResetEmail(email);
        startOtpTimer(135);            // reinicia el contador (oculta el botón)
        otpBoxes.forEach(b => b.value = ''); // limpia las cajas
        otpBoxes[0]?.focus();
    } catch (err) {
        showError('error-otp', err.message);
    } finally {
        setLoading(btn, false);
    }
});


// ── PANTALLA 4: NUEVA CONTRASEÑA ──────────────────────────────────────────────

// Botón "Reiniciar contraseña" → valida las contraseñas y las envía al backend.
document.getElementById('btn-reset-password').addEventListener('click', async () => {
    const btn   = document.getElementById('btn-reset-password');
    const email = document.getElementById('otp-email-display').textContent;

    // Validación cliente: mínimo 8 caracteres
    if (newPassInput.value.length < 8) {
        showError('error-newpass', 'La contraseña debe tener al menos 8 caracteres.');
        newPassInput.focus();
        return;
    }

    // Validación cliente: las dos contraseñas deben coincidir
    if (!checkMatch()) {
        showError('error-newpass', 'Las contraseñas no coinciden.');
        confirmPassInput.focus();
        return;
    }

    clearError('error-newpass');
    setLoading(btn, true);

    try {
        // api.js: POST /auth/reset-password { email, password }
        // El backend actualiza la contraseña e invalida el OTP usado.
        await resetPassword(email, newPassInput.value);
        openModal('modal-success'); // modal de éxito
    } catch (err) {
        showError('error-newpass', err.message);
    } finally {
        setLoading(btn, false);
    }
});


// ── MODAL DE ÉXITO ────────────────────────────────────────────────────────────

// Botón "Entendido" → limpia todo el flujo de recuperación y vuelve al login.
document.getElementById('btn-modal-done').addEventListener('click', () => {
    closeModal('modal-success');
    otpBoxes.forEach(b => b.value = '');    // limpia las cajas OTP
    newPassInput.value     = '';             // limpia los campos de contraseña
    confirmPassInput.value = '';
    matchMsg.textContent   = '';             // limpia el mensaje de validación
    showScreen('screen-login');              // vuelve a la pantalla inicial
});