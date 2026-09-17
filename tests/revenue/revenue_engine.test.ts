(process.env as any).NODE_ENV = "test";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MemoryRevenueStore } from "../../lib/revenue/store";
import {
  REVENUE_STAGES,
  REVENUE_STAGE_CONFIG,
  CALL_OUTCOMES,
  CALL_OUTCOME_CONFIG,
  LOST_REASONS,
  HqDeal,
  RevenueStage,
} from "../../lib/revenue/types";
import {
  evaluarTratoEstancado,
  validarReglaNextAction,
  validarPropuestaGuardrail,
} from "../../lib/revenue/guardrails";
import { calcularScoringComercial } from "../../lib/revenue/scoring";
import {
  PLAYBOOK_COMPETITORS,
  PLAYBOOK_OBJECTIONS,
  PLAYBOOK_PITCHES,
} from "../../lib/revenue/playbookData";
import { esUUIDValido } from "../../lib/revenue/validation";

describe("REVENUE OPERATING SYSTEM V1 — SUITE DE PRUEBAS", () => {
  describe("1. Modelo de Etapas y Configuración Comercial", () => {
    it("debe contener las 12 etapas comerciales en orden secuencial estricto", () => {
      assert.equal(REVENUE_STAGES.length, 12);
      assert.equal(REVENUE_STAGES[0], "nuevo");
      assert.equal(REVENUE_STAGES[6], "piloto_activo");
      assert.equal(REVENUE_STAGES[9], "ganado");
      assert.equal(REVENUE_STAGES[11], "perdido");

      for (const stage of REVENUE_STAGES) {
        const config = REVENUE_STAGE_CONFIG[stage];
        assert.ok(config, `Falta configuración para la etapa ${stage}`);
        assert.equal(config.value, stage);
        assert.ok(config.label.length > 0);
        assert.ok(config.description.length > 0);
      }
    });

    it("las etapas finales (ganado, nurture, perdido) deben estar marcadas como isClosed", () => {
      assert.equal(REVENUE_STAGE_CONFIG.ganado.isClosed, true);
      assert.equal(REVENUE_STAGE_CONFIG.ganado.isWon, true);
      assert.equal(REVENUE_STAGE_CONFIG.perdido.isClosed, true);
      assert.equal(REVENUE_STAGE_CONFIG.perdido.isWon, false);
      assert.equal(REVENUE_STAGE_CONFIG.nurture.isClosed, true);
      assert.equal(REVENUE_STAGE_CONFIG.propuesta_enviada.isClosed, false);
    });
  });

  describe("2. Regla de Oro: Next Action Mandatorio", () => {
    it("permite crear un Deal activo con next_action y next_action_at válidos", () => {
      const res = validarReglaNextAction({
        etapa: "contactando",
        next_action: "Llamar a Tomás para coordinar demo",
        next_action_at: new Date(Date.now() + 86400000).toISOString(),
      });
      assert.equal(res.valid, true);
    });

    it("rechaza un Deal activo si next_action está vacío o es solo espacios", () => {
      const res = validarReglaNextAction({
        etapa: "propuesta_enviada",
        next_action: "   ",
        next_action_at: new Date().toISOString(),
      });
      assert.equal(res.valid, false);
      assert.match(res.error || "", /Próxima Acción/i);
    });

    it("rechaza un Deal activo si falta la fecha next_action_at", () => {
      const res = validarReglaNextAction({
        etapa: "piloto_propuesto",
        next_action: "Llamar para coordinar fecha",
        next_action_at: null,
      });
      assert.equal(res.valid, false);
      assert.match(res.error || "", /fecha programada/i);
    });

    it("permite que un Deal ganado o perdido no tenga next_action obligatoria", () => {
      const resWon = validarReglaNextAction({ etapa: "ganado", next_action: "", next_action_at: null });
      assert.equal(resWon.valid, true);

      const resLost = validarReglaNextAction({ etapa: "perdido", next_action: "", next_action_at: null });
      assert.equal(resLost.valid, true);
    });
  });

  describe("3. Detección Determinista de Tratos Estancados (Stalled)", () => {
    const dealBase: HqDeal = {
      id: "deal-001",
      company_name: "Taller Mecánico El Tuerca",
      contact_name: "Rodrigo Pérez",
      contact_role: "Dueño",
      contact_phone: "+56911223344",
      contact_email: "rodrigo@eltuerca.cl",
      contact_whatsapp: "+56911223344",
      industry: "automotriz",
      city: "Chillán",
      etapa: "contactando",
      plan: "inicial",
      valor_mensual_neto: 149990,
      valor_setup_neto: 0,
      pain_primary: "Pérdida de cotizaciones de repuestos en horario de taller",
      use_case: "Cotización base y agendamiento de horas",
      competidor: "WhatsApp Business manual",
      next_action: "Llamar para confirmar recepción de propuesta",
      next_action_at: new Date(Date.now() + 86400000).toISOString(),
      next_action_owner: "Marcelo",
      stalled: false,
      stalled_reason: null,
      lost_reason: null,
      lost_notes: null,
      won_notes: null,
      fit_score: 75,
      intent_score: 60,
      priority_score: 67,
      experiment_id: null,
      prospect_id: null,
      lead_foco_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it("trato saludable con acción futura no está estancado", () => {
      const res = evaluarTratoEstancado(dealBase);
      assert.equal(res.isStalled, false);
      assert.equal(res.reason, null);
    });

    it("trato con fecha next_action_at vencida se marca inmediatamente como estancado", () => {
      const dealAtrasado: HqDeal = {
        ...dealBase,
        next_action_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      };
      const res = evaluarTratoEstancado(dealAtrasado);
      assert.equal(res.isStalled, true);
      assert.match(res.reason || "", /Siguiente acción vencida/i);
    });

    it("detecta el 'Problema Aleta': propuesta enviada sin fecha de revisión ni decisión", () => {
      const dealAleta: HqDeal = {
        ...dealBase,
        company_name: "Aleta Pescados",
        etapa: "propuesta_enviada",
        next_action: "Esperar a que revisen internamente",
        next_action_at: new Date(Date.now() + 86400000).toISOString(),
      };

      const propuestaSinFechas = {
        id: "prop-aleta",
        deal_id: dealAleta.id,
        company_name: dealAleta.company_name,
        version: 1,
        plan: "inicial" as const,
        valor_mensual_neto: 149990,
        valor_setup_neto: 0,
        condiciones_prueba: "14 días",
        alcance_resumen: "Tino, Beto, Vera",
        sent_at: new Date().toISOString(),
        review_date: null,
        decision_date: null,
        status: "enviada" as const,
        notas: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const res = evaluarTratoEstancado(dealAleta, {
        proposals: [propuestaSinFechas],
      });

      assert.equal(res.isStalled, true);
      assert.match(res.reason || "", /Problema Aleta/i);
    });

    it("detecta piloto activo sin fecha fijada de reunión del Día 14", () => {
      const dealPiloto: HqDeal = {
        ...dealBase,
        etapa: "piloto_activo",
      };

      const pilotoSinRevision = {
        id: "pilot-01",
        deal_id: dealPiloto.id,
        company_name: dealPiloto.company_name,
        status: "activo" as const,
        start_date: "2026-09-01",
        end_date: "2026-09-15",
        review_date: null,
        hipotesis: "Acelerar respuesta",
        metricas_base: "30 min de espera",
        resuelve_vs_deriva: {
          catalogo_precios_base: "resuelve" as const,
          disponibilidad_stock: "deriva" as const,
          agendamiento_horas: "resuelve" as const,
          cotizaciones_especiales: "deriva" as const,
          pedidos_despacho: "resuelve" as const,
          reclamos_postventa: "deriva" as const,
        },
        kpi_primario: "Tiempo de respuesta",
        kpis_secundarios: "Horas agendadas",
        meta_kpi: "< 1 min",
        criterio_exito: "≥ 80% atendido",
        decision_si_exito: "Plan Inicial",
        casos_totales_atendidos: 50,
        casos_derivados_humano: 10,
        seguimientos_beto_enviados: 20,
        seguimientos_beto_respuestas: 6,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const res = evaluarTratoEstancado(dealPiloto, {
        pilots: [pilotoSinRevision],
      });

      assert.equal(res.isStalled, true);
      assert.match(res.reason || "", /Día 14/i);
    });

    it("guardrail emite advertencia ante propuesta enviada sin fechas comprometidas", () => {
      const guardrailRes = validarPropuestaGuardrail({
        status: "enviada",
        review_date: null,
        decision_date: null,
      });
      assert.equal(guardrailRes.valid, true);
      assert.match(guardrailRes.warning || "", /Efecto Aleta/i);
    });
  });

  describe("4. Motor de Scoring Determinista (Fit, Intent, Priority)", () => {
    it("calcula alto Fit y Prioridad para una pyme chilena con WhatsApp, citas y cotizaciones", () => {
      const res = calcularScoringComercial({
        usesWhatsApp: true,
        usesBooking: true,
        usesPaidAds: true,
        isQuoteDriven: true,
        isSpeedSensitive: true,
        employeeCount: 12,
        industry: "clinica dental",
        hasOwnWeb: true,
        meetingBooked: true,
        askedPricing: true,
        proposalRequested: true,
      });

      assert.ok(res.fitScore >= 80, `Fit esperado >= 80, obtenido: ${res.fitScore}`);
      assert.ok(res.intentScore >= 35, `Intent esperado >= 35, obtenido: ${res.intentScore}`);
      assert.ok(res.priorityScore >= 50, `Prioridad esperada >= 50, obtenido: ${res.priorityScore}`);
      assert.equal(res.veredicto, "prioridad_inmediata");
    });

    it("castiga severamente a empresas corporativas gigantes (>200 empleados) para evitar burocracia", () => {
      const res = calcularScoringComercial({
        usesWhatsApp: true,
        usesBooking: false,
        usesPaidAds: false,
        isQuoteDriven: false,
        isSpeedSensitive: false,
        employeeCount: 500, // Corporativo grande
        industry: "banca",
        hasOwnWeb: true,
      });

      assert.ok(res.fitScore < 40, `Corporación gigante debe tener fit bajo, obtenido: ${res.fitScore}`);
      assert.equal(res.veredicto, "descartar");
    });

    it("aplica la regla de Marcelo: sin fit no hay prioridad (media geométrica)", () => {
      const res = calcularScoringComercial({
        usesWhatsApp: false,
        usesBooking: false,
        usesPaidAds: false,
        isQuoteDriven: false,
        isSpeedSensitive: false,
        industry: "minería",
        hasOwnWeb: false,
        proposalRequested: true, // Intent alto pero sin encaje
      });

      assert.ok(res.fitScore < 40, `Fit debe ser bajo (<40), obtenido: ${res.fitScore}`);
      assert.equal(res.priorityScore, 0, `Prioridad debe ser 0 cuando fit < 40 según la regla de Marcelo`);
    });
  });

  describe("5. Resultados Estructurados de Llamadas y Acciones Sugeridas", () => {
    it("los 10 outcomes de llamadas proveen acción sugerida concreta y delay en días", () => {
      assert.equal(CALL_OUTCOMES.length, 10);
      for (const outcome of CALL_OUTCOMES) {
        const cfg = CALL_OUTCOME_CONFIG[outcome];
        assert.ok(cfg, `Falta configuración para outcome ${outcome}`);
        assert.ok(cfg.actionSugerida.length > 5);
        assert.ok(typeof cfg.delayDias === "number");
      }
    });

    it("resultado 'reunion_agendada' sugiere invitación y preparación", () => {
      assert.match(CALL_OUTCOME_CONFIG.reunion_agendada.actionSugerida, /invitación|preparación/i);
      assert.equal(CALL_OUTCOME_CONFIG.reunion_agendada.delayDias, 0);
    });

    it("resultado 'nurture' programa reactivación a 45 días", () => {
      assert.equal(CALL_OUTCOME_CONFIG.nurture.delayDias, 45);
    });
  });

  describe("6. Integridad de Fichas del Playbook y Enablement", () => {
    it("contiene fichas completas para los competidores clave en Chile y LatAm", () => {
      const compNames = PLAYBOOK_COMPETITORS.map((c) => c.name);
      assert.ok(compNames.some((n) => n.includes("Meta Business Agent")));
      assert.ok(compNames.some((n) => n.includes("AgendaPro")));
      assert.ok(compNames.some((n) => n.includes("Kommo")));
      assert.ok(compNames.some((n) => n.includes("ManyChat")));
      assert.ok(compNames.some((n) => n.includes("Vambe")));

      for (const comp of PLAYBOOK_COMPETITORS) {
        assert.ok(comp.whatTheyDoWell.length >= 2);
        assert.ok(comp.whereRespondoDiffers.length >= 2);
        assert.ok(comp.whatNOTToClaim.startsWith("NO"));
        assert.ok(comp.killerQuestion.includes("?"));
      }
    });

    it("contiene los 3 pitches canónicos (one-liner, 30s, 2min)", () => {
      assert.equal(PLAYBOOK_PITCHES.length, 3);
      const types = PLAYBOOK_PITCHES.map((p) => p.type);
      assert.ok(types.includes("one_liner"));
      assert.ok(types.includes("30_seconds"));
      assert.ok(types.includes("2_minutes"));
    });

    it("contiene scripts naturales de manejo de objeciones para Chile", () => {
      assert.ok(PLAYBOOK_OBJECTIONS.length >= 5);
      const ids = PLAYBOOK_OBJECTIONS.map((o) => o.id);
      assert.ok(ids.includes("mandame_correo"));
      assert.ok(ids.includes("ya_tenemos_bot"));
      assert.ok(ids.includes("equipo_humano"));
      assert.ok(ids.includes("es_muy_caro"));
    });
  });

  describe("7. Persistencia y Flujo Comercial en Repositorio", () => {
    it("permite el ciclo de vida completo de un Deal con reuniones, propuestas y timeline", async () => {
      const store = new MemoryRevenueStore();

      // 1. Crear Deal inicial con Next Action
      const deal = await store.createDeal({
        company_name: "RS-Shop Motos Chillán",
        contact_name: "Roland Spaarwater",
        contact_role: "Gerente General",
        contact_phone: "+56942252493",
        contact_email: "contacto@rsshop.cl",
        contact_whatsapp: "+56942252493",
        industry: "motos",
        city: "Chillán",
        etapa: "reunion_agendada",
        plan: "inicial",
        valor_mensual_neto: 149990,
        valor_setup_neto: 0,
        pain_primary: "Pérdida de cotizaciones de repuestos y desorden en agenda de taller",
        use_case: "Atención comercial, agenda y seguimiento Beto",
        competidor: "WhatsApp manual de vendedores",
        next_action: "Preparar reunión de discovery de 45 minutos",
        next_action_at: new Date(Date.now() + 86400000).toISOString(),
        next_action_owner: "Marcelo Valdés",
        stalled: false,
        stalled_reason: null,
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        fit_score: 85,
        intent_score: 70,
        priority_score: 77,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      assert.ok(esUUIDValido(deal.id), `deal.id debe ser un UUID válido, recibido: ${deal.id}`);
      assert.equal(deal.company_name, "RS-Shop Motos Chillán");

      // 2. Registrar reunión de discovery
      const meeting = await store.createMeeting({
        deal_id: deal.id,
        company_name: deal.company_name,
        contact_name: deal.contact_name,
        scheduled_at: new Date().toISOString(),
        status: "completada",
        meeting_type: "discovery",
        interest_score: 5,
        pain_diagnosticado: "Repuestos sin responder fuera de horario; taller sin horas online",
        volumen_mensual: 1100,
        proceso_actual: "Cada vendedor usa su propio celular",
        herramientas_actuales: "WhatsApp Business y Excel",
        urgencia: "alta",
        decisor_involucrado: true,
        proceso_decision: "Decide Roland con jefatura de taller",
        objeciones: "Temor a que la IA invente precios de motos",
        demo_mostrada: "Tino derivando ventas mayores a $300k y Beto reactivando",
        siguiente_paso: "Enviar propuesta comercial con 14 días de prueba",
        siguiente_paso_at: new Date(Date.now() + 86400000).toISOString(),
        notas: "Muy entusiasmados con la coexistencia.",
      });

      assert.ok(esUUIDValido(meeting.id), `ID de reunión debe ser un UUID válido, recibido: ${meeting.id}`);

      // Actualizar etapa del Deal tras reunión de discovery exitosa
      await store.updateDeal(deal.id, {
        etapa: "discovery_completado",
        next_action: "Enviar propuesta comercial y preparar piloto",
        next_action_at: new Date(Date.now() + 86400000).toISOString(),
      });

      // 3. Crear propuesta comercial con fechas firmes
      const proposal = await store.createProposal({
        deal_id: deal.id,
        company_name: deal.company_name,
        version: 1,
        plan: "inicial",
        valor_mensual_neto: 149990,
        valor_setup_neto: 0,
        condiciones_prueba: "14 días gratis sin permanencia",
        alcance_resumen: "Casa matriz Chillán, agenda taller y 1.200 conversaciones",
        sent_at: new Date().toISOString(),
        review_date: "2026-09-20",
        decision_date: "2026-09-25",
        status: "enviada",
        notas: "Enviada propuesta PDF adaptada",
      });

      assert.ok(esUUIDValido(proposal.id), `ID de propuesta debe ser un UUID válido, recibido: ${proposal.id}`);

      // 4. Crear Piloto de 14 días
      const pilot = await store.createPilot({
        deal_id: deal.id,
        company_name: deal.company_name,
        status: "activo",
        start_date: "2026-09-16",
        end_date: "2026-09-30",
        review_date: "2026-09-30",
        hipotesis: "Tino responde en <30s y Beto reactiva al menos 5 cotizaciones",
        metricas_base: "Tiempo de respuesta 45 min en promedio",
        resuelve_vs_deriva: {
          catalogo_precios_base: "resuelve",
          disponibilidad_stock: "deriva",
          agendamiento_horas: "resuelve",
          cotizaciones_especiales: "deriva",
          pedidos_despacho: "resuelve",
          reclamos_postventa: "deriva",
          umbral_monto_derivacion_clp: 300000,
        },
        kpi_primario: "Tiempo de primera respuesta < 1 min",
        kpis_secundarios: "Horas de taller agendadas",
        meta_kpi: "< 60 segundos",
        criterio_exito: "85% de consultas atendidas sin intervención",
        decision_si_exito: "Contratación de Plan Inicial",
        casos_totales_atendidos: 120,
        casos_derivados_humano: 22,
        seguimientos_beto_enviados: 45,
        seguimientos_beto_respuestas: 14,
      });

      assert.ok(esUUIDValido(pilot.id), `ID de piloto debe ser un UUID válido, recibido: ${pilot.id}`);

      // 5. Registrar actividad en el Timeline
      const act = await store.logActivity({
        deal_id: deal.id,
        company_name: deal.company_name,
        tipo: "reunion",
        resultado: "interesado",
        detalle: "Reunión de discovery completada. Piloto acordado.",
        proxima_accion: "Revisar métricas día 7",
        proxima_accion_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        creado_por: "Marcelo Valdés",
      });

      assert.ok(esUUIDValido(act.id), `ID de actividad debe ser un UUID válido, recibido: ${act.id}`);

      // 6. Avanzar etapa a piloto_activo y verificar
      const updatedDeal = await store.updateDeal(deal.id, {
        etapa: "piloto_activo",
        next_action: "Seguimiento mitad de piloto",
        next_action_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      });

      assert.equal(updatedDeal.etapa, "piloto_activo");
      assert.equal(updatedDeal.stalled, false);

      const allDeals = await store.getDeals();
      assert.equal(allDeals.length, 1);
      assert.equal(allDeals[0].company_name, "RS-Shop Motos Chillán");
    });
  });
});
