/**
 * ORQUESTADOR — el cerebro del agente. Sin Redis ni BullMQ: la cola es la
 * tabla prospects (prospeccion_estado + proximo_toque_at). Un cron llama a
 * correrDiaria() varias veces al día; cada corrida procesa un LOTE chico
 * (idempotente y reanudable), así ninguna invocación se pasa del límite de
 * tiempo de Vercel y el rate-limiting sale natural.
 *
 * Máquina de estados por prospecto:
 *   pendiente ──enriquecer──▶ en_secuencia ──toques──▶ (respuesta) ─▶ demo/…
 *        │                         │
 *        └─(3 intentos fallidos)   └─(secuencia agotada)──▶ descartado_agente
 *          ─▶ no_encontrado
 *
 * Email = se envía solo. LinkedIn = se REDACTA y se avisa al humano por
 * Telegram para que lo envíe a mano (cero riesgo de baneo de la cuenta).
 */
import { db } from "../db";
import {
  SECUENCIA,
  config,
  remitente,
  type ProspectoAgente,
  type Toque,
} from "./tipos";
import { enriquecerContacto } from "./enriquecedor";
import { redactarEmail, redactarLinkedin } from "./mensajes";
import { enviarEmail } from "./email";
import { log, contarRecientes } from "./logger";
import { enviarTelegram } from "./telegram";

const SELECT =
  "id,nombre,rubro,comuna,telefono,web,notas,senales_web,contacto_nombre,contacto_email,contacto_linkedin,contacto_celular,contacto_confianza,prospeccion_estado,enriquecer_intentos,toque_num,proximo_toque_at,gmail_thread_id";

const ahora = () => new Date().toISOString();
const enDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

/** Hora actual en Chile (0–23) para respetar la ventana de envío. */
function horaChile(): number {
  const s = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  return parseInt(s, 10) || 0;
}

// ─────────────────────────────── Enriquecimiento ───────────────────────────

/** Enriquece un lote de la lista de oro aún sin contacto. */
export async function enriquecerLote(): Promise<{ ok: number; no_encontrado: number }> {
  const cfg = config();
  const res = { ok: 0, no_encontrado: 0 };

  // Lista de oro pendiente: score alto, con teléfono, sin contactar aún, y sin
  // "reintentar después" vigente (proximo_toque_at se usa como cooldown aquí).
  const { data } = await db()
    .from("prospects")
    .select(SELECT)
    .eq("prospeccion_estado", "pendiente")
    .gte("score", cfg.scoreMinimo)
    .not("telefono", "is", null)
    .in("estado", ["nuevo", "contactado"])
    .or(`proximo_toque_at.is.null,proximo_toque_at.lte.${ahora()}`)
    .order("score", { ascending: false })
    .limit(cfg.enriquecerPorCorrida);

  for (const p of (data ?? []) as ProspectoAgente[]) {
    const intentos = p.enriquecer_intentos + 1;
    const hallado = await enriquecerContacto({
      nombre: p.nombre,
      rubro: p.rubro,
      comuna: p.comuna,
      web: p.web,
    });
    await log({
      prospectId: p.id,
      tipo: "enriquecimiento",
      detalle: { intento: intentos, ...hallado },
    });

    if (hallado.email && hallado.confianza !== "baja") {
      // Éxito → entra a la secuencia; primer toque disponible ya.
      // (confianza "baja" = email adivinado por patrón: NO se manda solo —
      //  los rebotes queman la reputación de la cuenta; va al humano.)
      await db()
        .from("prospects")
        .update({
          contacto_nombre: hallado.nombre,
          contacto_email: hallado.email,
          contacto_linkedin: hallado.linkedin,
          contacto_confianza: hallado.confianza,
          enriquecido_at: ahora(),
          enriquecer_intentos: intentos,
          prospeccion_estado: "en_secuencia",
          toque_num: 0,
          proximo_toque_at: ahora(),
          updated_at: ahora(),
        })
        .eq("id", p.id);
      res.ok++;
    } else if (intentos >= cfg.maxIntentosEnriquecer) {
      // Se acabaron los intentos → al humano.
      await db()
        .from("prospects")
        .update({
          contacto_nombre: hallado.nombre,
          contacto_linkedin: hallado.linkedin,
          enriquecer_intentos: intentos,
          prospeccion_estado: "no_encontrado",
          proximo_toque_at: null,
          updated_at: ahora(),
        })
        .eq("id", p.id);
      res.no_encontrado++;
    } else {
      // Reintentar en ~22 h (cooldown para no quemar cuota de Serper/Hunter).
      await db()
        .from("prospects")
        .update({
          contacto_nombre: hallado.nombre ?? p.contacto_nombre,
          contacto_linkedin: hallado.linkedin ?? p.contacto_linkedin,
          enriquecer_intentos: intentos,
          proximo_toque_at: enDias(0.9),
          updated_at: ahora(),
        })
        .eq("id", p.id);
    }
  }
  return res;
}

// ─────────────────────────────── Toques ────────────────────────────────────

/** Programa el próximo toque según los días de la secuencia. */
function proximoToque(indiceEnviado: number): string | null {
  const actual = SECUENCIA[indiceEnviado];
  const siguiente = SECUENCIA[indiceEnviado + 1];
  if (!siguiente) return null; // secuencia agotada
  const delta = Math.max(0, siguiente.dia - actual.dia);
  return enDias(delta);
}

async function enviarToqueEmail(p: ProspectoAgente, t: Toque): Promise<boolean> {
  const email = await redactarEmail(t, {
    nombre: p.nombre,
    rubro: p.rubro,
    comuna: p.comuna,
    notas: p.notas,
    senales: p.senales_web,
  });
  const de = remitente();
  const r = await enviarEmail({
    para: p.contacto_email!,
    deNombre: de.nombre,
    deEmail: de.email,
    asunto: email.asunto,
    cuerpo: email.cuerpo,
    threadId: p.gmail_thread_id,
  });
  await log({
    prospectId: p.id,
    tipo: r.ok ? "email_enviado" : "error",
    canal: "email",
    toqueNum: t.num,
    detalle: { asunto: email.asunto, para: p.contacto_email, ...(r.ok ? {} : { error: r.error }) },
  });
  if (!r.ok) return false;

  await db()
    .from("prospects")
    .update({
      toque_num: t.num,
      gmail_thread_id: p.gmail_thread_id ?? r.threadId ?? null,
      proximo_toque_at: proximoToque(t.num - 1),
      prospeccion_estado: proximoToque(t.num - 1) ? "en_secuencia" : "descartado_agente",
      estado: "contactado",
      updated_at: ahora(),
    })
    .eq("id", p.id);
  return true;
}

async function redactarToqueLinkedin(
  p: ProspectoAgente,
  t: Toque,
  digest: string[],
): Promise<void> {
  const texto = await redactarLinkedin(t, {
    nombre: p.nombre,
    rubro: p.rubro,
    comuna: p.comuna,
    notas: p.notas,
    senales: p.senales_web,
  });
  await log({
    prospectId: p.id,
    tipo: "linkedin_redactado",
    canal: "linkedin",
    toqueNum: t.num,
    detalle: { texto, perfil: p.contacto_linkedin },
  });
  digest.push(
    `• <b>${p.nombre}</b>${p.contacto_linkedin ? `\n  ${p.contacto_linkedin}` : ""}\n  <i>${texto}</i>`,
  );
  await db()
    .from("prospects")
    .update({
      toque_num: t.num,
      proximo_toque_at: proximoToque(t.num - 1),
      prospeccion_estado: proximoToque(t.num - 1) ? "en_secuencia" : "descartado_agente",
      updated_at: ahora(),
    })
    .eq("id", p.id);
}

/** Procesa los toques vencidos (email auto + LinkedIn a redactar). */
export async function enviarToquesVencidos(): Promise<{
  emails: number;
  linkedin: number;
  digestLinkedin: string[];
}> {
  const cfg = config();
  const out = { emails: 0, linkedin: 0, digestLinkedin: [] as string[] };

  const hora = horaChile();
  const dentroDeVentana = hora >= cfg.horaInicio && hora < cfg.horaFin;

  const { data } = await db()
    .from("prospects")
    .select(SELECT)
    .eq("prospeccion_estado", "en_secuencia")
    .not("proximo_toque_at", "is", null)
    .lte("proximo_toque_at", ahora())
    .order("proximo_toque_at", { ascending: true })
    .limit(cfg.emailsPorCorrida * 2); // holgura: los LinkedIn no cuentan al límite de email

  // Rate limits (contra el log durable).
  let emailsHora = await contarRecientes("email_enviado", 1);
  let linkedinDia = await contarRecientes("linkedin_redactado", 24);

  for (const p of (data ?? []) as ProspectoAgente[]) {
    const siguiente = SECUENCIA[p.toque_num]; // toque_num = último enviado → índice del próximo
    if (!siguiente) {
      await db()
        .from("prospects")
        .update({ prospeccion_estado: "descartado_agente", proximo_toque_at: null })
        .eq("id", p.id);
      continue;
    }

    if (siguiente.canal === "email") {
      if (!p.contacto_email) continue;
      if (!dentroDeVentana) continue; // fuera de horario: no se manda email
      if (emailsHora >= cfg.emailsPorHora) continue; // tope horario
      if (out.emails >= cfg.emailsPorCorrida) continue; // tope por corrida
      try {
        if (await enviarToqueEmail(p, siguiente)) {
          out.emails++;
          emailsHora++;
        }
      } catch (e) {
        await log({
          prospectId: p.id,
          tipo: "error",
          canal: "email",
          toqueNum: siguiente.num,
          detalle: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    } else {
      // LinkedIn: redactar para envío manual (respeta el tope diario).
      if (linkedinDia >= cfg.linkedinPorDia) continue;
      try {
        await redactarToqueLinkedin(p, siguiente, out.digestLinkedin);
        out.linkedin++;
        linkedinDia++;
      } catch (e) {
        await log({
          prospectId: p.id,
          tipo: "error",
          canal: "linkedin",
          toqueNum: siguiente.num,
          detalle: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    }
  }
  return out;
}

// ─────────────────────────────── Corrida diaria ────────────────────────────

export interface ResultadoDiaria {
  enriquecidos: number;
  no_encontrados: number;
  emails: number;
  linkedin: number;
}

/** Una corrida completa: enriquecer + enviar toques + resumen a Telegram. */
export async function correrDiaria(notificar = true): Promise<ResultadoDiaria> {
  await log({ tipo: "sistema", detalle: { evento: "inicio_corrida", hora_chile: horaChile() } });

  const enr = await enriquecerLote();
  const toques = await enviarToquesVencidos();

  const r: ResultadoDiaria = {
    enriquecidos: enr.ok,
    no_encontrados: enr.no_encontrado,
    emails: toques.emails,
    linkedin: toques.linkedin,
  };

  if (notificar && (r.emails || r.linkedin || r.enriquecidos || r.no_encontrados)) {
    let msg =
      `📊 <b>Agente de prospección</b>\n` +
      `✉️ ${r.emails} emails enviados\n` +
      `🔗 ${r.linkedin} LinkedIn para enviar a mano\n` +
      `🔎 ${r.enriquecidos} contactos hallados · ${r.no_encontrados} sin datos`;
    if (toques.digestLinkedin.length) {
      msg += `\n\n<b>LinkedIn a enviar hoy:</b>\n` + toques.digestLinkedin.join("\n\n");
    }
    await enviarTelegram(msg);
  }

  await log({ tipo: "sistema", detalle: { evento: "fin_corrida", ...r } });
  return r;
}

// ─────────────────────────────── Prueba (dry-run) ──────────────────────────

export interface PreviewProspecto {
  nombre: string;
  contacto: { nombre: string | null; email: string | null; linkedin: string | null; confianza: string | null };
  email_muestra: { asunto: string; cuerpo: string } | null;
  linkedin_muestra: string | null;
}

/**
 * Dry-run: toma `n` prospectos de la lista de oro, los enriquece de verdad y
 * REDACTA el primer email + la conexión de LinkedIn, pero NO envía nada.
 * Para validar calidad de datos y de mensajes antes de escalar.
 */
export async function probar(n = 5): Promise<PreviewProspecto[]> {
  const cfg = config();
  const { data } = await db()
    .from("prospects")
    .select(SELECT)
    .gte("score", cfg.scoreMinimo)
    .not("telefono", "is", null)
    .in("estado", ["nuevo", "contactado"])
    .order("score", { ascending: false })
    .limit(n);

  const previews: PreviewProspecto[] = [];
  for (const p of (data ?? []) as ProspectoAgente[]) {
    const c = await enriquecerContacto({
      nombre: p.nombre,
      rubro: p.rubro,
      comuna: p.comuna,
      web: p.web,
    });
    const min = {
      nombre: p.nombre,
      rubro: p.rubro,
      comuna: p.comuna,
      notas: p.notas,
      senales: p.senales_web,
    };
    let email_muestra: PreviewProspecto["email_muestra"] = null;
    let linkedin_muestra: string | null = null;
    try {
      email_muestra = await redactarEmail(SECUENCIA[0], min);
    } catch {
      /* muestra opcional */
    }
    try {
      linkedin_muestra = await redactarLinkedin(SECUENCIA[1], min);
    } catch {
      /* muestra opcional */
    }
    previews.push({
      nombre: p.nombre,
      contacto: { nombre: c.nombre, email: c.email, linkedin: c.linkedin, confianza: c.confianza },
      email_muestra,
      linkedin_muestra,
    });
  }
  return previews;
}
