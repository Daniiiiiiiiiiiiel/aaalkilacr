'use strict';

// ══════════════════════════════════════════════════════════════════════════════
//  app.js (Dashboard) – Orquestador de la inicialización y eventos del dashboard
// ══════════════════════════════════════════════════════════════════════════════

// Flag de depuración para desactivar el Route Guard en desarrollo
const BYPASS_ROUTE_GUARD = true; // Cambiá a false en producción

(async () => {
    // ── ROUTE GUARD (asíncrono) ──
    // Si el usuario tiene un refresh_token pero NO un access_token (p.ej. al
    // abrir el navegador al día siguiente), intentamos renovar la sesión primero.
    // Solo redirigimos al login si definitivamente no hay sesión válida.
    if (!BYPASS_ROUTE_GUARD) {
        if (!getToken()) {
            const refreshed = getRefreshToken() ? await tryRefreshToken() : false;
            if (!refreshed) {
                window.location.href = '../../index.html';
                return;
            }
        }
    }

    // ── INICIALIZACIÓN DE DATOS DINÁMICOS ──
    const profile = getUserProfile();
    updateHeaderGreeting(profile);

    // ── NAVEGACIÓN MENÚ LATERAL (SIDEBAR) ──
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const sections = document.querySelectorAll('.dashboard-section');

    menuItems.forEach((item, index) => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            menuItems.forEach(mi => mi.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(sec => sec.classList.remove('active'));
            if (sections[index]) {
                sections[index].classList.add('active');
            }

            // Si entra a Perfil, siempre inicia en el home del perfil
            if (index === 4) {
                showProfileSubpage('profile-home');
            }
        });
    });

    // Acceso directo a publicar desde el botón del Header
    const btnPublishHeader = document.querySelector('.btn-publish');
    if (btnPublishHeader) {
        btnPublishHeader.addEventListener('click', () => {
            menuItems.forEach(mi => mi.classList.remove('active'));
            if (menuItems[4]) menuItems[4].classList.add('active');

            sections.forEach(sec => sec.classList.remove('active'));
            const secPerfil = document.getElementById('section-perfil');
            if (secPerfil) secPerfil.classList.add('active');

            showProfileSubpage('profile-publish');
            showFormStep(1);
        });
    }

    // ── NAVEGACIÓN SUBPÁGINAS DE PERFIL ──
    const btnGotoPublish = document.getElementById('btn-goto-publish');
    if (btnGotoPublish) {
        btnGotoPublish.addEventListener('click', () => {
            showProfileSubpage('profile-publish');
            showFormStep(1);
        });
    }

    const btnGotoManage = document.getElementById('btn-goto-manage');
    if (btnGotoManage) {
        btnGotoManage.addEventListener('click', () => {
            showProfileSubpage('profile-manage');
        });
    }

    const btnGotoConfig = document.getElementById('btn-goto-config');
    if (btnGotoConfig) {
        btnGotoConfig.addEventListener('click', () => {
            showProfileSubpage('profile-config');
        });
    }

    document.querySelectorAll('.btn-subpage-back').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            showProfileSubpage(target);
        });
    });

    // ── PASOS DEL FORMULARIO PUBLICAR ──
    document.querySelectorAll('.step-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const step = parseInt(btn.getAttribute('data-step'));
            showFormStep(step);
        });
    });

    document.querySelectorAll('.btn-next-step').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const nextStep = parseInt(btn.getAttribute('data-next'));
            showFormStep(nextStep);
            
            // Opcional: Desplazar hacia arriba para ver el nuevo paso desde el inicio
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // Submit del formulario publicar propiedad
    const formPublish = document.getElementById('form-publish-property');
    if (formPublish) {
        formPublish.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Simular deshabilitar el botón de envío
            const submitBtn = formPublish.querySelector('.btn-submit-publish');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Enviando...';
            }

            try {
                // Recopilación de campos
                const formData = {
                    title: document.querySelector('.form-stacked-input')?.value || '',
                    description: document.querySelector('.form-stacked-textarea')?.value || ''
                };
                
                const res = await apiPublishProperty(formData);
                if (res.success) {
                    alert(res.message);
                    formPublish.reset();
                    showProfileSubpage('profile-home');
                }
            } catch (err) {
                alert('Ocurrió un error al enviar la publicación.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Enviar Publicación';
                }
            }
        });
    }

    // ── CANCELAR PUBLICACIONES (ADMINISTRAR) ──
    document.querySelectorAll('.btn-cancel-publish').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const parentRow = btn.closest('.manage-property-row');
            const propertyTitle = parentRow?.querySelector('.manage-title')?.textContent || 'Propiedad';
            
            if (confirm(`\u00bfEst\u00e1s seguro de que deseas cancelar la publicaci\u00f3n de: "${propertyTitle}"?`)) {
                btn.disabled = true;
                btn.textContent = 'Cancelando...';
                try {
                    const res = await apiCancelPublication('some-id');
                    if (res.success) {
                        alert(res.message);
                        parentRow?.remove();
                    }
                } catch {
                    alert('Error al intentar cancelar la publicación.');
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Cancelar Publicación';
                }
            }
        });
    });

    // ── MENÚ DE ACCIONES TRIPLE PUNTO (PERFIL) ──
    const btnActions = document.querySelector('.btn-actions-trigger');
    if (btnActions) {
        btnActions.addEventListener('click', toggleActionsDropdown);
        document.addEventListener('click', closeActionsDropdown);
    }

    // ── CERRAR SESIÓN ──
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            clearToken();
            window.location.href = '../../index.html';
        });
    }
})();
