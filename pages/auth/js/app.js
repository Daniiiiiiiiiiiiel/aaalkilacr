'use strict';

// ══════════════════════════════════════════════════════════════════════════════
//  app.js (Auth) – Capa de control (Controller)
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
            window.location.href = '../dashboard/index.html';
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
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('remember-me').checked;
    const btn = document.getElementById('btn-login');

    // ── Validaciones cliente (se cortan antes de hacer cualquier fetch) ────────
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
        await loginUser(email, password, remember);
        window.location.href = '../dashboard/index.html';
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


// ── PANTALLA 2: RECUPERAR CONTRASEÑA ──────────────────────────────────────────

document.getElementById('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
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
let otpAttempts = 0;
const OTP_MAX_ATTEMPTS = 3; // máximo de intentos antes de bloquear el formulario

document.getElementById('form-otp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = getOtp(); // une las 6 cajas → "123456"
    const email = document.getElementById('otp-email-display').textContent;
    const btn = document.getElementById('btn-verify-otp');

    // Validación cliente: los 6 dígitos deben estar completos
    if (otp.length < 6) {
        showError('error-otp', 'Ingresá el código completo de 6 dígitos.');
        return;
    }

    // Corte local: si ya se alcanzó el límite de intentos, no hace más peticiones.
    if (otpAttempts >= OTP_MAX_ATTEMPTS) {
        showError('error-otp', 'Demasiados intentos. Solicitá un nuevo código.');
        return;
    }

    clearError('error-otp');
    setLoading(btn, true);

    try {
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
        if (otpAttempts < OTP_MAX_ATTEMPTS) setLoading(btn, false);
    }
});

// "Reenviar código" → visible cuando el timer llega a 0 (lógica en ui.js).
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

document.getElementById('form-newpass').addEventListener('submit', async (e) => {
    e.preventDefault();
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


// Variables globales para almacenar las credenciales de identificación validadas
let validatedArrendadorIdType = '';
let validatedArrendadorIdNumber = '';

// Función para limpiar los campos y previsualizaciones del registro
function clearRegistrationInputs() {
    // Limpia el selector y campo de número de identificación
    const selectEl = document.getElementById('register-id-type');
    const inputEl = document.getElementById('register-id-number');
    if (selectEl) {
        selectEl.value = 'CEDULA';
        selectEl.dispatchEvent(new Event('change'));
    }
    if (inputEl) inputEl.value = '';

    const selfieInput = document.getElementById('register-selfie');
    const cedulaInput = document.getElementById('register-cedula');
    if (selfieInput) selfieInput.value = '';
    if (cedulaInput) cedulaInput.value = '';

    document.querySelectorAll('#screen-register .file-upload-card').forEach(card => {
        card.classList.remove('has-preview');
        const fileNameEl = card.querySelector('.file-name');
        const previewImg = card.querySelector('.image-preview');
        const btnRemove = card.querySelector('.btn-remove-image');
        if (fileNameEl) fileNameEl.textContent = 'Ninguno';
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

// "Regístrate" → navega a la pantalla de selección de tipo de cuenta.
document.getElementById('btn-go-register').addEventListener('click', e => {
    e.preventDefault();
    clearRegistrationInputs();
    showScreen('screen-tipo-cuenta');
});

// ── PANTALLA 5: SELECCIÓN DE TIPO DE CUENTA ─────────────────────────────────

// Opción Arrendatario → flujo simple sin verificación biométrica
document.getElementById('btn-tipo-arrendatario').addEventListener('click', () => {
    clearArrendatarioInputs(); // Limpia el formulario antes de entrar
    showScreen('screen-arrendatario');
});

// Opción Arrendador → flujo completo con verificación facial
document.getElementById('btn-tipo-arrendador').addEventListener('click', () => {
    clearRegistrationInputs(); // Limpia el formulario de arrendador antes de entrar
    showScreen('screen-register');
});

// Limpiar inputs al retroceder desde la pantalla de arrendador (vuelve a tipo-cuenta)
document.querySelector('#screen-register .back-btn').addEventListener('click', () => {
    clearRegistrationInputs();
});

// Limpiar inputs al retroceder desde la pantalla de arrendatario (vuelve a tipo-cuenta)
document.querySelector('#screen-arrendatario .back-btn').addEventListener('click', () => {
    clearArrendatarioInputs();
});

// Función auxiliar: comprime y redimensiona una imagen via canvas antes de codificarla.
function compressImage(file, maxPx = 1200, quality = 0.82) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl); // libera memoria

            let { width, height } = img;
            if (width > maxPx || height > maxPx) {
                if (width > height) { height = Math.round((height / width) * maxPx); width = maxPx; }
                else                { width = Math.round((width / height) * maxPx); height = maxPx; }
            }

            const canvas = document.createElement('canvas');
            canvas.width  = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);

            canvas.toBlob(blob => {
                if (!blob) { reject(new Error('No se pudo comprimir la imagen.')); return; }
                const reader = new FileReader();
                reader.onload = () => {
                    const bytes = new Uint8Array(reader.result);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                    resolve(btoa(binary)); // Base64 raw
                };
                reader.onerror = () => reject(new Error('No se pudo leer la imagen comprimida.'));
                reader.readAsArrayBuffer(blob);
            }, 'image/jpeg', quality);
        };

        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('No se pudo cargar la imagen.')); };
        img.src = objectUrl;
    });
}

// Botón "Enviar verificación" → valida archivos e identificación, llama a verifyFace y luego a verifyRegistroOficial.
document.getElementById('btn-register-submit').addEventListener('click', async () => {
    const btn = document.getElementById('btn-register-submit');
    const selfie = document.getElementById('register-selfie').files[0];
    const cedula = document.getElementById('register-cedula').files[0];

    const idType = document.getElementById('register-id-type').value;
    const idNumber = document.getElementById('register-id-number').value.trim();

    if (!idNumber) {
        showError('error-register', 'Debes ingresar tu número de identificación.');
        document.getElementById('register-id-number').focus();
        return;
    }

    if (!selfie || !cedula) {
        showError('error-register', 'Debes subir ambas imágenes para continuar.');
        return;
    }

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
        const selfieBase64 = await compressImage(selfie);
        const cedulaBase64 = await compressImage(cedula);

        await verifyFace(selfieBase64, cedulaBase64, idNumber);
        await verifyRegistroOficial(idNumber, idType);

        validatedArrendadorIdType = idType;
        validatedArrendadorIdNumber = idNumber;

        showScreen('screen-credentials');

    } catch (err) {
        showError('error-register', err.message);
    } finally {
        setLoading(btn, false);
    }
});


// ── PANTALLA 5b: FLUJO ARRENDATARIO ──────────────────────────────────────────

const arrPassInput = document.getElementById('arr-password');
const arrConfirmPassInput = document.getElementById('arr-confirm-password');
const arrMatchMsg = document.getElementById('arr-match-msg');

function clearArrendatarioInputs() {
    ['arr-username', 'arr-email', 'arr-id-number'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const typeSelect = document.getElementById('arr-id-type');
    if (typeSelect) {
        typeSelect.value = 'CEDULA';
        typeSelect.dispatchEvent(new Event('change'));
    }
    if (arrPassInput) arrPassInput.value = '';
    if (arrConfirmPassInput) arrConfirmPassInput.value = '';
    if (arrMatchMsg) arrMatchMsg.textContent = '';
    clearError('error-arrendatario');
}

function checkArrPasswordMatch() {
    if (!arrConfirmPassInput || !arrConfirmPassInput.value) {
        if (arrMatchMsg) arrMatchMsg.textContent = '';
        return false;
    }
    const match = arrPassInput.value === arrConfirmPassInput.value;
    arrMatchMsg.textContent = match ? 'Las contraseñas coinciden ✓' : 'Las contraseñas no coinciden';
    arrMatchMsg.style.color = match ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)';
    return match;
}

if (arrPassInput) arrPassInput.addEventListener('input', checkArrPasswordMatch);
if (arrConfirmPassInput) arrConfirmPassInput.addEventListener('input', checkArrPasswordMatch);

document.getElementById('form-arrendatario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-arrendatario-submit');
    const username = document.getElementById('arr-username').value.trim();
    const email    = document.getElementById('arr-email').value.trim();
    const idType   = document.getElementById('arr-id-type').value;
    const idNumber = document.getElementById('arr-id-number').value.trim();
    const password = arrPassInput ? arrPassInput.value : '';

    if (!username) {
        showError('error-arrendatario', 'El nombre de usuario es requerido.');
        document.getElementById('arr-username').focus();
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('error-arrendatario', 'Ingresá un email válido.');
        document.getElementById('arr-email').focus();
        return;
    }
    if (!idNumber) {
        showError('error-arrendatario', 'El número de identificación es requerido.');
        document.getElementById('arr-id-number').focus();
        return;
    }
    if (password.length < 8) {
        showError('error-arrendatario', 'La contraseña debe tener al menos 8 caracteres.');
        arrPassInput.focus();
        return;
    }
    if (!checkArrPasswordMatch()) {
        showError('error-arrendatario', 'Las contraseñas no coinciden.');
        arrConfirmPassInput.focus();
        return;
    }

    clearError('error-arrendatario');
    setLoading(btn, true);

    try {
        await registerArrendatario(username, email, password, idType, idNumber);
        await verifyRegistroOficial(idNumber, idType);
        clearArrendatarioInputs();
        
        document.getElementById('modal-success-title').innerHTML = 'Cuenta creada<br>exitosamente!';
        document.getElementById('modal-success-body').textContent = 'Ya puedes iniciar sesión con tus credenciales.';
        openModal('modal-success');

    } catch (err) {
        showError('error-arrendatario', err.message);
    } finally {
        setLoading(btn, false);
    }
});


// ── PANTALLA 6: CREDENCIALES DE REGISTRO (ARRENDADOR) ────────────────────────

const regPassInput = document.getElementById('reg-password');
const regConfirmPassInput = document.getElementById('reg-confirm-password');
const regMatchMsg = document.getElementById('reg-match-msg');

function checkRegPasswordMatch() {
    if (!regConfirmPassInput.value) {
        regMatchMsg.textContent = '';
        return false;
    }
    const match = regPassInput.value === regConfirmPassInput.value;
    regMatchMsg.textContent = match ? 'Las contraseñas coinciden ✓' : 'Las contraseñas no coinciden';
    regMatchMsg.style.color = match ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)';
    return match;
}

if (regPassInput) regPassInput.addEventListener('input', checkRegPasswordMatch);
if (regConfirmPassInput) regConfirmPassInput.addEventListener('input', checkRegPasswordMatch);

document.getElementById('form-credentials').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-credentials-submit');
    const username = document.getElementById('reg-username').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!username) {
        showError('error-credentials', 'El nombre de usuario es requerido.');
        document.getElementById('reg-username').focus();
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('error-credentials', 'Ingresá un email válido.');
        document.getElementById('reg-email').focus();
        return;
    }
    if (password.length < 8) {
        showError('error-credentials', 'La contraseña debe tener al menos 8 caracteres.');
        regPassInput.focus();
        return;
    }
    if (!checkRegPasswordMatch()) {
        showError('error-credentials', 'Las contraseñas no coinciden.');
        regConfirmPassInput.focus();
        return;
    }

    if (!validatedArrendadorIdType || !validatedArrendadorIdNumber) {
        showError('error-credentials', 'No se encontraron datos de identificación validados. Por favor, realiza la verificación facial de nuevo.');
        return;
    }

    clearError('error-credentials');
    setLoading(btn, true);

    try {
        await registerArrendador(
            username,
            email,
            password,
            validatedArrendadorIdType,
            validatedArrendadorIdNumber
        );

        clearRegistrationInputs();
        validatedArrendadorIdType = '';
        validatedArrendadorIdNumber = '';

        document.getElementById('reg-username').value = '';
        document.getElementById('reg-email').value = '';
        regPassInput.value = '';
        regConfirmPassInput.value = '';
        regMatchMsg.textContent = '';
        clearError('error-credentials');

        document.getElementById('modal-success-title').innerHTML = 'Cuenta creada<br>exitosamente!';
        document.getElementById('modal-success-body').textContent = 'Ya puedes iniciar sesión con tus credenciales.';
        openModal('modal-success');

    } catch (err) {
        showError('error-credentials', err.message);
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
            try {
                validateImageFile(file);
                clearError('error-register');
            } catch (err) {
                showError('error-register', err.message);
                resetCardUi();
                return;
            }

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
            e.stopPropagation();
            resetCardUi();
        });
    }
}

setupFilePreview('register-selfie', 'card-selfie');
setupFilePreview('register-cedula', 'card-cedula');


// ── FUNCIÓN DE PLACEHOLDERS DINÁMICOS DE IDENTIFICACIÓN ──────────────────────

function setupDynamicPlaceholder(selectId, inputId) {
    const selectEl = document.getElementById(selectId);
    const inputEl = document.getElementById(inputId);
    if (!selectEl || !inputEl) return;

    const updatePlaceholder = () => {
        const value = selectEl.value;
        if (value === 'CEDULA') {
            inputEl.placeholder = '1-1234-5678';
        } else if (value === 'DIMEX') {
            inputEl.placeholder = '123456789012';
        } else if (value === 'PASAPORTE') {
            inputEl.placeholder = 'AB1234567';
        } else if (value === 'CEDULA_JURIDICA') {
            inputEl.placeholder = '3-101-123456';
        }
    };

    selectEl.addEventListener('change', updatePlaceholder);
    updatePlaceholder();
}

setupDynamicPlaceholder('arr-id-type', 'arr-id-number');
setupDynamicPlaceholder('register-id-type', 'register-id-number');
