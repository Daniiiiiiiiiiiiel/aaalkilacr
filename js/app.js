'use strict';

// ══════════════════════════════════════════════════════════════════════════════
//  app.js  –  Capa de control (Controller)
//
//  Responsabilidad: conecta la UI con la API.
//  Solo contiene event listeners. Nunca manipula el DOM directamente
//  (eso es trabajo de ui.js) ni llama a fetch directamente (eso es api.js).
//
//  Patrón de cada listener async:
//    1. Validar inputs del lado del cliente (cortar antes del fetch si hay error)
//    2. clearError / setLoading(btn, true)
//    3. await función_de_api()
//    4. Manejar éxito o mostrar error inline con showError()
//    5. setLoading(btn, false)  ← siempre en el bloque finally
// ══════════════════════════════════════════════════════════════════════════════


// ── REDIRECCIÓN AUTOMÁTICA (AUTO-LOGIN) ──────────────────────────────────────
//
//  Al cargar la página, si el usuario tiene un refresh token guardado, intentamos
//  validarlo con el backend. Si es válido y coincide, omitimos el login y redirigimos.

window.addEventListener('DOMContentLoaded', async () => {
    const hasRefresh = getRefreshToken();
    if (hasRefresh) {
        const isValid = await tryRefreshToken();
        if (isValid) {
            window.location.href = 'dashboard/index.html';
        }
    }
});


// ── PANTALLA 1: LOGIN ─────────────────────────────────────────────────────────

// Enlace "¿Olvidaste tu contraseña?" → navega a la pantalla de recuperación.
document.getElementById('btn-forgot').addEventListener('click', e => {
    e.preventDefault();
    showScreen('screen-forgot');
});

// Botón "Iniciar sesión" → valida inputs, llama al backend y redirige.
document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('remember-me').checked;
    const btn = document.getElementById('btn-login');

    // ── Validaciones cliente (se cortan antes de hacer cualquier fetch) ────────
    // Validar primero evita peticiones innecesarias al servidor y da feedback
    // inmediato al usuario sin esperar latencia de red.
    if (!email) {
        showError('error-login', 'El email es requerido.');
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('error-login', 'Ingresá un email válido.');
        return;
    }
    if (!password) {
        showError('error-login', 'La contraseña es requerida.');
        return;
    }
    if (password.length < 8) {
        showError('error-login', 'La contraseña debe tener al menos 8 caracteres.');
        return;
    }

    clearError('error-login');
    setLoading(btn, true);

    try {
        // api.js: POST /auth/login → guarda token en storage.
        // loginUser ya NO redirige: la redirección vive aquí para que
        // en el futuro se pueda enviar al usuario a la URL previa al login.
        await loginUser(email, password, remember);
        window.location.href = 'dashboard/index.html';
    } catch (err) {
        showError('error-login', err.message);
    } finally {
        setLoading(btn, false);
    }
});

// Social login: stubs para OAuth futuro (Google / Facebook).
['btn-google', 'btn-facebook'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
        showError('error-login', 'Login social próximamente disponible.');
    });
});

// "Regístrate": stub hasta que exista la pantalla/página de registro.
document.getElementById('btn-go-register')?.addEventListener('click', e => {
    e.preventDefault();
    showError('error-login', 'Registro próximamente disponible.');
});


// ── PANTALLA 2: RECUPERAR CONTRASEÑA ──────────────────────────────────────────

document.getElementById('btn-send-reset').addEventListener('click', async () => {
    const emailInput = document.getElementById('forgot-email');
    const email = emailInput.value.trim();
    const btn = document.getElementById('btn-send-reset');

    // Validación cliente: formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('error-forgot', 'Ingresá un email válido.');
        emailInput.focus();
        return;
    }

    clearError('error-forgot');
    setLoading(btn, true);

    try {
        // api.js: POST /auth/forgot-password
        // El servidor envía un OTP de 6 dígitos al email indicado.
        await sendResetEmail(email);

        document.getElementById('otp-email-display').textContent = email;
        otpAttempts = 0; // resetea el contador de intentos al entrar al flujo OTP
        openModal('modal-email');

        setTimeout(() => {
            closeModal('modal-email');
            showScreen('screen-otp');
            startOtpTimer(135); // 2 min 15 seg para ingresar el código
            otpBoxes[0]?.focus();
        }, 2500);

    } catch (err) {
        showError('error-forgot', err.message);
    } finally {
        setLoading(btn, false);
    }
});


// ── PANTALLA 3: VERIFICACIÓN OTP ──────────────────────────────────────────────

// Contador de intentos fallidos de OTP.
// El backend probablemente bloquea después de N intentos, pero el frontend
// hace el corte antes para evitar peticiones innecesarias y dar feedback claro.
let otpAttempts = 0;
const OTP_MAX_ATTEMPTS = 3; // máximo de intentos antes de bloquear el formulario

document.getElementById('btn-verify-otp').addEventListener('click', async () => {
    const otp = getOtp(); // une las 6 cajas → "123456"
    const email = document.getElementById('otp-email-display').textContent;
    const btn = document.getElementById('btn-verify-otp');

    // Validación cliente: los 6 dígitos deben estar completos
    if (otp.length < 6) {
        showError('error-otp', 'Ingresá el código completo de 6 dígitos.');
        return;
    }

    // Corte local: si ya se alcanzó el límite de intentos, no hace más peticiones.
    // Esto protege al usuario de que el backend lo bloquee a nivel de cuenta.
    if (otpAttempts >= OTP_MAX_ATTEMPTS) {
        showError('error-otp', 'Demasiados intentos. Solicitá un nuevo código.');
        return;
    }

    clearError('error-otp');
    setLoading(btn, true);

    try {
        // api.js: POST /auth/verify_otp → guarda tokens en storage directamente
        await verifyOtp(email, otp);
        otpAttempts = 0;          // reset en éxito
        showScreen('screen-newpass');
    } catch (err) {
        otpAttempts++;
        const restantes = OTP_MAX_ATTEMPTS - otpAttempts;

        if (restantes <= 0) {
            // Límite alcanzado: bloquea el botón y pide reenvío
            showError('error-otp', 'Demasiados intentos. Solicitá un nuevo código.');
            btn.disabled = true;
            btn.textContent = 'Bloqueado';
        } else {
            // Informa cuántos intentos quedan
            showError('error-otp',
                `${err.message} — ${restantes} intento${restantes === 1 ? '' : 's'} restante${restantes === 1 ? '' : 's'}.`
            );
        }

        otpBoxes.forEach(b => b.value = ''); // limpia cajas para reintento
        otpBoxes[0]?.focus();
    } finally {
        // setLoading reactiva el botón, pero si está bloqueado por intentos lo dejamos así
        if (otpAttempts < OTP_MAX_ATTEMPTS) setLoading(btn, false);
    }
});

// "Reenviar código" → visible cuando el timer llega a 0 (lógica en ui.js).
// Solicita un nuevo OTP y resetea el contador de intentos.
document.getElementById('btn-resend-otp').addEventListener('click', async () => {
    const email = document.getElementById('otp-email-display').textContent;
    const btn = document.getElementById('btn-resend-otp');

    clearError('error-otp');
    setLoading(btn, true);

    try {
        await sendResetEmail(email);
        otpAttempts = 0; // al recibir código nuevo, los intentos anteriores no cuentan

        // Reactiva el botón de verificar si estaba bloqueado por intentos
        const verifyBtn = document.getElementById('btn-verify-otp');
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verificar';

        startOtpTimer(135);
        otpBoxes.forEach(b => b.value = '');
        otpBoxes[0]?.focus();
    } catch (err) {
        showError('error-otp', err.message);
    } finally {
        setLoading(btn, false);
    }
});


// ── PANTALLA 4: NUEVA CONTRASEÑA ──────────────────────────────────────────────

document.getElementById('btn-reset-password').addEventListener('click', async () => {
    const btn = document.getElementById('btn-reset-password');

    // Validación: verificar si existe el token de recuperación en storage
    const recoveryToken = getToken();
    const recoveryRefresh = getRefreshToken();
    if (!recoveryToken || !recoveryRefresh) {
        showError('error-newpass', 'Sesión de recuperación inválida o expirada. Solicitá un nuevo código.');
        return;
    }

    // Validación cliente: longitud mínima
    if (newPassInput.value.length < 8) {
        showError('error-newpass', 'La contraseña debe tener al menos 8 caracteres.');
        newPassInput.focus();
        return;
    }
    // Validación cliente: ambas contraseñas iguales
    if (!checkMatch()) {
        showError('error-newpass', 'Las contraseñas no coinciden.');
        confirmPassInput.focus();
        return;
    }

    clearError('error-newpass');
    setLoading(btn, true);

    try {
        // api.js: POST /auth/reset_password { token, refresh_token, new_password }
        // Lee los tokens directamente del storage (guardados por verifyOtp)
        await resetPassword(recoveryToken, recoveryRefresh, newPassInput.value);
        clearToken(); // Limpiar el storage de recuperación al terminar
        openModal('modal-success');
    } catch (err) {
        showError('error-newpass', err.message);
    } finally {
        setLoading(btn, false);
    }
});


// ── MODAL DE ÉXITO ────────────────────────────────────────────────────────────

// "Entendido" → limpia el flujo de recuperación completo y vuelve al login.
document.getElementById('btn-modal-done').addEventListener('click', () => {
    closeModal('modal-success');
    otpBoxes.forEach(b => b.value = '');
    newPassInput.value = '';
    confirmPassInput.value = '';
    matchMsg.textContent = '';
    showScreen('screen-login');
});


// Función para limpiar los campos y previsualizaciones del registro
function clearRegistrationInputs() {
    const selfieInput = document.getElementById('register-selfie');
    const cedulaInput = document.getElementById('register-cedula');
    if (selfieInput) selfieInput.value = '';
    if (cedulaInput) cedulaInput.value = '';

    document.querySelectorAll('.file-upload-card').forEach(card => {
        card.classList.remove('has-preview');
        const fileNameEl = card.querySelector('.file-name');
        const previewImg = card.querySelector('.image-preview');
        const btnRemove = card.querySelector('.btn-remove-image');
        if (fileNameEl) fileNameEl.textContent = 'Ningún archivo seleccionado';
        if (previewImg) {
            previewImg.src = '';
            previewImg.hidden = true;
        }
        if (btnRemove) {
            btnRemove.style.display = 'none';
        }
    });
    clearError('error-register');
}

// "Regístrate" → navega a la pantalla de registro.
document.getElementById('btn-go-register').addEventListener('click', e => {
    e.preventDefault();
    clearRegistrationInputs();
    showScreen('screen-register');
});

// Limpiar inputs al hacer clic en el botón de retroceso de la pantalla de registro
document.querySelector('#screen-register .back-btn').addEventListener('click', () => {
    clearRegistrationInputs();
});

// Función auxiliar: lee un archivo de imagen y devuelve Base64 puro (sin prefijos ni etiquetas)
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const bytes = new Uint8Array(reader.result);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            resolve(btoa(binary)); // Base64 raw sin ningún prefijo
        };
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        reader.readAsArrayBuffer(file);
    });
}

// Botón "Enviar verificación" → valida archivos, los convierte a Base64 y llama a verifyFace.
document.getElementById('btn-register-submit').addEventListener('click', async () => {
    const btn = document.getElementById('btn-register-submit');
    const selfie = document.getElementById('register-selfie').files[0];
    const cedula = document.getElementById('register-cedula').files[0];

    // Validación: ambas imágenes deben estar seleccionadas
    if (!selfie || !cedula) {
        showError('error-register', 'Debes subir ambas imágenes para continuar.');
        return;
    }

    // Validación: tipo y tamaño de cada archivo (máximo 4 MB, solo imágenes)
    try {
        validateImageFile(selfie);
        validateImageFile(cedula);
    } catch (err) {
        showError('error-register', err.message);
        return;
    }

    clearError('error-register');
    setLoading(btn, true);

    try {
        // Convierte ambas imágenes a Base64 puro (sin encabezado DataURL)
        const selfieBase64 = await fileToBase64(selfie);
        const cedulaBase64 = await fileToBase64(cedula);

        // api.js: POST /auth/rekognition { SourceImage64x, TargetImage64x }
        // El selfie es la imagen fuente (cara real) y la cédula es el objetivo a comparar.
        const similarity = await verifyFace(selfieBase64, cedulaBase64);

        // El backend puede retornar true, un float o incluso undefined — manejamos todos los casos.
        // Si llegamos aquí sin excepción, la verificación fue exitosa.

        clearRegistrationInputs();
        showScreen('screen-login');
    } catch (err) {
        showError('error-register', err.message);

    } finally {
        setLoading(btn, false);
    }
});


// ── CONFIGURACIÓN DE VISTA PREVIA Y VALIDACIÓN EN TIEMPO REAL ──────────────────

function setupFilePreview(inputId, cardId) {
    const fileInput = document.getElementById(inputId);
    const card = document.getElementById(cardId);
    if (!fileInput || !card) return;

    const fileNameEl = card.querySelector('.file-name');
    const previewImg = card.querySelector('.image-preview');
    const btnRemove = card.querySelector('.btn-remove-image');

    const resetCardUi = () => {
        fileInput.value = '';
        fileNameEl.textContent = 'Ningún archivo seleccionado';
        previewImg.src = '';
        previewImg.hidden = true;
        card.classList.remove('has-preview');
        if (btnRemove) btnRemove.style.display = 'none';
    };

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) {
            // Validar formato y tamaño del archivo localmente antes de previsualizarlo
            try {
                validateImageFile(file);
                clearError('error-register');
            } catch (err) {
                showError('error-register', err.message);
                resetCardUi();
                return;
            }

            // Mostrar el nombre del archivo y la imagen de vista previa
            fileNameEl.textContent = file.name;
            const objectUrl = URL.createObjectURL(file);
            previewImg.src = objectUrl;
            previewImg.hidden = false;
            card.classList.add('has-preview');
            if (btnRemove) btnRemove.style.display = 'flex';
        } else {
            resetCardUi();
        }
    });

    if (btnRemove) {
        btnRemove.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Evita abrir el selector de archivos nativo
            resetCardUi();
        });
    }
}

// Inicializar previsualizaciones
setupFilePreview('register-selfie', 'card-selfie');
setupFilePreview('register-cedula', 'card-cedula');