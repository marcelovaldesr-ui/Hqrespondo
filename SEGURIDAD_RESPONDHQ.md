# SEGURIDAD — RESPONDO HQ
Evaluación para un panel interno de 2 personas con datos comerciales reales.

## Lo que está bien resuelto
- **Auth:** Basic Auth en middleware sobre todo el panel y las APIs internas (excepto `/api/hooks/*`, que validan token propio). El header `x-hq-user` se sobrescribe siempre en el middleware — no es spoofeable desde fuera.
- **Base de datos:** RLS activado sin policies en todas las tablas → la anon key no sirve para nada; la service_role key vive solo en el servidor (nunca en el bundle del cliente).
- **Hooks n8n:** requieren `x-hq-token` igual a `HQ_API_TOKEN`; si la variable no está configurada, el hook rechaza todo (fail-closed).
- **Borrado masivo:** doble confirmación en UI + header explícito `x-confirm: BORRAR-TODO` en la API.
- **Secretos:** ninguna key con prefijo NEXT_PUBLIC salvo el link público de la demo. `.env.local` fuera de git.
- **PATCH endpoints:** whitelist de campos editables (no se puede escribir cualquier columna).

## Riesgos aceptados (documentados, no bloqueantes a esta escala)
1. **Basic Auth sin rate-limit** — mitigar con contraseñas largas (12+ caracteres, generadas). Vercel corta abusos extremos. Plan futuro: Supabase Auth cuando el equipo crezca.
2. **Si `HQ_USER/HQ_PASSWORD` no están seteados, el panel queda abierto** (por diseño, para el primer arranque). **Verificar HOY que estén configurados en Vercel.**
3. **API key de Gemini en query string** (patrón oficial de Google) — queda en logs de salida; riesgo bajo, rotable.
4. **Token único para todos los hooks** — suficiente con 1 instancia n8n; rotar si se filtra. Futuro: firma HMAC por payload.
5. **Mensajes de error de BD pasan al cliente** en algunos endpoints (útil para debug entre 2 socios; detrás de auth). Aceptado.
6. **Sin logs de auditoría** más allá de creado_por/actualizado_por en roadmap y onboarding. Aceptado.

## Checklist de verificación (hacer una vez)
- [ ] `HQ_USER/HQ_PASSWORD` y `HQ_USER_2/HQ_PASSWORD_2` configurados en Vercel (probar en incógnito que pide login).
- [ ] `HQ_API_TOKEN` configurado y distinto de valores de ejemplo.
- [ ] `curl -X POST https://TU-DEPLOY/api/hooks/bot-events -d '{}'` sin token → debe dar 401.
- [ ] La service_role key NO aparece en el código fuente del navegador (view-source / bundle).
- [ ] Restringir la key de Places en Google Cloud (por API) y la de Gemini si es posible.

## Qué NO hacer
- No usar la Cloud API de WhatsApp para outreach frío (baneo del número).
- No agregar policies RLS "para abrir" tablas al cliente — el patrón actual es server-only a propósito.
- No poner `SUPABASE_SERVICE_ROLE_KEY` ni `HQ_API_TOKEN` en workflows n8n compartidos/exportados (usar credenciales de n8n).
