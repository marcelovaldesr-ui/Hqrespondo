# OAuth de Gmail — paso a paso (para GMAIL_CLIENT_ID / SECRET / REFRESH_TOKEN)

Esto se hace **una sola vez** (~15 min). Al final tendrás 3 valores para el
`.env`. Hazlo con la sesión iniciada en la **cuenta Gmail secundaria** que usará
el agente para enviar (NO tu correo personal).

> Consejo: crea primero esa cuenta secundaria (ej. una `@gmail.com` nueva o el
> buzón `hola@respon-do.com` si tu dominio usa Google Workspace). Inicia sesión
> con ELLA en el navegador antes de empezar.

---

## Parte A — Crear el proyecto y las credenciales (Google Cloud Console)

1. Entra a **https://console.cloud.google.com** con la cuenta secundaria.
2. Arriba, en el selector de proyecto → **Nuevo proyecto** → nombre `respondo-agente` → **Crear**. Espera que quede seleccionado.
3. Menú lateral → **APIs y servicios → Biblioteca**. Busca **Gmail API** → **Habilitar**.
4. Menú → **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo** → **Crear**.
   - App name: `Respondo Agente`. Correo de asistencia y de desarrollador: tu email secundario. **Guardar y continuar**.
   - En **Permisos (scopes)** no agregues nada aquí → **Guardar y continuar**.
   - En **Usuarios de prueba** → **Add users** → agrega el email de la cuenta secundaria → **Guardar y continuar**.
   - (Queda en modo "Testing": es suficiente. No necesitas verificación de Google para uso propio.)
5. Menú → **APIs y servicios → Credenciales** → **Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - Nombre: `respondo-oauth`.
   - En **URIs de redirección autorizados** → **Agregar URI** → pega exactamente:
     ```
     https://developers.google.com/oauthplayground
     ```
   - **Crear**.
6. Aparece un cuadro con **ID de cliente** y **Secreto de cliente**. Cópialos:
   - `GMAIL_CLIENT_ID` = el ID de cliente
   - `GMAIL_CLIENT_SECRET` = el secreto de cliente

---

## Parte B — Generar el refresh token (OAuth Playground)

7. Entra a **https://developers.google.com/oauthplayground**.
8. Arriba a la derecha, clic en el **engranaje ⚙ (OAuth 2.0 configuration)**:
   - Marca **Use your own OAuth credentials**.
   - Pega tu `GMAIL_CLIENT_ID` en **OAuth Client ID** y tu `GMAIL_CLIENT_SECRET` en **OAuth Client secret**.
   - Cierra el engranaje.
9. En la columna izquierda, en el campo **"Input your own scopes"**, pega:
   ```
   https://mail.google.com/
   ```
   y clic **Authorize APIs**.
10. Se abre el login de Google → elige la **cuenta secundaria**. Verás un aviso
    de "app no verificada": clic en **Continuar / Avanzado → Ir a Respondo
    Agente (no seguro)** (es tu propia app, es seguro). Acepta los permisos.
11. Vuelves al Playground, ahora en el paso 2. Clic **Exchange authorization code for tokens**.
12. En la respuesta de la derecha aparece **Refresh token** (empieza con `1//`).
    Cópialo:
    - `GMAIL_REFRESH_TOKEN` = ese valor `1//...`
13. `GMAIL_FROM` = el email de la cuenta secundaria (ej. `hola@respon-do.com`).

---

## Parte C — Verificar

14. Carga los 4 valores (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
    `GMAIL_REFRESH_TOKEN`, `GMAIL_FROM`) en tu `.env.local` y en Vercel, redeploy.
15. Abre en el navegador (ya con `PROS_CRON_SECRET` puesto):
    ```
    https://TU-DOMINIO/api/prospeccion/salud?ping=1&key=PROS_CRON_SECRET
    ```
    En `servicios.gmail` debe decir `"envía como tu-cuenta@..."`. Si dice error,
    lo más común es que copiaste mal el refresh token o el redirect URI no
    coincide exactamente con `https://developers.google.com/oauthplayground`.

---

## Problemas típicos

- **`invalid_grant`**: el refresh token se revocó (pasa si repites el flujo o
  cambias el secret). Vuelve a la Parte B y genera uno nuevo.
- **`access_denied` / no aparece refresh token**: asegúrate de que en el paso 10
  estás usando la cuenta que agregaste como *usuario de prueba*, y que en el
  engranaje marcaste "Use your own OAuth credentials".
- **El token deja de servir tras días**: en modo "Testing" los refresh tokens de
  apps no verificadas pueden expirar a los 7 días. Para uso continuo, en la
  Pantalla de consentimiento pulsa **Publicar app** (Production). Como solo usas
  el scope de tu propia cuenta, no necesitas revisión de Google para seguir.
