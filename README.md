# Respondo HQ

Panel interno de operaciones de Respondo: prospección con IA, pipeline de ventas, monitoreo de bots y brief diario.

**Stack:** Next.js 14 + TypeScript + Tailwind + Supabase + n8n + Gemini + WhatsApp Cloud API.

## Módulos

| Ruta | Qué hace |
|---|---|
| `/dashboard` | KPIs: calientes sin contactar, seguimientos, MRR pipeline, MRR actual, errores de bots, conversaciones |
| `/prospeccion` | Buscar negocios por rubro+comuna (Places API) → scoring + mensaje con Gemini → tabla con estados |
| `/pipeline` | Kanban: Contactado → Demo → Propuesta → Cliente / Perdido, con MRR proyectado |
| `/clientes` | Salud de cada bot (eventos desde n8n), mensajes, costos, mensualidad + config del bot (tono, horarios, derivación a humano) |
| `/brief` | Brief diario generado por Gemini (histórico + generar ahora) + reporte mensual en lenguaje de cliente (uso interno) |
| `/roadmap` | Roadmap interno compartido del equipo (reemplaza Notion): kanban por Estado, texto libre en Estado/Área |

## Setup (30-40 min)

### 1. Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com) (free tier).
2. SQL Editor → pega y ejecuta `supabase/schema.sql` completo.
3. Ejecuta después, en orden, cada archivo de `supabase/migrations/` (002 → 006).
4. Settings → API: copia la **URL** y la **service_role key**.

⚠️ El free tier **pausa el proyecto tras ~7 días sin uso**. Si el panel deja de cargar, entra al dashboard de Supabase y reanúdalo. Con clientes en producción, evalúa el plan pago.

### 2. APIs de Google
- **Places API (New):** en Google Cloud Console, habilita "Places API (New)" y crea una API key. ⚠️ Requiere facturación activa — verifica la cuota gratis mensual vigente antes de buscar masivamente.
- **Gemini:** crea una API key en [aistudio.google.com](https://aistudio.google.com).

### 3. Variables de entorno
```bash
cp .env.example .env.local
# llena todos los valores
```

### 4. Correr local
```bash
npm install
npm run dev
# http://localhost:3000 (login: HQ_USER / HQ_PASSWORD)
```

El panel acepta **dos credenciales** (`HQ_USER`/`HQ_PASSWORD` y `HQ_USER_2`/`HQ_PASSWORD_2`), una por socio. Según cuál se use para entrar, el roadmap registra quién creó/actualizó cada tarea.

### 5. Deploy en Vercel
```bash
vercel --prod
```
Agrega TODAS las variables de `.env.local` en Vercel → Settings → Environment Variables (y redeploy).

### 6. n8n (3 piezas)
1. **Brief diario:** importa `n8n/brief_diario.json`, reemplaza `TU-DOMINIO` y el token, actívalo. Te llega cada mañana a las 8:00 por WhatsApp.
2. **Alertas de errores:** importa `n8n/alerta_errores.json` (mismo reemplazo). Luego en CADA workflow de bot de cliente: Settings → Error Workflow → selecciona este workflow.
3. **Registro de mensajes:** importa `n8n/registro_mensajes.json` y copia su nodo HTTP al FINAL del flujo de cada bot de cliente (registra cada conversación + costo estimado).

En el panel (`/clientes`), crea cada cliente con su **Workflow ID** de n8n (visible en la URL del workflow). Así HQ asocia eventos → cliente.

Además, cada bot puede leer su configuración (tono, horarios, derivación a humano) desde `GET /api/hooks/bot-config?workflow_id=XXX` con el header `x-hq-token`. La config se edita en `/clientes` → "config bot".

### 7. WhatsApp (alertas y brief hacia TI)
- `WHATSAPP_PHONE_ID` + `WHATSAPP_TOKEN`: tu app de Meta (la misma de los bots sirve).
- `MI_WHATSAPP`: tu número personal con código país (569XXXXXXXX).
- ⚠️ Ventana de 24 h: para recibir mensajes de sesión, mándale tú un mensaje al número de la Cloud API primero (o crea una plantilla aprobada). Si no configuras WhatsApp, todo funciona igual — el brief queda en `/brief` y los errores en `/clientes`.

## Reglas de uso (importante)

- **El outreach es MANUAL.** El panel genera el mensaje; tú lo copias y lo envías desde tu WhatsApp Business normal (número distinto al de la API). Enviar frío por la Cloud API = riesgo de baneo del número que sostiene los bots de tus clientes.
- La service_role key de Supabase **nunca** va en código cliente ni en un repo público. Las tablas tienen RLS activado y los roles públicos sin GRANT (migración 002): solo el servidor puede leerlas.
- Ley 21.719 (vigente dic-2026): los datos de prospectos son datos personales. Mantén registro del origen y elimina a quien lo pida.

## Arquitectura

```
Places API ──┐
Gemini ──────┤                    ┌── n8n: brief diario (cron 8:00) ──► /api/hooks/brief
             ▼                    │
        Next.js (Vercel) ◄────────┤── n8n: error workflow ───────────► /api/hooks/bot-events
             │                    │
             ▼                    ├── n8n: bots de clientes (nodo registro) ──► /api/hooks/bot-events
         Supabase                 │                    │
             ▲                    └── n8n: bots leen su config ◄──── /api/hooks/bot-config
             └────────── WhatsApp Cloud API ──► alertas y brief a TU número
```
