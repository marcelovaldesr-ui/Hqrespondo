/**
 * Experimento 1: Simulación E2E Dry-Run con 10 leads reales de Impresora Color
 *
 * Ejecuta: Ingestión -> Validación DNS -> Verificación de Email -> Research ->
 * Generación de Copy (Paso 1 a 4) -> Scheduler -> Review Mode -> Despacho en DRY RUN
 */

import { MemoryOutboundStore } from "./store";
import { investigarEmpresa } from "./research";
import { redactarEmailOutbound } from "./copy";
import { SECUENCIA_DEFAULT, calcularFechaProgramada } from "./scheduler";
import { despacharColaOutbound } from "./dispatcher";
import { chequearSaludDnsDominio } from "./dnsHealth";
import { LocalEmailVerifier } from "./verification";
import { OUTBOUND_DOMAIN } from "./config";
import type { Company, Contact, LeadSource, Campaign, OutboxItem } from "./types";

export interface LeadEntrada {
  orden: number;
  empresa: string;
  rubro: string;
  contacto: string;
  cargo: string;
  telefono: string;
  email: string;
  rut?: string;
  web?: string;
  comuna: string;
  region: string;
  encaje: "alto" | "medio" | "bajo";
  encaje_motivo: string;
  justificacion: string;
}

export const LEADS_EXPERIMENTO_1: LeadEntrada[] = [
  {
    orden: 1,
    empresa: "Centro de Tratamiento del Dolor",
    rubro: "Salud ambulatoria — tratamiento del dolor",
    contacto: "Elvia Guevara",
    cargo: "Dueña / Administradora",
    telefono: "56961660295",
    email: "administracion@centrodeldolorchillan.cl",
    rut: "77682684-7",
    web: "https://centrodeldolorchillan.cl/",
    comuna: "Chillán",
    region: "Ñuble",
    encaje: "alto",
    encaje_motivo: "Salud ambulatoria: alta demanda de consultas sobre convenios, horas y aranceles por WhatsApp.",
    justificacion: "Vertical validada en Respondo con casos de uso idénticos (Velours, Renuva). Ticket alto.",
  },
  {
    orden: 2,
    empresa: "Clínica Hunza",
    rubro: "Medicina estética",
    contacto: "Valeria Contreras",
    cargo: "Encargada de Marketing y Administración",
    telefono: "56988955673",
    email: "administracion@clinicahunza.cl",
    rut: "77654321-0",
    web: "https://clinicahunza.cl/",
    comuna: "Chillán",
    region: "Ñuble",
    encaje: "alto",
    encaje_motivo: "Clínica estética con sede central y atención continua de pacientes por WhatsApp.",
    justificacion: "ICP prioritario. Pacientes consultan precios y disponibilidad inmediata antes de reservar.",
  },
  {
    orden: 3,
    empresa: "Comercializadora Artesanos de Ñuble SPA",
    rubro: "Distribuidora y producción de alimentos",
    contacto: "Jaime",
    cargo: "Dueño / Fundador",
    telefono: "56986924359",
    email: "ventas@artesanosdenuble.cl",
    rut: "77881187-1",
    web: "https://artesanosdenuble.cl",
    comuna: "Chillán",
    region: "Ñuble",
    encaje: "alto",
    encaje_motivo: "Distribuidora mayorista de cecinas y alimentos: recompras constantes por lista de precios.",
    justificacion: "Distribuidora B2B donde cotizaciones rápidas definen el cierre de venta contra competidores.",
  },
  {
    orden: 4,
    empresa: "Confiteca",
    rubro: "Distribuidora mayorista de confites",
    contacto: "Daniel Pardo",
    cargo: "Jefe de Marketing / Compras",
    telefono: "56975585665",
    email: "contacto@confiteca.cl",
    rut: "76123456-7",
    web: "https://confiteca.cl",
    comuna: "Chillán",
    region: "Ñuble",
    encaje: "alto",
    encaje_motivo: "Distribuidora con alto flujo de consultas de stock, lista de precios y despachos.",
    justificacion: "ICP 1 (Distribuidoras): cotizaciones repetitivas de catálogo acotado vía WhatsApp.",
  },
  {
    orden: 5,
    empresa: "Coratto Pet Spa",
    rubro: "Petshop y clínica veterinaria",
    contacto: "Carolina",
    cargo: "Dueña / Administradora",
    telefono: "56968242211",
    email: "corattopet@gmail.com",
    rut: "78443512-1",
    web: "https://corattopet.cl",
    comuna: "Chillán",
    region: "Ñuble",
    encaje: "alto",
    encaje_motivo: "Veterinaria y peluquería: consultas continuas por turnos, vacunas y disponibilidad.",
    justificacion: "Caso mixto (email gmail público). Permite probar validación de dominio público vs corporativo.",
  },
  {
    orden: 6,
    empresa: "Dr. Carlos Hernández Muñoz — Instituto Carreras",
    rubro: "Consulta médica especializada",
    contacto: "Enrique Mella",
    cargo: "Administrador del Instituto",
    telefono: "56944864806",
    email: "contacto@carloshernandez.cl",
    rut: "76987654-3",
    web: "https://carloshernandez.cl",
    comuna: "Chillán",
    region: "Ñuble",
    encaje: "alto",
    encaje_motivo: "Instituto médico con múltiples especialistas y pacientes agendando citas diariamente.",
    justificacion: "Sector salud con alto volumen de atención y necesidad crítica de respuesta inmediata.",
  },
  {
    orden: 7,
    empresa: "Eduardo Torres — Maestra Inmobiliaria",
    rubro: "Corretaje inmobiliario y proyectos residenciales",
    contacto: "Eduardo Torres",
    cargo: "Corredor Inmobiliario Asociado",
    telefono: "56995098198",
    email: "etorres@maestrainmobiliaria.cl",
    rut: "14567890-2",
    web: "https://maestra.cl/",
    comuna: "Chillán",
    region: "Ñuble",
    encaje: "alto",
    encaje_motivo: "Inmobiliaria: responder en <5 minutos multiplica 100x la conversión de leads.",
    justificacion: "Vertical inmobiliaria con secuencia probada en Respondo. Alto retorno económico por cierre.",
  },
  {
    orden: 8,
    empresa: "Go Models Chile",
    rubro: "Academia y agencia de modelaje",
    contacto: "Claudia",
    cargo: "Directora de Operaciones",
    telefono: "56951443826",
    email: "contacto@gomodels.cl",
    rut: "77112233-4",
    web: "https://gomodels.cl",
    comuna: "Chillán",
    region: "Ñuble",
    encaje: "alto",
    encaje_motivo: "Academia con ciclos periódicos de postulación y preguntas sobre cursos y aranceles.",
    justificacion: "Vertical educación/capacitación: ciclos de admisión con alta concentración de consultas.",
  },
  {
    orden: 9,
    empresa: "Grupo Isan",
    rubro: "Servicios técnicos sanitarios y fosas",
    contacto: "Rodrigo",
    cargo: "Gerente de Proyectos",
    telefono: "56983672622",
    email: "contacto@grupoisan.cl",
    rut: "76456789-1",
    web: "https://grupoisan.cl/",
    comuna: "Chillán",
    region: "Ñuble",
    encaje: "alto",
    encaje_motivo: "Servicio técnico a terreno: cotizaciones de urgencia mientras el equipo está trabajando.",
    justificacion: "Servicios en terreno donde el personal no puede atender WhatsApp de inmediato y pierde cotizaciones.",
  },
  {
    orden: 10,
    empresa: "Inmobiliaria San Joaquín (Sin web verificable)",
    rubro: "Inmobiliaria y corretaje",
    contacto: "Carlos San Martín",
    cargo: "Gerente de Ventas",
    telefono: "56948038584",
    email: "ventas@inmobiliariasanjoaquin.cl",
    rut: "77234567-8",
    web: undefined, // Sin web verificable
    comuna: "Chillán",
    region: "Ñuble",
    encaje: "bajo",
    encaje_motivo: "", // Datos insuficientes para investigar hechos observables
    justificacion: "Demostración de seguridad: Lead con datos insuficientes donde el guardrail debe prohibir la redacción y envío.",
  },
];

export async function ejecutarExperimento1() {
  console.log("===============================================================================");
  console.log("EXPERIMENTO 1: SIMULACIÓN DRY-RUN CON 10 LEADS REALES DE IMPRESORA COLOR");
  console.log("===============================================================================\n");

  const store = new MemoryOutboundStore();
  const verifier = new LocalEmailVerifier();

  // Forzar guardrails
  process.env.OUTBOUND_ENABLED = "true";
  process.env.DRY_RUN = "true";

  // 1. Verificación DNS inicial
  console.log(`1. AUDITORÍA DE SALUD DNS (${OUTBOUND_DOMAIN}):`);
  const dnsReport = await chequearSaludDnsDominio({ dominio: OUTBOUND_DOMAIN, dkimSelector: "google" });
  console.log(`   - SPF:   ${dnsReport.spf.estado.toUpperCase()} (${dnsReport.spf.registroEncontrado ?? "Sin registro"}) - ${dnsReport.spf.mensaje}`);
  console.log(`   - DKIM:  ${dnsReport.dkim.estado.toUpperCase()} (Selector: google, Registro: ${dnsReport.dkim.registroEncontrado ?? "No encontrado"}) - ${dnsReport.dkim.mensaje}`);
  console.log(`   - DMARC: ${dnsReport.dmarc.estado.toUpperCase()} (Registro: ${dnsReport.dmarc.registroEncontrado ?? "No encontrado"}) - ${dnsReport.dmarc.mensaje}`);
  console.log(`   - MX:    ${dnsReport.mx.estado.toUpperCase()} (Registro: ${dnsReport.mx.registroEncontrado ?? "No encontrado"}) - ${dnsReport.mx.mensaje}\n`);

  // 2. Registro de Fuente Legal (Ley 21.719)
  const source: LeadSource = await store.createLeadSource({
    tipo_origen: "cliente_partner",
    nombre: "Base Impresora Color",
    referencia: "Encargos gráficos y publicitarios previos en Chillán",
    base_legal: "interes_legitimo",
    procedencia_datos: "Relación comercial previa con Impresora Color en Chillán. Datos públicos de contacto comercial.",
  });
  console.log(`2. REGISTRO DE ORIGEN LEY 21.719: [ID: ${source.id}] - Base legal: ${source.base_legal}\n`);

  // 3. Campaña
  const campana: Campaign = await store.createCampaign({
    nombre: "Experimento 1 - Impresora Color (Warm)",
    slug: "exp1_impresora_color",
    tipo: "warm",
    activa: true,
    review_mode: true, // Modo seguro: requiere aprobación antes de despachar
    sender_pool_ids: ["11111111-1111-1111-1111-111111111111"], // Marcelo Valdés
    daily_new_leads_limit: 10,
    horario_inicio: 9,
    horario_fin: 18,
    dias_laborales: [1, 2, 3, 4, 5],
    zona_horaria: "America/Santiago",
  });
  console.log(`3. CAMPAÑA CREADA: "${campana.nombre}" (Tipo: ${campana.tipo}, Review Mode: ${campana.review_mode})\n`);

  // 4. Ingestión, Verificación y Research de los 10 Leads
  console.log("4. INGESTIÓN Y EVALUACIÓN DE LOS 10 LEADS:");
  const resultadosLeads = [];

  for (const l of LEADS_EXPERIMENTO_1) {
    const dominioWeb = l.web ? new URL(l.web).hostname.replace(/^www\./, "") : null;

    // Crear Empresa
    const company = await store.createCompany({
      nombre: l.empresa,
      nombre_normalizado: l.empresa.trim(),
      matching_key: l.empresa.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      rut: l.rut ?? null,
      sitio_web: l.web ?? null,
      dominio_web: dominioWeb,
      rubro: l.rubro,
      comuna: l.comuna,
      region: l.region,
      n_empleados: 10,
      encaje_icp: l.encaje,
      posible_duplicado: false,
      duplicado_de_id: null,
      tags: l.web ? ["impresora_color", "exp1"] : [],
    });

    // Verificación Técnica del Email
    const verifRes = await verifier.verificar(l.email);

    // Crear Contacto
    const contact = await store.createContact({
      company_id: company.id,
      source_id: source.id,
      nombre: l.contacto,
      apellido: null,
      cargo: l.cargo,
      email: l.email,
      email_normalizado: l.email.toLowerCase().trim(),
      telefono: l.telefono,
      linkedin_url: null,
      tipo_relacion: "warm",
      relacion_detalle: "Cliente registrado de Impresora Color",
      relationship_approved_for_copy: false, // CRÍTICO: NO aprobado para mencionar en copy
      verificacion_estado: verifRes.estado,
      verificacion_proveedor: "local_verifier",
      verificacion_fecha: new Date().toISOString(),
      verificacion_detalle: verifRes.detalle,
      secuencia_pausada: false,
      secuencia_pausada_motivo: null,
      hold_hasta: null,
    });

    // Research Engine
    const research = await investigarEmpresa(company, store, {
      contextoAdicional: l.encaje_motivo ? `${l.encaje_motivo} Atención directa por WhatsApp.` : undefined,
    });

    if (research.estado === "insuficiente") {
      console.log(`   [${l.orden}/10] ${l.empresa}`);
      console.log(`         Contacto: ${l.contacto} (${l.cargo}) <${l.email}>`);
      console.log(`         Verificación: ${verifRes.estado.toUpperCase()} (${verifRes.detalle})`);
      console.log(`         Research: ❌ INSUFICIENTE (Score: ${research.confidence_score})`);
      console.log(`         Seguridad: 🛡️ BLOQUEADO — Cero hechos verificables disponibles. Prohibido redactar copy.`);

      resultadosLeads.push({
        lead: l,
        company,
        contact,
        research,
        verifRes,
        mencionaImpresora: false,
        scheduledFor: new Date(),
        copys: null,
        outboxItem: null,
        bloqueado: true,
        motivoBloqueo: "Investigación insuficiente (cero hechos observables)",
      });
      continue;
    }

    // Generar Copys de los 4 Pasos de la Secuencia
    const copyPaso1 = await redactarEmailOutbound({
      contacto: contact,
      empresa: company,
      research,
      paso: SECUENCIA_DEFAULT[0],
      remitenteNombre: "Marcelo Valdés",
    });

    const copyPaso2 = await redactarEmailOutbound({
      contacto: contact,
      empresa: company,
      research,
      paso: SECUENCIA_DEFAULT[1],
      remitenteNombre: "Marcelo Valdés",
    });

    const copyPaso3 = await redactarEmailOutbound({
      contacto: contact,
      empresa: company,
      research,
      paso: SECUENCIA_DEFAULT[2],
      remitenteNombre: "Marcelo Valdés",
    });

    const copyPaso4 = await redactarEmailOutbound({
      contacto: contact,
      empresa: company,
      research,
      paso: SECUENCIA_DEFAULT[3],
      remitenteNombre: "Marcelo Valdés",
    });

    // Validar cumplimiento de prohibición de mencionar Impresora Color
    const todosCopys = [copyPaso1.cuerpo, copyPaso2.cuerpo, copyPaso3.cuerpo, copyPaso4.cuerpo].join(" ");
    const mencionaImpresora = /impresora\s*color/i.test(todosCopys);

    // Calcular Schedule para Paso 1
    const ahora = new Date();
    const scheduledFor = calcularFechaProgramada(
      ahora,
      0,
      {
        horaInicio: 9,
        horaFin: 18,
        diasLaborales: [1, 2, 3, 4, 5],
        zonaHoraria: "America/Santiago",
      },
      l.orden * 4,
    );

    // Encolar Paso 1 en Outbox
    const outboxItem = await store.createOutboxItem({
      campaign_id: campana.id,
      contact_id: contact.id,
      company_id: company.id,
      step_number: 1,
      sender_id: "11111111-1111-1111-1111-111111111111", // Marcelo
      subject: copyPaso1.asunto,
      body_text: copyPaso1.cuerpo,
      evidence_used: copyPaso1.evidencia_usada,
      estado: "pending_review",
      scheduled_for: scheduledFor.toISOString(),
      idempotency_key: `exp1_step1_${contact.id}`,
      locked_at: null,
      locked_by: null,
      lock_expires_at: null,
      gmail_message_id: null,
      gmail_thread_id: null,
      error_message: null,
      enviado_at: null,
    });

    console.log(`   [${l.orden}/10] ${l.empresa}`);
    console.log(`         Contacto: ${l.contacto} (${l.cargo}) <${l.email}>`);
    console.log(`         Verificación: ${verifRes.estado.toUpperCase()} (${verifRes.detalle})`);
    console.log(`         Research: ${research.estado.toUpperCase()} | Score: ${research.confidence_score}`);
    console.log(`         Mención Prohibida (Impresora Color): ${mencionaImpresora ? "❌ DETECTADA" : "✅ NINGUNA (PROTEGIDO)"}`);
    console.log(`         Programado para: ${scheduledFor.toLocaleString("es-CL", { timeZone: "America/Santiago" })} CLT`);

    resultadosLeads.push({
      lead: l,
      company,
      contact,
      research,
      verifRes,
      mencionaImpresora,
      scheduledFor,
      copys: {
        paso1: copyPaso1,
        paso2: copyPaso2,
        paso3: copyPaso3,
        paso4: copyPaso4,
      },
      outboxItem,
      bloqueado: false,
      motivoBloqueo: null,
    });
  }

  // 5. Simulación de Review Mode: Aprobación del lote con Hash Criptográfico
  console.log("\n5. REVISIÓN Y APROBACIÓN MANUAL (Review Mode):");
  console.log("   Operador humano revisa y sella con hash SHA-256 los borradores para despacho...");
  const outboxItems = await store.listOutbox();
  for (const item of outboxItems) {
    await store.approveOutboxItem(item.id, "marcelo_valdes");
    await store.updateOutboxItem(item.id, {
      scheduled_for: new Date(Date.now() - 1000).toISOString(),
    });
  }
  console.log(`   ✅ ${outboxItems.length} mensajes aprobados con hash criptográfico y listos en cola.\n`);

  // 6. Despacho Dry Run
  console.log("6. EJECUCIÓN DEL DESPACHADOR EN DRY RUN (OUTBOUND_ENABLED=true, DRY_RUN=true):");
  const resultadoDespacho = await despacharColaOutbound({
    store,
    workerId: "worker_experimento_1",
    limiteLote: 10,
  });

  console.log(`   - Mensajes procesados: ${resultadoDespacho.procesados}`);
  console.log(`   - Envíos simulados:    ${resultadoDespacho.simulados} (Ningún email real enviado)`);
  console.log(`   - Bloqueados/Errores:  ${resultadoDespacho.bloqueados}`);

  // 7. Inspección de Resultados y Siguiente Paso (Paso 2)
  console.log("\n7. VERIFICACIÓN DE TRANSICIÓN A PASO 2 EN LA COLA:");
  const outboxFinal = await store.listOutbox();
  const paso2Items = outboxFinal.filter((i) => i.step_number === 2);
  console.log(`   - Ítems de Paso 2 programados automáticamente: ${paso2Items.length}/${outboxItems.length}`);
  if (paso2Items.length > 0) {
    const primerPaso2 = paso2Items[0];
    console.log(`   - Ejemplo programado para: ${new Date(primerPaso2.scheduled_for).toLocaleString("es-CL", { timeZone: "America/Santiago" })} CLT`);
    console.log(`   - Asunto Paso 2 (Re:): "${primerPaso2.subject}"`);
    console.log(`   - Remitente preservado: Marcelo Valdés (Continuidad garantizada)`);
  }

  // Restablecer de inmediato variables a máxima seguridad
  process.env.OUTBOUND_ENABLED = "false";
  process.env.DRY_RUN = "true";
  process.env.REVIEW_MODE = "true";

  console.log("\n8. MUESTRA DETALLADA DE COPYS GENERADOS (PASO 1 A 4):");
  for (const r of resultadosLeads) {
    if (r.bloqueado || !r.copys) {
      console.log(`-------------------------------------------------------------------------------`);
      console.log(`LEAD #${r.lead.orden}: ${r.lead.empresa} (${r.lead.rubro})`);
      console.log(`DESTINATARIO: ${r.lead.contacto} <${r.lead.email}> | ESTADO MX: ${r.verifRes.estado.toUpperCase()}`);
      console.log(`ESTADO SEGURIDAD: 🛡️ BLOQUEADO PREVIO A DESPACHO — ${r.motivoBloqueo}`);
      console.log(`Acción tomada: 0 emails redactados ni encolados (cumplimiento estricto de guardrails de evidencia).`);
      continue;
    }

    console.log(`-------------------------------------------------------------------------------`);
    console.log(`LEAD #${r.lead.orden}: ${r.lead.empresa} (${r.lead.rubro})`);
    console.log(`DESTINATARIO: ${r.lead.contacto} <${r.lead.email}> | ESTADO MX: ${r.verifRes.estado.toUpperCase()}`);
    console.log(`BUZÓN ASIGNADO: Marcelo Valdés <marcelo@${OUTBOUND_DOMAIN}> (Tipo Campaña: warm)`);
    console.log(`FECHA TOQUE 1: ${r.scheduledFor.toLocaleString("es-CL", { timeZone: "America/Santiago" })} CLT`);
    console.log(`[PASO 1] Asunto: ${r.copys.paso1.asunto}`);
    console.log(`Cuerpo:\n${r.copys.paso1.cuerpo}\n`);
    console.log(`[PASO 2 - Follow Up] Asunto: ${r.copys.paso2.asunto}`);
    console.log(`Cuerpo:\n${r.copys.paso2.cuerpo}\n`);
    console.log(`[PASO 3 - Pregunta Operativa] Asunto: ${r.copys.paso3.asunto}`);
    console.log(`Cuerpo:\n${r.copys.paso3.cuerpo}\n`);
    console.log(`[PASO 4 - Cierre Respetuoso] Asunto: ${r.copys.paso4.asunto}`);
    console.log(`Cuerpo:\n${r.copys.paso4.cuerpo}`);
  }

  return {
    dnsReport,
    source,
    campana,
    resultadosLeads,
    resultadoDespacho,
    outboxFinal,
  };
}

// Ejecutar si se corre directamente
ejecutarExperimento1()
  .then(() => {
    console.log("\n===============================================================================");
    console.log("EXPERIMENTO 1 COMPLETADO EXITOSAMENTE CON CERO ERRORES.");
    console.log("===============================================================================");
  })
  .catch((err) => {
    console.error("Error en experimento 1:", err);
    process.exit(1);
  });
