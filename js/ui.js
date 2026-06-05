'use strict';

// ══════════════════════════════════════════════════════════════════════════════
//  ui.js  –  Capa de vista
//
//  Responsabilidad: todo lo que afecta el DOM sin depender de la API.
//    - Navegación entre pantallas
//    - Mensajes de error inline (reemplaza los alert())
//    - Estado de carga en botones (previene doble-click)
//    - Toggle de contraseña visible/oculta
//    - Navegación con botones "Volver"
//    - Lógica de las cajas OTP (6 dígitos)
//    - Temporizador de reenvío OTP
//    - Validación en tiempo real de contraseñas
// ══════════════════════════════════════════════════════════════════════════════


// ── NAVEGACIÓN ────────────────────────────────────────────────────────────────

// Oculta todas las pantallas y muestra solo la indicada por su ID.
// También limpia los errores anteriores para que no queden "pegados" al volver.
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    clearAllErrors(); // borra todos los mensajes de error al cambiar de pantalla
}

// Abre un modal quitando la clase "hidden".
const openModal  = id => document.getElementById(id)?.classList.remove('hidden');
// Cierra un modal añadiendo la clase "hidden".
const closeModal = id => document.getElementById(id)?.classList.add('hidden');

// Conecta cada botón "back-btn" con la pantalla indicada en su data-target.
document.querySelectorAll('.back-btn').forEach(btn =>
    btn.addEventListener('click', () => showScreen(btn.dataset.target))
);


// ── ERRORES INLINE ────────────────────────────────────────────────────────────
//
//  Antes se usaba alert() para mostrar errores, lo que bloquea el hilo del
//  navegador y da mala experiencia. Ahora cada pantalla tiene un elemento
//  <p class="field-error"> donde se muestra el mensaje justo debajo del botón.
//
//  showError(id, msg) → muestra el mensaje en el elemento con ese ID
//  clearError(id)     → borra el mensaje de ese elemento
//  clearAllErrors()   → borra todos los errores de la página de golpe

function showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;   // escribe el mensaje
    el.hidden = false;       // lo hace visible (en HTML arranca con hidden)
}

function clearError(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
}

function clearAllErrors() {
    // Limpia todos los .field-error del DOM de una sola vez
    document.querySelectorAll('.field-error').forEach(el => {
        el.textContent = '';
        el.hidden = true;
    });
}


// ── ESTADO DE CARGA EN BOTONES ────────────────────────────────────────────────
//
//  Problema original: los botones no se desactivaban durante el await,
//  lo que permitía al usuario hacer doble-click y enviar la petición dos veces.
//
//  setLoading(btn, true)  → deshabilita el botón y cambia su texto a "Cargando…"
//  setLoading(btn, false) → restaura el texto original y lo habilita de nuevo
//
//  Uso en app.js:
//    setLoading(btn, true);
//    try { await alguna_funcion_api(); } finally { setLoading(btn, false); }

function setLoading(btn, loading) {
    if (loading) {
        btn.dataset.label = btn.textContent; // guarda el texto original en data-label
        btn.textContent   = 'Cargando…';
        btn.disabled      = true;            // bloquea nuevos clicks
    } else {
        btn.textContent = btn.dataset.label || btn.textContent; // restaura texto
        btn.disabled    = false;
    }
}


// ── TOGGLE OJO (mostrar/ocultar contraseña) ───────────────────────────────────
//
//  Cada botón .toggle-eye tiene data-target apuntando al ID del input.
//  Al hacer click alterna el type entre "password" (oculto) y "text" (visible)
//  y actualiza el icono (ojo abierto / ojo tachado).

const EYE_OPEN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
    viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
</svg>`;

const EYE_CLOSED_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none"
    viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M3 3l18 18" />
</svg>`;

document.querySelectorAll('.toggle-eye').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        if (input) {
            if (input.type === 'password') {
                input.type = 'text';
                btn.innerHTML = EYE_CLOSED_SVG;
                btn.setAttribute('aria-label', 'Ocultar contraseña');
            } else {
                input.type = 'password';
                btn.innerHTML = EYE_OPEN_SVG;
                btn.setAttribute('aria-label', 'Mostrar contraseña');
            }
        }
    });
});


// ── OTP (6 dígitos) ───────────────────────────────────────────────────────────
//
//  Cada caja acepta exactamente 1 dígito numérico.
//  Al escribir un dígito, el foco avanza automáticamente a la siguiente caja.
//  Al borrar con Backspace en una caja vacía, el foco retrocede a la anterior.

const otpBoxes = document.querySelectorAll('.otp-box');

otpBoxes.forEach((box, i) => {
    box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g, '').slice(-1); // solo el último dígito numérico
        if (box.value && i < otpBoxes.length - 1) otpBoxes[i + 1].focus(); // avanza
    });
    box.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !box.value && i > 0) otpBoxes[i - 1].focus(); // retrocede
    });
});

// Une el valor de las 6 cajas en un string. Ej: "123456"
const getOtp = () => Array.from(otpBoxes).map(b => b.value).join('');


// ── TEMPORIZADOR OTP ──────────────────────────────────────────────────────────
//
//  Cuenta regresiva visual en #otp-timer.
//  Cuando llega a 0, muestra el botón #btn-resend-otp para que el usuario
//  pueda solicitar un nuevo código sin recargar la página.

let timerInterval; // referencia al setInterval para poder cancelarlo

function startOtpTimer(seconds) {
    clearInterval(timerInterval); // cancela cualquier temporizador previo

    const display   = document.getElementById('otp-timer');
    const resendBtn = document.getElementById('btn-resend-otp');
    resendBtn.hidden = true; // oculta el botón de reenvío mientras el timer corre

    let t = seconds;

    const tick = () => {
        // Formatea como MM:SS (ej. 02:15)
        display.textContent =
            `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

        if (t-- <= 0) {
            clearInterval(timerInterval);
            resendBtn.hidden = false; // muestra "Reenviar código" al expirar
        }
    };

    tick(); // ejecuta inmediatamente para evitar el delay del primer segundo
    timerInterval = setInterval(tick, 1000);
}


// ── VALIDACIÓN EN TIEMPO REAL DE CONTRASEÑAS ─────────────────────────────────
//
//  Mientras el usuario escribe en los campos de nueva contraseña,
//  se muestra feedback inmediato en #password-match-msg:
//    - Verde: "Ambas contraseñas coinciden"
//    - Rojo:  "Las contraseñas no coinciden"
//  El mensaje solo aparece una vez que el usuario empieza a escribir
//  en el campo de confirmación (para no asustar antes de tiempo).
//
//  Devuelve true/false para que app.js lo use en la validación final.

const newPassInput     = document.getElementById('new-password');
const confirmPassInput = document.getElementById('confirm-password');
const matchMsg         = document.getElementById('password-match-msg');

function checkMatch() {
    const match = newPassInput.value === confirmPassInput.value
               && newPassInput.value.length >= 8; // igual Y al menos 8 chars

    matchMsg.textContent = confirmPassInput.value // solo si el usuario ya escribió algo
        ? (match ? 'Ambas contraseñas coinciden' : 'Las contraseñas no coinciden')
        : '';

    matchMsg.classList.toggle('error', !!confirmPassInput.value && !match); // rojo si no coinciden
    return match;
}

newPassInput.addEventListener('input', checkMatch);
confirmPassInput.addEventListener('input', checkMatch);
