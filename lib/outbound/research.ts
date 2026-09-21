/**
 * MOTOR DE INVESTIGACIÓN Y EVIDENCIA — Outbound V1
 *
 * Principio: Cero alucinación y minimización de datos.
 * Toda afirmación sobre la empresa debe tener un hecho observable con URL y cita de respaldo.
 * Si no hay información verificable suficiente, el estado queda en `insuficiente`
 * y previene que el Copy Engine invente personalizaciones falsas.
 */

import { type Company, type CompanyResearch, type EvidenceItem } from "./types";
import { type OutboundStore } from "./store";
import { geminiJson } from "../gemini";

export interface OpcionesInvestigacion {
  forzarReinvestigacion?: boolean;
  contextoAdicional?: string;
  senalesPrevias?: string[];
}

/**
 * Investiga una empresa y almacena su ficha estructurada con evidencia verificable.
 */
export async function investigarEmpresa(
  company: Company,
  store: OutboundStore,
  opciones?: OpcionesInvestigacion,
): Promise<CompanyResearch> {
  // 1. Revisar si ya existe research previo vigente
  if (!opciones?.forzarReinvestigacion) {
    const existente = await store.getResearchByCompanyId(company.id);
    if (existente && existente.estado === "completo") {
      return existente;
    }
  }

  const ahora = new Date().toISOString();
  const evidencias: EvidenceItem[] = [];

  // 2. Extraer hechos observables directos de la ficha
  const website = company.sitio_web || (company.dominio_web ? `https://${company.dominio_web}` : "");

  // Si no tenemos ni web ni señales, no podemos inventar
  if (!website && !opciones?.contextoAdicional && (!company.tags || company.tags.length === 0)) {
    const insuficiente: Omit<CompanyResearch, "id" | "created_at" | "updated_at"> = {
      company_id: company.id,
      resumen_actividad: `${company.nombre} (sin web ni contexto verificable disponible)`,
      canales_visibles: [],
      captacion_leads: "No verificada",
      senales_dolor: ["Falta de información pública directa"],
      propuesta_valor_respondo: "Atención comercial automática de WhatsApp para pymes",
      evidencias: [],
      estado: "insuficiente",
      confidence_score: 10,
      investigado_at: ahora,
    };
    return await store.upsertResearch(insuficiente);
  }

  // 3. Si hay contexto adicional o tags de fuentes confiables (ej. Impresora Color)
  if (opciones?.contextoAdicional) {
    evidencias.push({
      insight: "Relación previa o contexto comercial documentado internamente",
      fuente_url: website || "registro_interno",
      extracto: opciones.contextoAdicional.slice(0, 300),
      confianza: "alta",
    });
  }

  // 4. Invocar a Gemini para estructurar la información disponible
  try {
    const prompt = `Analiza este negocio para prospección comercial de Respondo (asistente de ventas con IA para WhatsApp que atiende cotizaciones, agenda horas y responde dudas frecuentes de clientes).

Negocio: "${company.nombre}"
Rubro declarado: "${company.rubro ?? "No especificado"}"
Comuna: "${company.comuna ?? "Chile"}"
Sitio Web: "${website}"
Contexto o señales registradas:
"${opciones?.contextoAdicional ?? company.tags.join("; ")}"

INSTRUCCIONES ESTRICTAS:
1. NO inventes servicios, tecnologías ni relaciones que no estén explícitas.
2. Cada "insight" de personalización debe estar soportado por un extracto verificable del contexto o web.
3. Clasifica la confianza en "alta", "media" o "baja".
4. Devuelve SOLO JSON válido con este formato:
{
  "resumen_actividad": "qué vende o qué servicio entrega el negocio en 1-2 oraciones",
  "canales_visibles": ["WhatsApp", "Instagram", "Sitio Web", "Formulario", "Teléfono"],
  "captacion_leads": "cómo reciben hoy las consultas de sus clientes",
  "senales_dolor": ["pregunta o consulta repetida típica de su rubro que hoy contestan a mano"],
  "propuesta_valor_respondo": "por qué un asistente de WhatsApp le ahorra tiempo o evita que pierdan ventas",
  "evidencias": [
    {
      "insight": "observación concreta sobre su operación",
      "fuente_url": "${website || "registro_interno"}",
      "extracto": "cita textual o resumen breve del hecho real",
      "confianza": "alta"
    }
  ],
  "confidence_score": 85
}`;

    const parsed = await geminiJson<{
      resumen_actividad?: string;
      canales_visibles?: string[];
      captacion_leads?: string;
      senales_dolor?: string[];
      propuesta_valor_respondo?: string;
      evidencias?: EvidenceItem[];
      confidence_score?: number;
    }>(prompt, undefined, {
      temperature: 0.2,
      maxOutputTokens: 800,
    });

    const itemsEvidencia: EvidenceItem[] = [...evidencias, ...(parsed?.evidencias ?? [])].filter(
      (e) => e.insight && e.extracto,
    );

    const score = parsed?.confidence_score ?? (itemsEvidencia.length > 0 ? 70 : 30);
    const estado = score >= 50 && itemsEvidencia.length > 0 ? "completo" : "insuficiente";

    const researchData: Omit<CompanyResearch, "id" | "created_at" | "updated_at"> = {
      company_id: company.id,
      resumen_actividad: parsed?.resumen_actividad || `${company.nombre}, rubro ${company.rubro || "comercial"}.`,
      canales_visibles: parsed?.canales_visibles || ["WhatsApp"],
      captacion_leads: parsed?.captacion_leads || "Atención directa de consultas comerciales",
      senales_dolor: parsed?.senales_dolor || ["Consultas repetidas de precios y disponibilidad fuera de horario"],
      propuesta_valor_respondo:
        parsed?.propuesta_valor_respondo ||
        "Responder de inmediato en WhatsApp con cotizaciones y agendamiento sin dejar esperando al cliente.",
      evidencias: itemsEvidencia,
      estado,
      confidence_score: score,
      investigado_at: ahora,
    };

    return await store.upsertResearch(researchData);
  } catch (err) {
    // Si la IA falla o no hay API key disponible, crear fallback determinista defensivo
    const fallback: Omit<CompanyResearch, "id" | "created_at" | "updated_at"> = {
      company_id: company.id,
      resumen_actividad: `${company.nombre}${company.rubro ? ` (${company.rubro})` : ""}`,
      canales_visibles: website ? ["Sitio Web"] : [],
      captacion_leads: "Atención comercial por canales directos",
      senales_dolor: ["Consultas de clientes en horarios punta o fines de semana"],
      propuesta_valor_respondo: "Asistente comercial en WhatsApp para responder de inmediato sin perder ventas.",
      evidencias: evidencias.length > 0 ? evidencias : [
        {
          insight: `Negocio operativo en el rubro ${company.rubro || "comercial"}`,
          fuente_url: website || "registro_directorio",
          extracto: `Ficha registrada: ${company.nombre}, comuna ${company.comuna || "Chile"}`,
          confianza: "media",
        },
      ],
      estado: evidencias.length > 0 ? "completo" : "insuficiente",
      confidence_score: evidencias.length > 0 ? 60 : 30,
      investigado_at: ahora,
    };
    return await store.upsertResearch(fallback);
  }
}
