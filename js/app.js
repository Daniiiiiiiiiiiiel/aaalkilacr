'use strict'; // activa modo estricto: detecta errores antes de que causen bugs

// Navegar a la pantalla de recuperación de contraseña al pulsar el enlace.
document.getElementById('btn-forgot').addEventListener('click', e => {
    e.preventDefault(); // evita que el enlace <a> navegue por defecto
    showScreen('screen-forgot'); // muestra la pantalla de "olvidé mi contraseña"
});

// Login: recoge los datos del formulario y llama al backend.
document.getElementById('btn-login').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim(); // email sin espacios
    const password = document.getElementById('login-password').value;     // contraseña tal cual
    const remember = document.getElementById('remember-me').checked;      // true si el checkbox está marcado

    if (!email || !password) return alert('Por favor completa todos los campos.'); // valida que no estén vacíos

    try {
        await loginUser(email, password, remember); // llama a la función en api.js
    } catch (err) {
        alert(err.message); // muestra el error devuelto por el servidor
    }
});

// Recuperación: valida el email, llama al backend y abre la pantalla OTP.
document.getElementById('btn-send-reset').addEventListener('click', async () => {
    const email = document.getElementById('forgot-email').value.trim(); // email sin espacios

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))  // valida formato de email con regex
        return document.getElementById('forgot-email').focus(); // pone el foco en el campo si es inválido

    try {
        await sendResetEmail(email); // solicita el correo de recuperación al backend
        document.getElementById('otp-email-display').textContent = email; // muestra el email en la pantalla OTP
        openModal('modal-email'); // muestra el modal de confirmación de envío
        setTimeout(() => {
            closeModal('modal-email');   // cierra el modal tras 2.5 segundos
            showScreen('screen-otp');    // navega a la pantalla de verificación OTP
            startOtpTimer(135);          // inicia el contador de 2 min 15 seg
            otpBoxes[0]?.focus();        // pone el foco en la primera caja OTP
        }, 2500);
    } catch (err) {
        alert(err.message); // muestra el error devuelto por el servidor
    }
});

// OTP: recoge el código ingresado y lo verifica contra el backend.
document.getElementById('btn-verify-otp').addEventListener('click', async () => {
    const otp   = getOtp(); // obtiene el código de 4 dígitos de las cajas OTP
    const email = document.getElementById('otp-email-display').textContent; // recupera el email guardado

    if (otp.length < 4) return alert('Ingresa el código completo de 4 dígitos.'); // valida que estén los 4 dígitos

    try {
        await verifyOtp(email, otp); // verifica el código contra el backend
        showScreen('screen-newpass'); // si es válido, navega a la pantalla de nueva contraseña
    } catch (err) {
        alert(err.message); // muestra el error si el código es incorrecto
    }
});

// Nueva contraseña: valida los campos y envía la contraseña al backend.
document.getElementById('btn-reset-password').addEventListener('click', async () => {
    if (newPassInput.value.length < 8) {        // verifica longitud mínima de 8 caracteres
        alert('La contraseña debe tener al menos 8 caracteres.');
        return newPassInput.focus();             // pone el foco en el campo si falla
    }
    if (!checkMatch()) return confirmPassInput.focus(); // verifica que ambas contraseñas coincidan

    const email = document.getElementById('otp-email-display').textContent; // recupera el email del flujo anterior

    try {
        await resetPassword(email, newPassInput.value); // envía la nueva contraseña al backend
        openModal('modal-success'); // muestra el modal de éxito si todo salió bien
    } catch (err) {
        alert(err.message); // muestra el error devuelto por el servidor
    }
});

// Modal de éxito: limpia el formulario OTP y regresa al login.
document.getElementById('btn-modal-done').addEventListener('click', () => {
    closeModal('modal-success');              // cierra el modal de éxito
    otpBoxes.forEach(b => b.value = '');     // borra los 4 dígitos OTP ingresados
    showScreen('screen-login');              // vuelve a la pantalla principal de login
});