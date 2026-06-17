# AALkilaCR – Documentación Técnica v2.0
> **Fecha:** Junio 2026 | **Rama:** `main` | **Repositorio:** [github.com/Daniiiiiiiiiiiiel/aaalkilacr](https://github.com/Daniiiiiiiiiiiiel/aaalkilacr.git)

---

## 1. Descripción General del Proyecto

**AALkilaCR** es una plataforma web de bienes raíces para Costa Rica. Permite a inquilinos y propietarios conectarse de forma segura mediante un flujo de autenticación multi-etapa con verificación facial biométrica (Amazon Rekognition).

El proyecto es una Single Page Application (SPA) implementada con HTML5, CSS3 y JavaScript vanilla puro, sin frameworks. La arquitectura sigue un patrón MVC simplificado:

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| **Vista** | `js/ui.js` | Manipulación del DOM, animaciones, feedback visual |
| **Controlador** | `js/app.js` | Event listeners, validaciones, coordinación de flujos |
| **Modelo/API** | `js/api.js` | Comunicación con el backend REST, gestión de tokens |
| **Estilos Auth** | `css/styles.css` | Diseño del módulo de autenticación |
| **Dashboard** | `dashboard/` | Página principal post-login |

---

## 2. Estructura de Archivos

```
aalkila.cr/
├── index.html                  # SPA de autenticación (5 pantallas)
├── css/
│   └── styles.css              # Estilos del módulo auth
├── js/
│   ├── api.js                  # Capa de API + gestión de tokens
│   ├── app.js                  # Controlador principal (event listeners)
│   └── ui.js                   # Capa de vista / utilidades DOM
├── dashboard/
│   ├── index.html              # Dashboard principal post-login
│   └── dashboard.css           # Estilos exclusivos del dashboard
└── assets/
    └── logo_2.png              # Logotipo de la marca
```

---

## 3. Módulo de Autenticación (`index.html` + `js/`)

### 3.1 Arquitectura de Pantallas

La SPA maneja 5 pantallas (`<div class="screen">`) que se intercambian con `showScreen(id)`. Solo una tiene la clase `active` en cada momento.

| ID de Pantalla | Nombre | Función |
|----------------|--------|---------|
| `screen-login` | Login | Inicio de sesión con email/contraseña |
| `screen-forgot` | Recuperar contraseña | Solicitud de OTP por email |
| `screen-otp` | Verificar OTP | Ingreso del código de 6 dígitos |
| `screen-newpass` | Nueva contraseña | Restablecimiento con validación en tiempo real |
| `screen-register` | Registro / Verificación Facial | **NUEVO** – Subida de selfie y cédula |

### 3.2 Flujo de Usuario Completo

```
[Login] ──────────────────────────────────────→ [Dashboard]
   │                                                  ↑
   │ ¿Olvidaste tu contraseña?              loginUser() → redirect
   ↓
[Recuperar] → sendResetEmail() → Modal email enviado
   ↓
[OTP] → verifyOtp() → guarda tokens en storage
   ↓
[Nueva Contraseña] → resetPassword() → Modal éxito
   ↓
[Login] ← vuelve limpio

[Login] → btn-go-register
   ↓
[Registro / Verificación Facial] → verifyFace() → [Login]
```

### 3.3 Auto-Login al Cargar la Página

```javascript
window.addEventListener('DOMContentLoaded', async () => {
    const hasRefresh = getRefreshToken();
    if (hasRefresh) {
        const isValid = await tryRefreshToken();
        if (isValid) window.location.href = 'dashboard/index.html';
    }
});
```

Si el usuario tiene un `refresh_token` guardado (sesión recordada), se valida automáticamente con el backend. Si es válido, se redirige directo al dashboard sin mostrar el login.

---

## 4. Capa de API (`js/api.js`) – Cambios y Nuevas Funciones

### 4.1 Gestión de Tokens (Dual Storage)

El sistema maneja dos tokens con estrategias de persistencia distintas:

| Token | Storage | Persistencia | Cuándo se limpia |
|-------|---------|-------------|-----------------|
| `access_token` | `sessionStorage` o `localStorage` | Según "Recuérdame" | `clearToken()` |
| `refresh_token` | `localStorage` | Siempre | Solo en `clearToken()` |

**`saveToken(token, remember, refreshToken)`** — Guarda ambos tokens. El `access_token` va a `localStorage` si `remember=true`, o a `sessionStorage` si no. El `refresh_token` siempre va a `localStorage`.

**`getToken()` / `getRefreshToken()`** — Recuperan los tokens del storage correspondiente.

**`clearToken()`** — Limpia ambos tokens de todos los storages.

### 4.2 Endpoints Actualizados (Adaptación al Backend Real)

Los endpoints fueron renombrados y los parámetros ajustados para coincidir exactamente con el backend FastAPI:

| Función | Endpoint anterior | Endpoint actual | Cambios relevantes |
|---------|------------------|-----------------|-------------------|
| `sendResetEmail()` | `POST /auth/forgot-password` | `POST /auth/send_otp` | — |
| `verifyOtp()` | `POST /auth/verify-otp` | `POST /auth/verify_otp` | Body: `{ email, token, type: 'recovery' }` |
| `resetPassword()` | `POST /auth/reset-password` | `POST /auth/reset_password` | Body: `{ token, refresh_token, new_password }` |
| `tryRefreshToken()` | `POST /auth/refresh-token` | `POST /auth/refresh_token` | Body: `{ refresh_token }` |
| `loginUser()` | `POST /auth/login` | `POST /auth/login` | Ahora guarda también `refresh_token` |

**Errores:** Todos los mensajes de error ahora leen `data.detail` (estándar FastAPI) en lugar de `data.message`.

### 4.3 `verifyOtp()` – Guarda Tokens de Recuperación

Después de verificar el OTP correctamente, `verifyOtp()` guarda los tokens de recuperación directamente en storage para que `resetPassword()` pueda usarlos en el siguiente paso:

```javascript
saveToken(data.token, true, data.refresh_token);
```

Esto elimina la necesidad de pasar el email entre pantallas y hace el flujo de recuperación stateless desde la perspectiva del DOM.

### 4.4 `resetPassword()` – Nueva Firma

```javascript
// Antes:
async function resetPassword(email, password)

// Ahora:
async function resetPassword(token, refreshToken, newPassword)
```

Lee los tokens del storage (guardados por `verifyOtp`) y los envía en el body junto a la nueva contraseña.

### 4.5 `verifyFace()` – **NUEVA FUNCIÓN**

```javascript
async function verifyFace(sourceBase64, targetBase64)
```

**Endpoint:** `POST /auth/rekognition`

**Body enviado:**
```json
{
    "SourceImage64x": "<base64 del selfie>",
    "TargetImage64x": "<base64 de la cédula>"
}
```

**Respuesta esperada:**
- `200 OK` → `{ match: true }` → verificación exitosa
- `200 OK` → `{ match: false, detail: "..." }` → caras no coinciden
- `4xx` → `{ detail: "..." }` → error procesable

La función lanza un `Error` con el mensaje del backend si `res.ok === false` o si `data.match === false`. Si no lanza excepción, la verificación fue exitosa.

### 4.6 `validateImageFile()` – **NUEVA FUNCIÓN**

```javascript
function validateImageFile(file, maxMb = 4)
```

Valida localmente un archivo antes de enviarlo al backend:
1. **Tipo de archivo:** Solo acepta `image/jpeg`, `image/png`, `image/webp`, `image/gif`
2. **Tamaño máximo:** 4 MB por defecto (configurable)

Lanza un `Error` descriptivo si alguna condición falla, capturado en `app.js` para mostrarse inline.

---

## 5. Controlador (`js/app.js`) – Cambios y Nuevas Funciones

### 5.1 Patrón Estándar de cada Listener

Todos los event listeners siguen el mismo patrón para mantener consistencia:

```javascript
document.getElementById('btn-X').addEventListener('click', async () => {
    // 1. Validaciones cliente (early return si hay error)
    if (!input) { showError('error-X', 'Mensaje'); return; }

    clearError('error-X');
    setLoading(btn, true);

    try {
        await funcionDeApi();
        // Manejar éxito: navegación, modal, etc.
    } catch (err) {
        showError('error-X', err.message);
    } finally {
        setLoading(btn, false); // siempre, incluso si hay excepción
    }
});
```

### 5.2 OTP Limiter – Control Local de Intentos

```javascript
let otpAttempts = 0;
const OTP_MAX_ATTEMPTS = 3;
```

El frontend controla cuántos intentos fallidos permite antes de bloquear el botón y pedir reenvío. Esto protege al usuario de que el backend lo bloquee a nivel de cuenta.

- Cada intento fallido: incrementa `otpAttempts` y muestra cuántos quedan
- Al llegar a 3: deshabilita el botón y lo marca como "Bloqueado"
- Al reenviar código: resetea `otpAttempts = 0` y reactiva el botón

### 5.3 Pantalla de Registro Facial – **NUEVO**

#### `clearRegistrationInputs()`

Limpia todos los campos e imágenes de vista previa de la pantalla de registro al entrar o salir de ella. Garantiza que el formulario esté siempre limpio al navegar.

#### `fileToBase64(file)` → `Promise<string>`

Convierte un archivo de imagen a Base64 puro (sin prefijo `data:image/...;base64,`) usando `FileReader` y `ArrayBuffer`. Esto es requerido por el endpoint `/auth/rekognition` que espera Base64 raw.

```javascript
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
```

#### Listener `btn-register-submit`

Flujo completo del botón "Enviar verificación":

1. Verifica que ambos archivos (`selfie` y `cédula`) estén seleccionados
2. Valida tipo y tamaño con `validateImageFile()` (máx 4 MB, solo imágenes)
3. Convierte ambos a Base64 con `fileToBase64()`
4. Llama a `verifyFace(selfieBase64, cedulaBase64)`
5. Si éxito: limpia el formulario y navega a `screen-login`
6. Si error: muestra mensaje inline

#### `setupFilePreview(inputId, cardId)`

Inicializa la lógica de vista previa para cada tarjeta de subida de imagen:

- **Al seleccionar archivo:** valida con `validateImageFile()` antes de previsualizar. Si es válido, muestra nombre del archivo y thumbnail. Si es inválido, resetea la tarjeta y muestra error.
- **Botón "×" (eliminar):** usa `stopPropagation()` para evitar abrir el selector de archivos nativo, y resetea el estado de la tarjeta.
- **Estado `has-preview`:** clase CSS que activa el overlay "Cambiar imagen" al hacer hover.

---

## 6. Vista (`js/ui.js`) – Cambios

### 6.1 Toggle de Contraseña con Íconos Dinámicos

El toggle de contraseña ahora actualiza visualmente el ícono SVG además de cambiar el tipo del input:

- **Contraseña oculta:** ícono de ojo abierto + `aria-label="Mostrar contraseña"`
- **Contraseña visible:** ícono de ojo tachado + `aria-label="Ocultar contraseña"`

Los SVGs están definidos como constantes (`EYE_OPEN_SVG`, `EYE_CLOSED_SVG`) al inicio del bloque.

### 6.2 Supresión del Botón Nativo de Edge/IE

En `css/styles.css` se oculta el botón nativo de revelar contraseña de Edge e Internet Explorer para evitar conflicto con el toggle personalizado:

```css
input[type="password"]::-ms-reveal,
input[type="password"]::-ms-clear {
    display: none;
}
```

---

## 7. Estilos (`css/styles.css`) – Cambios

### 7.1 Scroll Lock en Pantallas de Autenticación

El layout ahora está fijo al viewport para evitar que el scroll de la pantalla de registro (que es más alta) "rompa" las otras pantallas:

```css
html, body {
    height: 100%;
    width: 100%;
    overflow-y: hidden;
    position: fixed;
}

.page-layout {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    overflow-y: hidden;
}
```

El panel derecho tiene `overflow-y: auto` para scrollear internamente, y se bloquea ese scroll solo en las pantallas que no lo necesitan:

```css
.panel-right:has(#screen-login.active),
.panel-right:has(#screen-forgot.active),
.panel-right:has(#screen-newpass.active),
.panel-right:has(#screen-register.active),
.panel-right:has(#screen-otp.active) {
    overflow-y: hidden !important;
}
```

### 7.2 Cards de Subida de Imagen (`.file-upload-card`) – **NUEVO**

Sistema de tarjetas de arrastrar/soltar visual para los inputs de archivo:

| Estado | Comportamiento CSS |
|--------|-------------------|
| **Default** | Borde punteado gris, ícono y texto instructivo |
| **Hover** | Borde azul primario, ícono cambia a azul |
| **Con imagen** (`.has-preview`) | Imagen cubre toda la tarjeta con `object-fit: contain` |
| **Hover con imagen** | Overlay semitransparente "Cambiar imagen" (opacity transition) |
| **Botón ×** | Círculo oscuro esquina superior derecha, rojo al hover |

```css
.file-upload-card {
    border: 2px dashed var(--gray-border);
    border-radius: var(--radius);
    min-height: 120px;
    transition: all var(--transition);
    position: relative;
    overflow: hidden;
}

.file-upload-card .image-preview {
    position: absolute;
    inset: 0;
    object-fit: contain;
    z-index: 2;
}
```

---

## 8. Dashboard (`dashboard/`) – **NUEVO MÓDULO**

### 8.1 Descripción General

El dashboard es una página separada (`dashboard/index.html`) con su propio stylesheet (`dashboard.css`). Se accede solo si el usuario tiene un token válido; de lo contrario, redirige al login.

```javascript
// Protección de ruta (inline en dashboard/index.html)
if (!getToken()) {
    window.location.href = '../';
}
```

### 8.2 Layout

```
┌─────────────────────────────────────────────────────┐
│  HEADER (80px, sticky)                              │
│  Logo | Divider | Saludo   Publicar | 🔔 | Avatar   │
├──────────┬──────────────────────────────────────────┤
│          │  MAIN CONTENT                            │
│ SIDEBAR  │  "Encuentra tu próximo hogar..."         │
│ (250px)  │                                          │
│          │  ┌──── CONTENT CONTAINER ─────────────┐  │
│ • Inicio │  │  [Tabs: Alquiler | Venta]           │  │
│ • Buscar │  │  [Search Bar: Tipo | Ubicación |    │  │
│ • Chat   │  │   Precio Mín | Precio Máx | Buscar] │  │
│ • Favs   │  │  [Ordenar por: ▼]                   │  │
│ • Perfil │  │  [Cards de propiedades x3]          │  │
│          │  └─────────────────────────────────────┘  │
│ Cerrar   │                                          │
│ Sesión   │                                          │
└──────────┴──────────────────────────────────────────┘
```

### 8.3 Componentes del Header

- **Logo:** `assets/logo_2.png` con `height: 34px`
- **Divider:** línea vertical decorativa
- **Saludo:** texto de bienvenida personalizado (hardcoded por ahora: "Alex")
- **Botón "Publicar Propiedad":** CTA principal, color primario, bordes redondeados
- **Campana de notificaciones:** ícono SVG con badge rojo de punto, hover con fondo gris
- **Avatar:** imagen circular `42×42px` con borde azul sutil

### 8.4 Sidebar

Navegación lateral con 5 secciones:

| Ícono | Label | Estado |
|-------|-------|--------|
| 🏠 | Inicio | Activo (fondo azul claro) |
| 🔍 | Buscar | Inactivo |
| 💬 | Chat | Inactivo |
| ❤️ | Favoritos | Inactivo |
| 👤 | Mi Perfil | Inactivo |

Footer del sidebar: botón "Cerrar Sesión" en rojo que llama a `clearToken()` y redirige a `../index.html`.

### 8.5 Buscador de Propiedades

**Tabs (Alquiler / Venta):** Interactivos vía JavaScript inline. Al hacer click se quita la clase `active` de todos y se agrega al seleccionado.

**Barra de búsqueda** (`search-bar` — CSS Grid 6 columnas):
1. Selector de tipo de propiedad (Apartamento / Casa / Estudio)
2. Selector de ubicación (San José / Desamparados / Gravilias)
3. Input precio mínimo (símbolo ₡)
4. Input precio máximo (símbolo ₡)
5. Botón "Buscar" (azul primario)
6. Botón de filtros avanzados (ícono sliders)

**Fila de ordenamiento:** "Ordenar por:" + select (Menor Precio / Mayor Precio / Recientes). Solo visible en desktop.

### 8.6 Cards de Propiedades

Grilla de 3 columnas con 3 propiedades de ejemplo:

| Propiedad | Ubicación | Precio | Hab | Baños | Parq | Área |
|-----------|-----------|--------|-----|-------|------|------|
| Moderno Apartamento en Gravilias | Gravilias, Desamparados | ₡275,000 | 3 | 1 | 1 | 49m² |
| Amplio Apartamento en Torre | San José | ₡325,000 | 2 | 1 | 1 | 48m² |
| Apto céntrico en Desamparados | Desamparados | ₡245,000 | 2 | 1 | 1 | 45m² |

Cada card incluye:
- Imagen con zoom suave al hover (`scale(1.05)`)
- Título y badge de precio en azul claro
- Ubicación con ícono de pin
- Especificaciones (dormitorios, baños, parqueos, área, personas) con íconos SVG

**Botón carousel "›":** Posicionado absolutamente a la derecha del wrapper, con sombra y hover de escala.

### 8.7 `dashboard.css` – Sistema de Diseño

```css
:root {
    --primary:        #0a3875;   /* Azul primario de marca */
    --primary-hover:  #072b5c;
    --secondary:      #e6f0fa;   /* Azul claro (badges, activos) */
    --bg-light:       #f4f6fc;   /* Fondo gris azulado */
    --text-main:      #0f294a;
    --text-muted:     #9ca3af;
    --font:           'Nunito', sans-serif;

    --shadow-sm/md/lg: escalas de sombras sutiles
    --radius-sm/md/lg: 8px / 12px / 24px
    --transition:      0.25s ease
}
```

**Fondo del layout:** El área principal tiene un fondo de imagen de San José, Costa Rica con overlay para garantizar legibilidad:

```css
.dashboard-layout {
    background: linear-gradient(rgba(244,246,252,0.85), rgba(244,246,252,0.85)),
        url('...san-jose-costa-rica...') center/cover no-repeat;
}
```

### 8.8 Responsividad del Dashboard

**≤1100px:** La grilla de propiedades pasa de 3 a 2 columnas. La tercera card se oculta.

**≤900px (móvil):**
- Header reducido a 70px, se oculta el botón "Publicar Propiedad"
- Sidebar completamente oculto (`display: none`)
- Barra de búsqueda pasa a una sola columna (stacked)
- Aparece fila de filtros mobile (`mobile-filters-row`) con select de ordenamiento y botón "Filtros"
- El `content-container` pierde fondo y padding (las tarjetas se ven como secciones independientes)

---

## 9. Seguridad y Consideraciones Técnicas

| Mecanismo | Descripción |
|-----------|-------------|
| **Doble token** | `access_token` + `refresh_token` para sesiones largas sin re-login |
| **Auto-refresh** | `tryRefreshToken()` en `DOMContentLoaded` renueva sesiones automáticamente |
| **Validación cliente** | Email (regex), contraseña (mín 8 chars), archivos (tipo + tamaño) antes de cada fetch |
| **OTP Limiter** | Máx 3 intentos locales antes de bloquear. Resetea al reenviar código |
| **Base64 raw** | `fileToBase64()` produce Base64 puro (sin prefijo DataURL) para Rekognition |
| **Ruta protegida** | El dashboard verifica `getToken()` al cargar; redirige si no hay sesión |
| **Supresión IE/Edge** | `::-ms-reveal` y `::-ms-clear` ocultos para evitar doble botón de ojo |
| **Propagation stop** | `stopPropagation()` en botón "×" evita abrir el file picker involuntariamente |

---

## 10. Endpoints del Backend (Resumen)

Base URL configurable en `api.js` → `const API_BASE = '...'`

| Método | Endpoint | Body | Respuesta exitosa |
|--------|----------|------|-------------------|
| `POST` | `/auth/login` | `{ email, password, remember }` | `{ token, refresh_token }` |
| `POST` | `/auth/send_otp` | `{ email }` | `200 OK` vacío |
| `POST` | `/auth/verify_otp` | `{ email, token, type }` | `{ token, refresh_token }` |
| `POST` | `/auth/reset_password` | `{ token, refresh_token, new_password }` | `200 OK` vacío |
| `POST` | `/auth/refresh_token` | `{ refresh_token }` | `{ token, refresh_token }` |
| `POST` | `/auth/rekognition` | `{ SourceImage64x, TargetImage64x }` | `{ match: boolean, detail? }` |

---

## 11. Dependencias Externas

| Recurso | Uso | Carga |
|---------|-----|-------|
| Google Fonts – Nunito | Tipografía principal | CDN (`<link>`) |
| Unsplash | Imágenes de propiedades y avatar (demo) | URL directa |
| Amazon Rekognition | Comparación facial biométrica | Vía backend |

No se usa ningún framework JavaScript ni librería CSS externa.

---

## 12. Próximos Pasos (Roadmap)

- [ ] Conectar formulario de registro con endpoint de creación de cuenta
- [ ] Implementar OAuth (Google / Facebook) — stubs ya presentes en `app.js`
- [ ] Conectar buscador del dashboard con API de listados de propiedades
- [ ] Funcionalidad del botón "Publicar Propiedad"
- [ ] Implementar Chat y Favoritos
- [ ] Internacionalización (i18n) para inglés
- [ ] Testing E2E con Playwright o Cypress
