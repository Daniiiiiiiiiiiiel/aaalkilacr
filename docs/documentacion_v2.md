# Especificación Técnica: Registro Multi-Rol, Verificación Biométrica y Adaptaciones del Backend
> **Plataforma:** AALkilaCR | **Fecha:** Junio 2026

Esta documentación describe las nuevas implementaciones agregadas al flujo de registro de la SPA de **AALkilaCR**, detallando la lógica del lado del cliente, la interfaz de usuario compacta y los contratos requeridos en el backend para dar soporte a los roles de **Arrendatario** y **Arrendador**.

---

## 1. Estructura de Pantallas del Registro

El flujo de autenticación ha sido segmentado en las siguientes pantallas dentro del panel derecho (`.panel-right`):

1. **`screen-tipo-cuenta` (Selección de cuenta):** Pantalla intermedia donde el usuario selecciona su rol: **Arrendatario** o **Arrendador**.
2. **`screen-arrendatario` (Registro tradicional):** Formulario sin biometría para Arrendatarios.
3. **`screen-register` (Verificación biométrica):** Interfaz compacta de subida de fotos y número de identificación para Arrendadores.
4. **`screen-credentials` (Credenciales finales):** Definición de usuario, correo y contraseña para Arrendadores cuya identidad ha sido validadas con éxito.

---

## 2. Flujo Lógico y Validación

### 2.1 Registro de Arrendatarios
* **Campos requeridos:** Nombre de usuario, Correo, Contraseña, Confirmación de contraseña, Tipo de identificación (selector) y Número de identificación.
* **Proceso:**
  1. Se realizan las validaciones de formato locales.
  2. Se envía la solicitud al backend (`registerArrendatario`).
  3. Se ejecuta en paralelo la validación en el padrón oficial del país (`verifyRegistroOficial`).
  4. Si ambas peticiones responden exitosamente, se muestra el modal de éxito.

### 2.2 Registro de Arrendadores (Flujo Biométrico)
* **Campos requeridos:** Selfie, Foto del Documento de Identificación, Tipo de identificación (selector) y Número de identificación.
* **Proceso:**
  1. El usuario sube sus fotografías y digita su número e identificación en `screen-register`.
  2. Las imágenes se procesan localmente a Base64 puro sin cabecera DataURL (`fileToBase64`).
  3. **Amazon Rekognition (`verifyFace`):** Compara el selfie con el documento y comprueba que el número ingresado coincida con la lectura del documento.
  4. **Padrón Oficial (`verifyRegistroOficial`):** Valida la existencia del documento.
  5. **Navegación:** Al validar con éxito, el controlador retiene temporalmente el tipo y número de identificación en memoria (`validatedArrendadorIdType` y `validatedArrendadorIdNumber`) y navega a `screen-credentials`.
  6. **Registro final:** El usuario crea su cuenta y se envía todo el payload unificado al backend (`registerArrendador`).

---

## 3. Selector Dinámico de Identificación

El selector del tipo de documento actualiza automáticamente el placeholder esperable y las reglas del input de número en ambos formularios:

| Valor `identificationType` | Descripción | Formato sugerido (Placeholder) |
|----------------------------|-------------|--------------------------------|
| `CEDULA` | Cédula de Identidad de Costa Rica | `1-1234-5678` |
| `DIMEX` | Identificación de Extranjeros (DIMEX) | `123456789012` |
| `PASAPORTE` | Pasaporte Internacional | `AB1234567` |
| `CEDULA_JURIDICA` | Cédula Jurídica Comercial | `3-101-123456` |

---

## 4. Diseño Compacto y Bloqueo de Scroll (`styles.css`)

Para asegurar una visualización "pixel perfect" y evitar la necesidad de desplazamiento vertical en cualquier resolución de pantalla, se implementaron las siguientes directivas:

1. **Scroll-Lock Global en Vistas de Registro:**
   Se inactiva la barra de scroll vertical (`overflow-y: hidden !important`) en las nuevas pantallas activas dentro de `.panel-right`:
   ```css
   .panel-right:has(#screen-arrendatario.active),
   .panel-right:has(#screen-credentials.active),
   .panel-right:has(#screen-register.active) {
       overflow-y: hidden !important;
   }
   ```
2. **Reorganización y Rejillas Horizontales:**
   * **`id-fields-row`:** Muestra el tipo y número de identificación de forma horizontal.
   * **`photos-row`:** Renderiza el área de Selfie y Documento lado a lado en dos columnas iguales (`1fr 1fr`).
   * **Tarjetas compactas (`file-upload-card.file-upload-card--compact`):** Reducción de su altura mínima a `70px`, achicando iconos y eliminando textos redundantes para optimizar el espacio útil vertical.
   * **Compactación de inputs:** Altura reducida de `46px` a `38px` y márgenes de form-group disminuidos a `8px`.

---

## 5. Especificaciones e Integración con el Backend

Para conectar el frontend de forma exitosa, el backend REST debe soportar los siguientes endpoints y firmas JSON:

### 5.1 Comparación Facial Biométrica
* **Método:** `POST`
* **Endpoint:** `/auth/rekognition`
* **Payload de entrada:**
  ```json
  {
      "SourceImage64x": "string (Base64 puro del selfie)",
      "TargetImage64x": "string (Base64 puro del documento)",
      "cedula": "string (número de identificación digitado por el usuario)"
  }
  ```
* **Respuesta Exitosa (`200 OK`):**
  ```json
  {
      "match": true,
      "cedula_match": true
  }
  ```
* **Respuesta de Fallo de Validación:**
  * Si la selfie no coincide con el documento (`match: false`).
  * Si el número ingresado no coincide con el escaneado en el documento (`cedula_match: false`).
  ```json
  {
      "match": false,
      "cedula_match": false,
      "detail": "Las fotos no corresponden a la misma persona o la identificación no coincide."
  }
  ```

### 5.2 Consulta al Registro Oficial (Padrón)
* **Método:** `POST`
* **Endpoint:** `/auth/verify-registro`
* **Payload de entrada:**
  ```json
  {
      "identificationNumber": "string (número de documento)",
      "identificationType": "CEDULA | DIMEX | PASAPORTE | CEDULA_JURIDICA"
  }
  ```
* **Respuesta Exitosa (`200 OK`):**
  ```json
  {
      "encontrado": true
  }
  ```

### 5.3 Endpoint de Registro General
* **Método:** `POST`
* **Endpoint:** `/auth/register`
* **Payload de entrada:**
  ```json
  {
      "username": "string (nombre de usuario)",
      "email": "string (correo del usuario)",
      "password": "string (contraseña)",
      "identificationType": "CEDULA | DIMEX | PASAPORTE | CEDULA_JURIDICA",
      "identificationNumber": "string (número de identificación)",
      "role": "arrendatario | arrendador"
  }
  ```
* **Respuesta Exitosa (`200 OK`):**
  ```json
  {
      "success": true
  }
  ```
* **Respuesta en caso de error (`400 Bad Request`):**
  ```json
  {
      "detail": "El correo o nombre de usuario ingresado ya está registrado en el sistema."
  }
  ```
