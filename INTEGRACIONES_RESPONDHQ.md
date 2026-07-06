# INTEGRACIONES — RESPONDO HQ

## 1. Hooks para n8n (todos requieren header `x-hq-token: <HQ_API_TOKEN>`)

### POST /api/hooks/bot-events
Registra actividad de los bots de clientes.
```json
{
  "tipo": "mensaje | error | heartbeat | lead_captured | quote_generated | meeting_booked | human_handoff",
  "client_id": "uuid (opcional)",
  "workflow_id": "id del workflow n8n (alternativa a client_id — se resuelve contra clients.workflow_id)",
  "detalle": "texto opcional",
  "costo_clp": 12.5
}
```
- Respuestas: `200 {ok:true}` · `401` token inválido · `400` tipo inválido · `500` error BD.
- `tipo: "error"` dispara alerta WhatsApp a `MI_WHATSAPP` (si Cloud API está configurada).
- **Los 4 tipos comerciales requieren la migración 008 aplicada en Supabase.** Sin ella devuelven 500 con el error del constraint — los 3 tipos históricos no se ven afectados.
- Convención sugerida de `detalle`: para `lead_captured` → "nombre · teléfono · necesidad"; para `quote_generated` → "producto · monto"; para `meeting_booked` → "fecha/hora".

### GET /api/hooks/bot-config?workflow_id=XXX (o ?client_id=uuid)
n8n obtiene la configuración operativa del bot (tono, horarios, reglas y contacto de derivación) para inyectarla en el prompt. Cachear en n8n 5–10 min si el volumen crece.

### POST /api/hooks/brief
Genera el brief diario y lo envía por WhatsApp a `MI_WHATSAPP`. Pensado para un cron de n8n a las 8:00 (workflow `n8n/brief_diario.json`).

## 2. Workflows de ejemplo (carpeta n8n/)
`brief_diario.json` (cron → hook brief) · `registro_mensajes.json` (bot → bot-events tipo mensaje) · `alerta_errores.json` (error handler → bot-events tipo error). Importar en n8n, configurar URL del deploy + token, y asignar el workflow_id en la ficha del cliente.

## 3. APIs externas
- **Google Places API (New)** — `lib/places.ts`, Text Search, 20 resultados por búsqueda. Requiere facturación activa. Costo por búsqueda: verificar tarifas vigentes en la consola de Google.
- **Gemini** — `lib/gemini.ts`. Modelo `GEMINI_MODEL` con fallback automático a `gemini-2.5-flash` ante 429/500/503, y fallback final sin IA en brief/scoring. Grounding con Maps opcional (`GEMINI_MAPS_GROUNDING=1`, verificar condiciones de cuota).
- **WhatsApp Cloud API** — `lib/whatsapp.ts`. SOLO notificaciones al fundador (alertas, brief). Nunca outreach frío (riesgo de baneo). Ventana de 24 h: escribirle primero al número del bot desde MI_WHATSAPP o usar plantilla aprobada.

## 4. Qué falta para producción con clientes reales
1. Ejecutar migración 008 en Supabase.
2. Configurar `HQ_API_TOKEN` fuerte en Vercel y en las credenciales de n8n.
3. Duplicar plantilla de workflow por cliente y guardar su workflow_id en la ficha.
4. Probar end-to-end: evento manual con curl → aparece en feed y en la card del cliente.
```bash
curl -X POST https://TU-DEPLOY.vercel.app/api/hooks/bot-events \
  -H "Content-Type: application/json" -H "x-hq-token: TU_TOKEN" \
  -d '{"tipo":"mensaje","workflow_id":"wf-123","detalle":"prueba"}'
```
5. Documentado como futuro (no implementar aún): reintentos/colas, firma HMAC de payloads, Gmail/Calendar/Slack.

## 5. Riesgos
- Token único compartido para todos los hooks (suficiente a esta escala; rotarlo si se filtra).
- Sin rate-limit en hooks (mitigado por token; Vercel corta abusos extremos).
- Si n8n manda `workflow_id` no registrado, el evento queda con client_id null ("sistema" en el feed) — revisar el feed si un bot "no reporta".
