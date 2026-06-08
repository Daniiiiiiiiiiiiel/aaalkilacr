# Documentación Técnica: Módulo de Autenticación (AALkilaCR)

Esta documentación describe la arquitectura, flujo lógico y especificación de integración del frontend actual para el módulo de inicio de sesión y recuperación de contraseña de **AlkilaCR**.

---

## 1. Arquitectura del Frontend (Separación de Conceptos)

El desarrollo se diseñó bajo el principio de separación de responsabilidades para facilitar el mantenimiento y la futura integración de frameworks. Se divide en tres capas bien definidas mediante JavaScript vanilla en modo estricto (`'use strict'`):

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│         VISTA          │      │      CONTROLADOR       │      │         DATOS          │
│       (ui.js)          │◄────►│       (app.js)         │◄────►│       (api.js)         │
├────────────────────────┤      ├────────────────────────┤      ├────────────────────────┤
│ • Manejo de Pantallas  │      │ • Event Listeners      │      │ • Fetch / Peticiones   │
│ • Estados de Carga     │      │ • Validaciones Locales │      │ • Manejo de Tokens     │
│ • Temporizadores/OTP   │      │ • Control de Flujos    │      │ • Refresh automático   │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

---

## 2. Capa de Comunicación e Integración (`js/api.js`)

Es la única responsable de realizar peticiones de red al servidor. Ningún otro archivo interactúa con `fetch` directamente.

### Funciones Principales

#### `safeFetch(url, options)`
*   **Propósito:** Interceptar errores fatales de red (como falta de conexión a internet o caída del servidor) y traducirlos a mensajes limpios en español.

#### `authFetch(endpoint, options)`
*   **Propósito:** Realizar peticiones autenticadas adjuntando automáticamente la cabecera `Authorization: Bearer <JWT_TOKEN>`.
*   **Mecanismo de Auto-Refresh (Silent Refresh):**
    1. Si una petición protegida devuelve un código `401 Unauthorized`, `authFetch` detiene la petición.
    2. Ejecuta inmediatamente una llamada transparente a `/auth/refresh-token`.
    3. Si la renovación es exitosa, guarda el nuevo token y reintenta la petición original.
    4. Si falla la renovación, invalida los tokens guardados y redirige al usuario al inicio (`/`).

#### Gestión de Tokens y Persistencia (`saveToken`, `getToken`, `clearToken`)
*   Soporta la opción **"Recuérdame"**:
    *   Si es activa, almacena el JWT en `localStorage` (persiste tras cerrar el navegador).
    *   Si es inactiva, se almacena en `sessionStorage` (se destruye al cerrar la pestaña).

---

## 3. Capa de Control y Validaciones (`js/app.js`)

Actúa como mediador entre la interfaz y la API. Se encarga de procesar los eventos de los botones, ejecutar validaciones antes de saturar el servidor y capturar excepciones para mostrarlas al usuario.

### Flujo de Trabajo por Acción
Todos los manejadores asíncronos siguen un patrón seguro:
1. **Validación temprana:** Comprobar formatos de correo y longitudes en el cliente. Si fallan, se muestra el error inline y se detiene la ejecución inmediatamente.
2. **Estado de carga:** Cambiar el botón correspondiente a "Cargando..." y deshabilitarlo para evitar clicks repetidos (evita peticiones duplicadas en el backend).
3. **Llamada API:** Ejecutar la petición en un bloque `try/catch`.
4. **Respuesta final:** Redirigir o abrir el modal de éxito. En caso de fallo, capturar el mensaje de error y mostrarlo en la interfaz de forma nativa (eliminando los antiguos `alert()`).
5. **Limpieza:** Habilitar de nuevo el botón en el bloque `finally`.

---

## 4. Capa de Interfaz y Estados Dinámicos (`js/ui.js`)

Se encarga estrictamente de la manipulación directa del DOM y de asegurar una experiencia fluida al usuario.

### Características Clave
*   **Navegación de una sola página (SPA):** La función `showScreen(id)` oculta todas las pantallas activas y muestra la seleccionada por CSS, limpiando todos los mensajes de error en el proceso.
*   **OTP de 6 dígitos Autotab:** Controla el comportamiento de las cajas individuales de código OTP de 6 campos. Pasa el cursor automáticamente al siguiente cuadro al escribir, y retrocede al borrar (`Backspace`).
*   **Temporizador Dinámico:** Implementa una cuenta regresiva para evitar el abuso del envío de correos. Al finalizar el conteo, oculta el timer y activa el botón "Reenviar código".
*   **Validación de contraseña en vivo:** Compara en tiempo real los inputs de la nueva contraseña y su confirmación, pintando alertas visuales dinámicamente si no coinciden o no cumplen con el mínimo de 8 caracteres.

---

## 5. Especificaciones del Backend (Endpoints requeridos)

Para que el sistema de autenticación funcione de forma transparente, el backend debe proporcionar la siguiente estructura:

### 1. Iniciar sesión (`POST /auth/login`)
*   **Entrada:**
    ```json
    {
      "email": "usuario@correo.com",
      "password": "contraseña123",
      "remember": true
    }
    ```
*   **Salida Exitosa (200 OK):**
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
    ```

### 2. Olvidé mi contraseña (`POST /auth/forgot-password`)
*   **Entrada:**
    ```json
    {
      "email": "usuario@correo.com"
    }
    ```
*   **Salida Exitosa (200 OK):** `{}` *(el servidor envía el correo con el OTP).*

### 3. Verificar código OTP (`POST /auth/verify-otp`)
*   **Entrada:**
    ```json
    {
      "email": "usuario@correo.com",
      "otp": "123456"
    }
    ```
*   **Salida Exitosa (200 OK):**
    ```json
    {
      "verified": true
    }
    ```

### 4. Cambiar contraseña (`POST /auth/reset-password`)
*   **Entrada:**
    ```json
    {
      "email": "usuario@correo.com",
      "password": "nuevacontraseña123"
    }
    ```
*   **Salida Exitosa (200 OK):** `{}` *(actualiza la base de datos e invalida el OTP anterior).*

### 5. Renovar Token (`POST /auth/refresh-token`)
*   **Entrada:**
    ```json
    {
      "token": "token_expirado_actual"
    }
    ```
*   **Salida Exitosa (200 OK):**
    ```json
    {
      "token": "nuevo_token_valido"
    }
    ```