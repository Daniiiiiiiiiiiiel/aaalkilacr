'use strict'; // activa modo estricto: detecta errores antes de que causen bugs

// Oculta todas las pantallas y muestra solo la indicada por su ID.
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); // quita "active" de todas las pantallas
    document.getElementById(id)?.classList.add('active'); // añade "active" solo a la pantalla pedida
}

// Abre un modal quitando la clase "hidden" del elemento.
const openModal  = id => document.getElementById(id)?.classList.remove('hidden');
// Cierra un modal añadiendo la clase "hidden" al elemento.
const closeModal = id => document.getElementById(id)?.classList.add('hidden');

// Busca todos los botones de ojo y les añade el evento click.
document.querySelectorAll('.toggle-eye').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target); // obtiene el input asociado al botón
        if (input) input.type = input.type === 'password' ? 'text' : 'password'; // alterna entre mostrar y ocultar
    });
});

// Busca todos los botones "volver" y los conecta con su pantalla destino en data-target.
document.querySelectorAll('.back-btn').forEach(btn =>
    btn.addEventListener('click', () => showScreen(btn.dataset.target)) // navega a la pantalla indicada
);

// Obtiene todas las cajas de entrada del código OTP.
const otpBoxes = document.querySelectorAll('.otp-box');

// Añade comportamiento a cada caja OTP.
otpBoxes.forEach((box, i) => {
    box.addEventListener('input', () => {
        box.value = box.value.replace(/\D/g, '').slice(-1); // elimina todo lo que no sea dígito y conserva solo el último
        if (box.value && i < otpBoxes.length - 1) otpBoxes[i + 1].focus(); // avanza al siguiente campo si hay valor
    });
    box.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !box.value && i > 0) otpBoxes[i - 1].focus(); // retrocede al campo anterior con Backspace
    });
});

// Une el valor de las 4 cajas OTP en un solo string.
const getOtp = () => Array.from(otpBoxes).map(b => b.value).join('');

// Variable para guardar la referencia al intervalo del temporizador.
let timerInterval;

// Inicia un contador regresivo visual en el elemento #otp-timer.
function startOtpTimer(seconds) {
    clearInterval(timerInterval); // cancela cualquier temporizador anterior
    const display = document.getElementById('otp-timer'); // elemento donde se muestra el tiempo
    let t = seconds; // copia mutable del tiempo total

    const tick = () => {
        // Formatea minutos y segundos con dos dígitos y los muestra.
        display.textContent =
            `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        if (t-- <= 0) clearInterval(timerInterval); // detiene el intervalo al llegar a cero
    };

    tick(); // muestra el tiempo inicial de inmediato sin esperar el primer segundo
    timerInterval = setInterval(tick, 1000); // actualiza cada segundo
}

// Referencias a los campos de nueva contraseña y al mensaje de estado.
const newPassInput     = document.getElementById('new-password');
const confirmPassInput = document.getElementById('confirm-password');
const matchMsg         = document.getElementById('password-match-msg');

// Valida que ambas contraseñas coincidan y tengan al menos 8 caracteres.
function checkMatch() {
    const match = newPassInput.value === confirmPassInput.value && newPassInput.value.length >= 8; // true si son iguales y suficientemente largas
    matchMsg.textContent = confirmPassInput.value      // solo muestra mensaje si el usuario ya escribió algo
        ? (match ? 'Ambas contraseñas coinciden' : 'Las contraseñas no coinciden')
        : '';
    matchMsg.classList.toggle('error', !!confirmPassInput.value && !match); // añade clase "error" si no coinciden
    return match; // devuelve true/false para usarlo en la validación del botón
}

newPassInput.addEventListener('input', checkMatch);     // valida al escribir en el campo nueva contraseña
confirmPassInput.addEventListener('input', checkMatch); // valida al escribir en el campo confirmar contraseña
