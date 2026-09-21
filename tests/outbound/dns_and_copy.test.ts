import assert from "node:assert/strict";
import test from "node:test";
import { evaluarSpf, evaluarDkim, evaluarDmarc } from "../../lib/outbound/dnsHealth";
import { redactarEmailOutbound, contarPalabras } from "../../lib/outbound/copy";
import { type Contact, type Company, type CompanyResearch } from "../../lib/outbound/types";

test("DNS SPF: Validación semántica y defensiva (no comparación exacta)", () => {
  // Caso 1: Válido con Google Workspace
  const txtGoogle = [["v=spf1 include:_spf.google.com ~all"]];
  const diag1 = evaluarSpf(txtGoogle);
  assert.equal(diag1.estado, "pass");

  // Caso 2: Válido con otros servicios legítimos (ej. Sendgrid o Microsoft) sin Google -> Warning
  const txtOtro = [["v=spf1 include:spf.protection.outlook.com -all"]];
  const diag2 = evaluarSpf(txtOtro);
  assert.equal(diag2.estado, "warning", "Debe advertir que falta Google Workspace pero no crashear");

  // Caso 3: Múltiples registros SPF (violación RFC 7208) -> Fail
  const txtMultiples = [
    ["v=spf1 include:_spf.google.com ~all"],
    ["v=spf1 include:servers.mcsv.net ?all"],
  ];
  const diag3 = evaluarSpf(txtMultiples);
  assert.equal(diag3.estado, "fail");
  assert.match(diag3.mensaje, /múltiples registros SPF/i);

  // Caso 4: Sin SPF -> Fail
  const diag4 = evaluarSpf([]);
  assert.equal(diag4.estado, "fail");
});

test("DNS DKIM: Selector dinámico y configurable", () => {
  // Selector google
  const txtDkimValido = [["v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3..."]];
  const diagGoogle = evaluarDkim(txtDkimValido, "google");
  assert.equal(diagGoogle.estado, "pass");

  // Selector personalizado (ej. s1 o k1)
  const diagS1 = evaluarDkim(txtDkimValido, "s1");
  assert.equal(diagS1.estado, "pass");

  // Registro inexistente
  const diagVacio = evaluarDkim([], "google");
  assert.equal(diagVacio.estado, "fail");
});

test("DNS DMARC: Detección de política p=none (warning) vs p=quarantine/reject (pass)", () => {
  const txtNone = [["v=DMARC1; p=none; rua=mailto:dmarc@respon-do.com"]];
  const diagNone = evaluarDmarc(txtNone);
  assert.equal(diagNone.estado, "warning");

  const txtQuarantine = [["v=DMARC1; p=quarantine; rua=mailto:dmarc@respon-do.com"]];
  const diagQuarantine = evaluarDmarc(txtQuarantine);
  assert.equal(diagQuarantine.estado, "pass");
});

test("COPY ENGINE: relationship_approved_for_copy=false PROHÍBE usar la relación en el copy", async () => {
  const company: Company = {
    id: "comp_1",
    nombre: "Coratto Pet Spa",
    nombre_normalizado: "Coratto Pet Spa",
    matching_key: "coratto_pet_spa",
    rut: "78443512-1",
    sitio_web: "https://corattopet.cl",
    dominio_web: "corattopet.cl",
    rubro: "Veterinaria y Pet Shop",
    comuna: "Chillán",
    region: "Ñuble",
    n_empleados: 5,
    encaje_icp: "alto",
    posible_duplicado: false,
    duplicado_de_id: null,
    tags: ["impresora_color"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const contactWarmSinPermiso: Contact = {
    id: "cnt_1",
    company_id: company.id,
    source_id: "src_1",
    nombre: "Carolina",
    apellido: null,
    cargo: "Dueña",
    email: "corattopet@gmail.com",
    email_normalizado: "corattopet@gmail.com",
    telefono: "56968242211",
    linkedin_url: null,
    tipo_relacion: "warm",
    relacion_detalle: "Cliente registrado en Impresora Color por compra de stickers y flyers",
    relationship_approved_for_copy: false, // NO AUTORIZADO PARA COPY
    verificacion_estado: "valid",
    verificacion_proveedor: "local",
    verificacion_fecha: new Date().toISOString(),
    verificacion_detalle: "OK",
    secuencia_pausada: false,
    secuencia_pausada_motivo: null,
    hold_hasta: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const research: CompanyResearch = {
    id: "res_1",
    company_id: company.id,
    resumen_actividad: "Pet spa y peluquería canina con atención de consultas por WhatsApp",
    canales_visibles: ["WhatsApp", "Instagram"],
    captacion_leads: "WhatsApp directo",
    senales_dolor: ["Consultas de agenda de baño y corte fuera de horario"],
    propuesta_valor_respondo: "Asistente para agendar horas de peluquería en WhatsApp",
    evidencias: [
      {
        insight: "Ofrecen servicios de peluquería con agenda previa",
        fuente_url: "https://corattopet.cl",
        extracto: "Reserva la hora de tu mascota al WhatsApp",
        confianza: "alta",
      },
    ],
    estado: "completo",
    confidence_score: 90,
    investigado_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const email = await redactarEmailOutbound({
    contacto: contactWarmSinPermiso,
    empresa: company,
    research,
    paso: { step_number: 1, delay_days: 0, channel: "email", angulo: "apertura" },
    remitenteNombre: "Marcelo Valdés",
  });

  assert.ok(email.asunto);
  assert.ok(email.cuerpo);

  // REGLA MANDATORIA: NO puede nombrar Impresora Color
  assert.doesNotMatch(
    email.cuerpo.toLowerCase(),
    /impresora color/i,
    "El copy NO debe nombrar Impresora Color si relationship_approved_for_copy es false",
  );

  // Debe incluir el pie de opt-out
  assert.match(email.cuerpo, /Si no es de tu interés, responde "no"/);

  // Recuento de palabras razonable (sin el opt-out suele estar entre 45 y 75)
  assert.ok(email.recuento_palabras >= 35 && email.recuento_palabras <= 95);
});

test("COPY ENGINE: Rechaza generar copy si research es insuficiente", async () => {
  const company: Company = {
    id: "comp_2",
    nombre: "Empresa Fantasma",
    nombre_normalizado: "Empresa Fantasma",
    matching_key: "empresa_fantasma",
    rut: null,
    sitio_web: null,
    dominio_web: null,
    rubro: null,
    comuna: null,
    region: null,
    n_empleados: null,
    encaje_icp: "sin_evaluar",
    posible_duplicado: false,
    duplicado_de_id: null,
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const contact: Contact = {
    id: "cnt_2",
    company_id: company.id,
    source_id: "src_1",
    nombre: "Alguien",
    apellido: null,
    cargo: null,
    email: "test@fantasma.cl",
    email_normalizado: "test@fantasma.cl",
    telefono: null,
    linkedin_url: null,
    tipo_relacion: "cold",
    relacion_detalle: null,
    relationship_approved_for_copy: false,
    verificacion_estado: "valid",
    verificacion_proveedor: "local",
    verificacion_fecha: null,
    verificacion_detalle: null,
    secuencia_pausada: false,
    secuencia_pausada_motivo: null,
    hold_hasta: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const researchInsuficiente: CompanyResearch = {
    id: "res_2",
    company_id: company.id,
    resumen_actividad: "",
    canales_visibles: [],
    captacion_leads: "",
    senales_dolor: [],
    propuesta_valor_respondo: "",
    evidencias: [],
    estado: "insuficiente", // ESTADO INSUFICIENTE
    confidence_score: 10,
    investigado_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await assert.rejects(
    async () => {
      await redactarEmailOutbound({
        contacto: contact,
        empresa: company,
        research: researchInsuficiente,
        paso: { step_number: 1, delay_days: 0, channel: "email", angulo: "apertura" },
        remitenteNombre: "Marcelo Valdés",
      });
    },
    /Investigación insuficiente/,
  );
});
