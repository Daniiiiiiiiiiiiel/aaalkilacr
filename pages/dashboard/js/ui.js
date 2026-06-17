'use strict';

// ══════════════════════════════════════════════════════════════════════════════
//  ui.js (Dashboard) – Capa de vista del dashboard de usuario
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Cambia la subpágina activa dentro del apartado de Perfil.
 * @param {string} subpageId ID de la subpágina a mostrar.
 */
function showProfileSubpage(subpageId) {
    const subpages = document.querySelectorAll('.profile-subpage');
    subpages.forEach(sp => sp.classList.remove('active'));
    const target = document.getElementById(subpageId);
    if (target) {
        target.classList.add('active');
    }
}

/**
 * Cambia el paso activo en el formulario de publicar propiedad.
 * @param {number} stepNumber Número del paso (1, 2 o 3).
 */
function showFormStep(stepNumber) {
    const stepBtns = document.querySelectorAll('.step-nav-btn');
    stepBtns.forEach(btn => {
        if (parseInt(btn.getAttribute('data-step')) === stepNumber) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const stepContents = document.querySelectorAll('.form-step-content');
    stepContents.forEach((content, idx) => {
        if (idx === (stepNumber - 1)) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
}

/**
 * Actualiza el DOM del header con los datos del perfil del usuario.
 * @param {Object} profile Perfil del usuario almacenado en la sesión.
 */
function updateHeaderGreeting(profile) {
    if (!profile) return;
    const greetingEl = document.querySelector('.header-greeting');
    if (greetingEl && profile.name) {
        greetingEl.textContent = `\u00a1Hola! ${profile.name}, bienvenido.`;
    }
    const avatarEl = document.querySelector('.avatar-img');
    if (avatarEl && profile.avatar_url) {
        avatarEl.src = profile.avatar_url;
        avatarEl.alt = profile.name || 'Avatar';
    }
}

/**
 * Alterna la visibilidad del dropdown de acciones rápidas del perfil.
 * @param {Event} event Evento de click.
 */
function toggleActionsDropdown(event) {
    event.stopPropagation();
    const dropdown = document.querySelector('.profile-dropdown-menu');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

/**
 * Cierra el dropdown de acciones rápidas del perfil.
 */
function closeActionsDropdown() {
    const dropdown = document.querySelector('.profile-dropdown-menu');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}
