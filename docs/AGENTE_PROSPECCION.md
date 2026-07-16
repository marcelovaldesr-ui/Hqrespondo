# Agente de prospección multicanal — Respondo

Convierte las **105 leads de oro** (score ≥70, con teléfono, sin contactar) en
**15–25 demos agendadas** sin trabajo manual pesado: el agente enriquece el
contacto, ejecuta la secuencia de emails, redacta los mensajes de LinkedIn para
enviar a mano, clasifica las respuestas y te avisa por Telegram solo los leads
calientes.

> **Regla de oro del diseño:** LinkedIn NO se automatiza (el agente redacta, tú
> envías). Automatizar LinkedIn con scrapers logueados es la vía rápida al
> baneo permanente de la cuenta. Para 105 leads, enviar 20 conexiones/día a
> mano son ~15 min. No vale el riesgo.

---

## Arquitectura (la versión lean)

```
Supabase (prospects = cola)                 Cron (Vercel Pro o cron-job.org)
  prospeccion_estado, proximo_toque_at   ◀──── /api/prospeccion/diaria   (cada 2 h)
  prospeccion_eventos (log durable)      ◀──── /api/prospeccion/revisar  (cada 2 h)

correrDiaria():
  1. enriquecerLote()  → Serper + web + Hunter + patrón  → contacto_email/linkedin
  2. enviarToquesVencidos()
        email    → Gemini redacta → Gmail API envía (auto)
        linkedin → Gemini redacta → Telegram (tú lo envías a mano)
revisarRespuestas():
  Gmail API lee → Gemini clasifica → positivo = alerta Telegram + estado demo_agendada
```

**Por qué así y no BullMQ + Redis + Docker:** son 105 leads, ~15/día en serie.
No hay problema de concurrencia que justifique una cola con broker. La tabla de
Supabase + un cron que procesa lotes chicos es idempotente, reanudable, sin
infraestructura nueva que mantener entre 2 personas. Cada corrida procesa un
lote acotado para no pasarse del límite de tiempo serverless — eso además
reparte los envíos y actúa como rate-limiter natural.

### Secuencia (editable en `lib/prospeccion/tipos.ts` → `SECUENCIA`)

| Día | Canal | Ángulo |
|----|-------|--------|
| 1 | Email | Apertura: dolor del rubro + demo |
| 1 | LinkedIn | Solicitud de conexión (<280 car., **la envías tú**) |
| 3 | Email | Caso de éxito de rubro similar |
| 5 | Email | Pregunta abierta (una sola) |
| 7 | LinkedIn | Mensaje tras aceptar (**la envías tú**) |
| 10 | Email | Cierre honesto (menciona 1er mes gratis) |

Quien responde sale de la secuencia automática al instante (no recibe más
toques fríos).

---

## Decisiones y ROI

| Decisión | Elegido | Por qué |
|---|---|---|
| Orquestación | Supabase + cron | Cero infra nueva; robusto para 2 personas |
| Enriquecimiento | Serper.dev + web + Hunter.io (free) | Cubre 105 leads sin pagar |
| LinkedIn | Semi-auto (redacta IA, envía humano) | Evita baneo; 15 min/día a mano |
| Email | Gmail API, cuenta aparte | 500/día gratis; protege dominio principal |
| Notificación | Telegram | Setup 5 min, alerta instantánea al celular |
| Apify / PhantomBuster | **No** | No aportan a este volumen y añaden costo/riesgo |

**¿Pagar algo?** Con free tier basta para esta ronda de 105:
- Serper.dev: 2.500 búsquedas/mes gratis (usamos ~2 por lead → ~210).
- Hunter.io: 25 búsquedas/mes gratis (solo cuando la web no da email).
- Gmail: 500 envíos/día gratis (mandamos ~400 en 7 días).

Único gasto que *podría* valer la pena: **Vercel Pro (US$20/mes)** si quieres
que los cron corran cada 2 h automáticamente. Alternativa **gratis**:
cron-job.org llamando las URLs con `?key=`. Recomendación: parte gratis con
cron-job.org; si el agente prueba que trae demos, Pro es trivial de justificar.

---

## Variables de entorno (añadir a `.env` / Vercel → Settings → Environment)

```bash
# ── Ya existentes en el proyecto (verificar que estén) ──
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_DEMO_LINK=https://www.respon-do.com

# ── Enriquecimiento ──
SERPER_API_KEY=            # https://serper.dev  (2.500/mes gratis)
HUNTER_API_KEY=            # https://hunter.io   (25/mes gratis)

# ── Email (cuenta Gmail SECUNDARIA, no la principal) ──
GMAIL_CLIENT_ID=           # OAuth client (Google Cloud Console)
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=       # generado una vez con OAuth Playground
GMAIL_FROM=hola@respon-do.com   # el email de esa cuenta
PROS_FROM_NOMBRE=Marcelo · Respondo

# ── Telegram ──
TELEGRAM_BOT_TOKEN=        # de @BotFather
TELEGRAM_CHAT_ID=          # tu chat id (de @userinfobot)

# ── Seguridad de los endpoints cron ──
PROS_CRON_SECRET=          # string aleatorio largo; úsalo en ?key=
# (si usas Vercel Cron, además define CRON_SECRET con otro valor; el código acepta ambos)

# ── Ajustes opcionales (defaults sensatos si se omiten) ──
PROS_SCORE_MIN=70
PROS_EMAILS_LOTE=6         # emails por corrida del cron
PROS_ENRIQUECER_LOTE=6     # enriquecimientos por corrida
PROS_EMAILS_HORA=30        # tope duro/hora
PROS_LINKEDIN_DIA=20       # tope diario de LinkedIn a redactar
PROS_MAX_INTENTOS=3        # reintentos de enriquecimiento antes de 'no_encontrado'
PROS_HORA_INICIO=9         # ventana de envío (hora Chile)
PROS_HORA_FIN=19
```

---

## Acciones humanas (una sola vez, ~45 min en total)

1. **Aplicar la migración.** Supabase → SQL Editor → pega y corre
   `supabase/migrations/017_agente_prospeccion.sql`.
2. **Crear cuenta Gmail secundaria** para outreach (ej. `hola@respon-do.com` o
   una `@gmail.com` dedicada). No uses tu correo personal.
3. **Serper.dev** → crear cuenta gratis en https://serper.dev → copiar API key → `SERPER_API_KEY`.
4. **Hunter.io** → cuenta gratis en https://hunter.io → API key (Settings → API) → `HUNTER_API_KEY`.
5. **OAuth de Gmail** (para enviar/leer): en https://console.cloud.google.com
   crea un proyecto → habilita **Gmail API** → crea credenciales **OAuth client
   (Web)** con redirect `https://developers.google.com/oauthplayground`. Luego
   en https://developers.google.com/oauthplayground usa tu client ID/secret,
   autoriza el scope `https://mail.google.com/`, e intercambia por un
   **refresh token**. Copia `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`,
   `GMAIL_REFRESH_TOKEN`, `GMAIL_FROM`.
6. **Telegram** → habla con https://t.me/BotFather (`/newbot`) para el
   `TELEGRAM_BOT_TOKEN`; escríbele algo a tu bot y saca tu `TELEGRAM_CHAT_ID`
   con https://t.me/userinfobot.
7. **Cargar todas las variables** en Vercel (Production) y en tu `.env` local.
8. **Generar `PROS_CRON_SECRET`** (ej. `openssl rand -hex 24`) y ponerlo.
9. **Cron:** si tienes Vercel Pro, los `crons` de `vercel.json` ya quedan
   activos. Si estás en Hobby, crea en https://cron-job.org dos jobs GET cada
   2 h a `…/api/prospeccion/diaria?key=SECRETO` y `…/api/prospeccion/revisar?key=SECRETO`.
10. **Probar con 5** (ver abajo) antes de encender el envío.

---

## Cómo probar con 5 (sin enviar nada)

```bash
curl "https://TU-DOMINIO/api/prospeccion/test?key=PROS_CRON_SECRET&n=5"
```

Devuelve, para 5 prospectos de la lista de oro: el contacto hallado (nombre,
email, LinkedIn, confianza) y una muestra del email + la conexión de LinkedIn
que se enviarían. Revisa que los emails no suenen a plantilla y que los datos
sean plausibles. **No toca la base ni manda correos.**

---

## Plan de ejecución — primeras 24 horas

| Hora | Acción | Cómo saber que funcionó |
|------|--------|--------------------------|
| 0:00 | Aplicar migración 017 | Las columnas existen en `prospects`; tabla `prospeccion_eventos` creada |
| 0:15 | Crear cuentas (pasos 2–6) y cargar `.env` en Vercel | Deploy sin errores de build |
| 0:45 | `GET /test?n=5` | Llegan 5 previews con email/LinkedIn; contacto hallado en ≥3 de 5 |
| 1:00 | Ajustar tono si hace falta (editar prompts en `mensajes.ts`) | Segundo `/test` con mejores mensajes |
| 1:30 | Enviar UN email real de prueba a tu propio correo (baja `PROS_EMAILS_LOTE=1` y corre `/diaria`) | Te llega el email; responde y corre `/revisar` → alerta Telegram |
| 2:00 | Subir `PROS_EMAILS_LOTE=6`, activar crons | En `prospeccion_eventos` aparecen `enriquecimiento` y `email_enviado` |
| 2:00–24:00 | Dejar correr | Resumen por Telegram en cada corrida; LinkedIn a enviar listado ahí |
| +24 h | Revisar `prospeccion_eventos` | ~15–20 leads enriquecidos, primeros emails fuera, 0 errores repetidos |

Durante los 7 días: cada mañana envía a mano las conexiones de LinkedIn que el
agente te listó por Telegram (≤20/día) y cierra las demos de las alertas 🔥.

---

## Riesgos y mitigaciones

- **Entregabilidad del email en frío.** Cuenta/dominio aparte + opt-out real
  (ya incluido en cada email) + arrancar con `PROS_EMAILS_LOTE` bajo para
  calentar. Si ves muchos rebotes, baja el volumen.
- **Datos de contacto imperfectos.** El email por patrón (`confianza: baja`) es
  el último recurso; si `/test` muestra muchos de esos, ese lead conviene
  trabajarlo por WhatsApp/teléfono en vez de email.
- **Límite de tiempo serverless.** En Hobby el máximo es ~10 s: mantén los
  lotes chicos (default 6) y deja que el cron avance de a poco. En Pro sube
  `maxDuration` si quieres lotes mayores.
- **Ley de datos (Chile).** El outreach es B2B a contactos comerciales y cada
  email lleva opt-out. No harvestees celulares personales para envío masivo.
```
