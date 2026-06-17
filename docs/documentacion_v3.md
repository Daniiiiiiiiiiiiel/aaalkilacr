# Especificación Técnica: Reestructuración Modular de Autenticación, Corrección de Layout y Wizard de Publicación
> **Plataforma:** AALkilaCR | **Versión:** 3.0 | **Fecha:** Junio 2026

Esta documentación describe la reestructuración completa de la arquitectura del frontend del proyecto **AALkilaCR**, detallando la modularización del sistema de autenticación, la limpieza de directorios, la corrección de errores de anidamiento HTML y la implementación de un formulario de publicación de propiedades secuencial (tipo Wizard).

---

## 1. Arquitectura de Archivos y Desacoplamiento (Modularización)

Para mejorar la mantenibilidad y escalabilidad del proyecto, se eliminaron los scripts monolíticos del directorio raíz y se aisló todo el ecosistema de login/registro en un subdirectorio exclusivo:

### 1.1 Configuración de Core Global (`js/core.js`)
El directorio raíz `js/` ahora se mantiene estrictamente minimalista, conteniendo únicamente el archivo de configuración global:
*   **`js/core.js`**: Define únicamente la dirección base del servidor backend (`API_BASE`), facilitando el cambio de entornos de desarrollo a producción de forma centralizada.

### 1.2 Directorio de Autenticación Centralizado (`pages/auth/`)
Todo el flujo de autenticación, recuperación de contraseña y verificación facial fue trasladado a su propia página autónoma:
*   **`pages/auth/index.html`**: Estructura de vistas única (SPA) para login, selección de rol, registro de arrendatario, verificación biométrica de arrendador y recuperación por OTP.
*   **`pages/auth/css/styles.css`**: Contiene exclusivamente los estilos CSS relativos a las tarjetas de carga, modales, transiciones y elementos biométricos del registro.
*   **`pages/auth/js/api.js`**: Capa del modelo (Model). Centraliza la lógica de tokens (`access_token` y `refresh_token`), persistencia en localStorage, renovación automática de sesión (`tryRefreshToken`) y peticiones seguras (`authFetch` / `safeFetch`).
*   **`pages/auth/js/ui.js`**: Capa de la vista (View). Administra la transición visual entre pantallas de autenticación (`showScreen`), manejo de modales, visualización de errores inline, y vistas previas de imágenes.
*   **`pages/auth/js/app.js`**: Capa del controlador (Controller). Registra los listeners de eventos, realiza validaciones del lado del cliente antes del envío de peticiones, e interactúa con la API.

### 1.3 Página de Redirección Raíz (`index.html`)
El archivo de entrada principal en el raíz (`index.html`) ahora funciona únicamente como una compuerta de redirección automática hacia `pages/auth/index.html` mediante un refresco meta de HTML. Su CSS correspondiente en `css/styles.css` fue reducido a un diseño simple para el mensaje temporal de redirección.

---

## 2. Corrección del Layout del Dashboard (`pages/dashboard/`)

Se identificó y resolvió un fallo crítico de anidamiento HTML en la estructura del panel principal:
*   **Problema original:** Los contenedores `.sidebar-footer` y la etiqueta principal `<aside class="dashboard-sidebar">` no se cerraban correctamente. Esto causaba que el navegador interpretara al contenedor `<main class="dashboard-main">` como parte del pie de página de la barra lateral, renderizando la sección de perfil y otros contenidos de manera recortada y aplastada en la zona izquierda.
*   **Solución:** Se cerraron debidamente los elementos del sidebar en la línea 90-95 de `pages/dashboard/index.html` antes de iniciar la sección de contenido principal:
    ```html
                </div>
            </aside>
    
            <!-- ── MAIN CONTENT ── -->
            <main class="dashboard-main">
    ```

---

## 3. Flag de Depuración del Route Guard

Para optimizar el desarrollo e inspección visual en local sin necesidad de levantar servicios del backend o requerir una sesión activa en cada recarga:
*   Se introdujo una variable bandera `BYPASS_ROUTE_GUARD = true` en la parte superior de `pages/dashboard/js/app.js`.
*   Al estar en `true`, se omite la validación de tokens y el desvío automático a la página de login, permitiendo probar rutas y elementos directamente. Debe configurarse en `false` para producción.

---

## 4. Wizard Secuencial de Publicación ("Publicar Propiedad")

Anteriormente, el formulario de subida de propiedades mostraba todos los campos y pasos en una única vista vertical continua, lo que obligaba al usuario a realizar un scroll extenso y confuso.

### 4.1 Modificaciones CSS para Visualización Unitaria
Se añadieron reglas específicas en `pages/dashboard/css/dashboard.css` para ocultar los contenedores de paso inactivos y revelar únicamente el actual:
```css
.form-step-content {
    display: none;
    animation: fadeIn 0.3s ease;
}

.form-step-content.active {
    display: block;
}
```

### 4.2 Navegación Guiada y Botones "Continuar"
*   Se añadieron botones interactivos con clase `.btn-next-step` y atributos `data-next` al término del Paso 1 (Datos Generales) y del Paso 2 (Descripción & Fotos).
*   Se estilizaron de forma consistente con la UI del sistema (color corporativo `#4b6beb`, bordes redondeados de `30px`, texto en negrita y efectos de transición y hover).
*   El controlador en `app.js` captura el evento click, ejecuta el cambio de pestaña superior, desplaza la pantalla suavemente hacia arriba (`window.scrollTo`) e intercambia las clases activas.
*   El botón final de envío de formulario ("Enviar Publicación") fue reubicado para aparecer únicamente dentro del Paso 3 (Ubicación).

### 4.3 Control de Caché en el Navegador
Para evitar que los navegadores mantengan versiones en caché de las hojas de estilo y scripts antiguos durante el desarrollo, se implementó un control de versiones por query param:
*   `<link rel="stylesheet" href="css/dashboard.css?v=1.1">`
*   `<script src="js/app.js?v=1.1"></script>` (aplicado a todos los scripts del dashboard).

---

## 5. Resumen de Criterios de Seguridad (Login/Registro)

*   **Bypass de Frontend:** Toda redirección y guardado de datos en el cliente (como `showScreen`) es visual. Aunque un atacante intente evadir las transiciones visuales mediante JS o la consola, el backend debe validar cada payload (como la comparación facial previa) de forma transaccional.
*   **Persistencia de Tokens:** Los tokens se refrescan de forma segura mediante llamadas asíncronas asiladas en `authFetch()`, lo que aísla las claves de sesión de interceptaciones básicas del DOM.
