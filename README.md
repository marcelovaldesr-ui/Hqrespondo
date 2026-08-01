# Respondo HQ

Panel interno de operaciones de Respondo: prospección con IA, pipeline de ventas, monitoreo de bots y brief diario.

**Stack:** Next.js 14 + TypeScript + Tailwind + Supabase + n8n + Gemini + WhatsApp Cloud API.

## Módulos

| Ruta | Qué hace |
|---|---|
| `/dashboard` | KPIs: calientes sin contactar, seguimientos, MRR pipeline, MRR actual, errores de bots, conversaciones |
| `/prospeccion` | Buscar negocios por rubro+comuna (Places API) → scoring + mensaje con Gemini → tabla con estados |
| `/pipeline` | Kanban: Contactado → Demo → Propuesta → Cliente / Perdido, con MRR proyectado |
| `/clientes` | Salud de cada bot (eventos desde respondo-portal, ver nota 1-ago abajo), mensajes, costos, mensualidad + config del bot (tono, horarios, derivación a humano) |
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

### 6. n8n (3 piezas) — ⚠ 2 de 3 en desuso desde el 21-jul-2026

> **Nota agregada 1-ago-2026** (ver `AUDITORIA_RESPONDHQ_AGO2026.md`): desde que
> los bots dejaron de correr en n8n, las piezas **2 y 3** de abajo (pensadas
> para "cada workflow de bot de cliente") no tienen a quién aplicárselas — los
> bots corren como código dentro de `respondo-portal`. `/clientes` ahora recibe
> sus eventos por un puente nuevo desde el Portal (`lib/hqBridge.ts` ahí,
> mismo endpoint `/api/hooks/bot-events` de siempre). La pieza **1** (brief
> diario) es un cron interno de HQ, no depende de bots de cliente — sigue
> vigente tal cual si la tienen activada.

1. **Brief diario:** importa `n8n/brief_diario.json`, reemplaza `TU-DOMINIO` y el token, actívalo. Te llega cada mañana a las 8:00 por WhatsApp.
2. ~~**Alertas de errores:** importa `n8n/alerta_errores.json`...~~ — en desuso, ver nota arriba.
3. ~~**Registro de mensajes:** importa `n8n/registro_mensajes.json`...~~ — en desuso, ver nota arriba.

En el panel (`/clientes`), crea cada cliente con su **ID de referencia** — hoy es el `id` del cliente en `ed_clientes` de respondo-portal (antes era el Workflow ID de n8n; el campo es el mismo, cambió lo que se guarda ahí). Así HQ asocia eventos → cliente.

Además, cada bot PODRÍA leer su configuración (tono, horarios, derivación a humano) desde `GET /api/hooks/bot-config?workflow_id=XXX` con el header `x-hq-token` — el endpoint sigue vivo, pero hoy nadie lo consume (el prompt real se arma en `respondo-portal/lib/promptEmpleado.ts`, que no lee esta tabla). La config se sigue pudiendo editar en `/clientes` → "config bot" a modo de notas internas.

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
