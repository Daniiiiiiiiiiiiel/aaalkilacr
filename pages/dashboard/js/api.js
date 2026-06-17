'use strict';

// ══════════════════════════════════════════════════════════════════════════════
//  api.js (Dashboard)  –  Llamadas HTTP exclusivas del dashboard
//
//  Depende de: js/core.js  (API_BASE, authFetch, getToken, clearToken,
//                            getUserProfile, getRefreshToken, tryRefreshToken)
//  No duplica ninguna función de core.js.
// ══════════════════════════════════════════════════════════════════════════════


// ── apiPublishProperty ────────────────────────────────────────────────────────
//
//  Envía los datos de una nueva propiedad al backend.
//  En producción usará authFetch('/properties', { method: 'POST', ... })

async function apiPublishProperty(propertyData) {
    // TODO: return await authFetch('/properties', { method: 'POST', body: JSON.stringify(propertyData) });
    return new Promise((resolve) => {
        setTimeout(() => resolve({ success: true, message: 'Propiedad publicada con éxito' }), 800);
    });
}


// ── apiCancelPublication ──────────────────────────────────────────────────────
//
//  Cancela una publicación activa por su ID.
//  En producción usará authFetch(`/properties/${propertyId}`, { method: 'DELETE' })

async function apiCancelPublication(propertyId) {
    // TODO: return await authFetch(`/properties/${propertyId}`, { method: 'DELETE' });
    return new Promise((resolve) => {
        setTimeout(() => resolve({ success: true, message: 'Publicación cancelada' }), 500);
    });
}
