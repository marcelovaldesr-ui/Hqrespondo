# VARIABLES DE ENTORNO — RESPONDO HQ
Configurar en `.env.local` (desarrollo) y en Vercel → Settings → Environment Variables (producción, redeploy después de cambiar). Plantilla: `.env.example`.

| Variable | Obligatoria | Para qué | Notas |
|---|---|---|---|
| `SUPABASE_URL` | Sí | Conexión a la base | Settings → API del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Acceso servidor (ignora RLS) | **NUNCA** exponer al cliente ni prefijarla NEXT_PUBLIC |
| `GEMINI_API_KEY` | Sí (para scoring/brief) | IA de scoring, mensajes y briefs | aistudio.google.com; sin ella hay fallbacks básicos |
| `GEMINI_MODEL` | No | Modelo principal | default `gemini-2.5-flash`; fallback automático ante 429/500/503 |
| `GEMINI_MAPS_GROUNDING` | No | Scoring con datos frescos de Maps | `1` para activar; verificar condiciones de cuota antes |
| `GOOGLE_PLACES_API_KEY` | Sí (para prospección) | Búsqueda de negocios | Requiere facturación activa en Google Cloud |
| `HQ_USER` / `HQ_PASSWORD` | **Sí en producción** | Basic Auth socio 1 | ⚠ Sin credenciales el panel queda ABIERTO |
| `HQ_USER_2` / `HQ_PASSWORD_2` | No | Basic Auth socio 2 | Permite registrar quién hizo qué (x-hq-user) |
| `HQ_API_TOKEN` | Sí (para n8n) | Valida hooks `/api/hooks/*` | Generar largo y aleatorio; mismo valor en n8n |
| `NEXT_PUBLIC_DEMO_LINK` | Recomendada | Link demo en plantillas de follow-up | **Nueva (jul-2026)**; si falta queda "[link demo]" |
| `WHATSAPP_PHONE_ID` / `WHATSAPP_TOKEN` | No | Alertas y brief a tu WhatsApp | Cloud API; solo notificaciones internas |
| `MI_WHATSAPP` | No | Destino de alertas/brief | Formato 569XXXXXXXX |

Reglas: ninguna key sensible lleva prefijo `NEXT_PUBLIC_` (solo el link de demo, que es público por naturaleza) · rotar `HQ_API_TOKEN` y `SUPABASE_SERVICE_ROLE_KEY` si se sospecha filtración · no commitear `.env.local` (ya está en .gitignore).
