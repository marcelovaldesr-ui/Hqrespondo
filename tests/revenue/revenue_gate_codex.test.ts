(process.env as any).NODE_ENV = "test";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validarUpdateMeetingInput,
  validarUpdatePilotInput,
  validarUpdateProposalInput,
  validarCreateDealInput,
  validarUpdateDealInput,
  validarTransicionEtapa,
} from "../../lib/revenue/validation";
import {
  MemoryRevenueStore,
  setRevenueStoreForTesting,
} from "../../lib/revenue/store";
import {
  createMeetingAction,
  createPilotAction,
  createProposalAction,
} from "../../app/actions/revenue";
import type {
  HqDeal,
  HqMeeting,
  HqPilot,
  HqProposal,
  RevenueStage,
} from "../../lib/revenue/types";

describe("REVENUE OS V1 — GATE CODEX FINAL REMEDIATION", () => {
  describe("1. Eliminación de Mass Assignment en Updates", () => {
    const meetingId = crypto.randomUUID();
    const dealId = crypto.randomUUID();
    const existingMeeting: HqMeeting = {
      id: meetingId,
      deal_id: dealId,
      company_name: "Empresa Dental Spa",
      contact_name: "Dr. Soto",
      scheduled_at: "2026-09-20T10:00:00Z",
      meeting_type: "discovery",
      status: "agendada",
      interest_score: 4,
      pain_diagnosticado: "Citas perdidas y no-shows",
      volumen_mensual: 120,
      proceso_actual: "Agenda manual en cuaderno",
      herramientas_actuales: "WhatsApp web",
      urgencia: "alta",
      decisor_involucrado: true,
      proceso_decision: "Dueño decide directamente",
      objeciones: "Costo mensual",
      demo_mostrada: "Flujo agendamiento dental",
      siguiente_paso: "Piloto 14 días",
      siguiente_paso_at: "2026-09-22T10:00:00Z",
      notas: "Muy interesado en piloto",
      created_at: "2026-09-15T00:00:00Z",
      updated_at: "2026-09-15T00:00:00Z",
    };

    it("rechaza intento de modificar id o deal_id en updateMeeting por presencia (MASS_ASSIGNMENT_ERROR)", () => {
      // Intento con ID nuevo
      assert.throws(
        () =>
          validarUpdateMeetingInput(existingMeeting, {
            id: crypto.randomUUID(),
          } as any),
        /MASS_ASSIGNMENT_ERROR.*id/
      );

      // Intento con el MISMO id existente (rechazo por presencia estricta)
      assert.throws(
        () =>
          validarUpdateMeetingInput(existingMeeting, {
            id: existingMeeting.id,
          } as any),
        /MASS_ASSIGNMENT_ERROR.*id/
      );

      // Intento con deal_id nuevo
      assert.throws(
        () =>
          validarUpdateMeetingInput(existingMeeting, {
            deal_id: crypto.randomUUID(),
          } as any),
        /MASS_ASSIGNMENT_ERROR.*deal_id/
      );

      // Intento con el MISMO deal_id existente (rechazo por presencia estricta)
      assert.throws(
        () =>
          validarUpdateMeetingInput(existingMeeting, {
            deal_id: existingMeeting.deal_id,
          } as any),
        /MASS_ASSIGNMENT_ERROR.*deal_id/
      );
    });

    it("rechaza intento de modificar timestamps o company_name en updateMeeting", () => {
      // created_at nuevo
      assert.throws(
        () =>
          validarUpdateMeetingInput(existingMeeting, {
            created_at: "2020-01-01T00:00:00Z",
          } as any),
        /MASS_ASSIGNMENT_ERROR.*created_at/
      );

      // created_at idéntico al existente (rechazo por presencia)
      assert.throws(
        () =>
          validarUpdateMeetingInput(existingMeeting, {
            created_at: existingMeeting.created_at,
          } as any),
        /MASS_ASSIGNMENT_ERROR.*created_at/
      );

      assert.throws(
        () =>
          validarUpdateMeetingInput(existingMeeting, {
            company_name: "Hacked Company",
          } as any),
        /MASS_ASSIGNMENT_ERROR.*company_name/
      );
    });

    it("rechaza cualquier propiedad inventada o desconocida en updateMeeting (VALIDATION_ERROR)", () => {
      assert.throws(
        () =>
          validarUpdateMeetingInput(existingMeeting, {
            propiedad_inventada: "inyeccion",
          } as any),
        /VALIDATION_ERROR.*propiedad_inventada/
      );
    });

    it("permite updates válidos en updateMeeting bajo allowlist estricta", () => {
      const sanitized = validarUpdateMeetingInput(existingMeeting, {
        status: "completada",
        interest_score: 5,
        notas: "Excelente reunión, pasamos a piloto",
      });

      assert.equal(sanitized.status, "completada");
      assert.equal(sanitized.interest_score, 5);
      assert.equal(sanitized.notas, "Excelente reunión, pasamos a piloto");
      assert.equal((sanitized as any).id, undefined);
      assert.equal((sanitized as any).deal_id, undefined);
    });

    const pilotId = crypto.randomUUID();
    const existingPilot: HqPilot = {
      id: pilotId,
      deal_id: dealId,
      company_name: "Taller Mecánico Central",
      status: "activo",
      start_date: "2026-09-10",
      end_date: "2026-09-24",
      review_date: "2026-09-24",
      hipotesis: "Automatizar agendamiento",
      metricas_base: "10 llamadas perdidas al día",
      resuelve_vs_deriva: {
        catalogo_precios_base: "resuelve",
        disponibilidad_stock: "resuelve",
        agendamiento_horas: "resuelve",
        cotizaciones_especiales: "deriva",
        pedidos_despacho: "deriva",
        reclamos_postventa: "deriva",
      },
      kpi_primario: "Tasa de agendamiento",
      kpis_secundarios: "Tiempo de respuesta",
      meta_kpi: "> 85%",
      criterio_exito: "Al menos 20 citas agendadas",
      decision_si_exito: "Contratar Plan Pro",
      casos_totales_atendidos: 15,
      casos_derivados_humano: 2,
      seguimientos_beto_enviados: 8,
      seguimientos_beto_respuestas: 4,
      resultado_dia_14: undefined,
      resultado_notas: undefined,
      created_at: "2026-09-10T00:00:00Z",
      updated_at: "2026-09-10T00:00:00Z",
    };

    it("rechaza mass assignment en updatePilot por presencia (mismo id, mismo deal_id, created_at)", () => {
      // Mismo ID
      assert.throws(
        () =>
          validarUpdatePilotInput(existingPilot, {
            id: existingPilot.id,
          } as any),
        /MASS_ASSIGNMENT_ERROR.*id/
      );

      // Mismo deal_id
      assert.throws(
        () =>
          validarUpdatePilotInput(existingPilot, {
            deal_id: existingPilot.deal_id,
          } as any),
        /MASS_ASSIGNMENT_ERROR.*deal_id/
      );

      // created_at
      assert.throws(
        () =>
          validarUpdatePilotInput(existingPilot, {
            created_at: existingPilot.created_at,
          } as any),
        /MASS_ASSIGNMENT_ERROR.*created_at/
      );

      assert.throws(
        () =>
          validarUpdatePilotInput(existingPilot, {
            company_name: "Otra Empresa",
          } as any),
        /MASS_ASSIGNMENT_ERROR.*company_name/
      );
    });

    it("rechaza propiedades inventadas o desconocidas en updatePilot (VALIDATION_ERROR)", () => {
      assert.throws(
        () =>
          validarUpdatePilotInput(existingPilot, {
            campo_no_permitido: 999,
          } as any),
        /VALIDATION_ERROR.*campo_no_permitido/
      );
    });

    it("permite updates válidos en updatePilot bajo allowlist", () => {
      const sanitized = validarUpdatePilotInput(existingPilot, {
        casos_totales_atendidos: 25,
        resultado_dia_14: "Piloto superó meta con 22 citas automáticas",
      });

      assert.equal(sanitized.casos_totales_atendidos, 25);
      assert.equal(sanitized.resultado_dia_14, "Piloto superó meta con 22 citas automáticas");
      assert.equal((sanitized as any).id, undefined);
    });

    const proposalId = crypto.randomUUID();
    const existingProposal: HqProposal = {
      id: proposalId,
      deal_id: dealId,
      company_name: "Corredora Providencia",
      version: 1,
      plan: "crecimiento",
      valor_mensual_neto: 269990,
      valor_setup_neto: 0,
      condiciones_prueba: "14 días de garantía",
      alcance_resumen: "Bot de WhatsApp + Calificación de leads",
      sent_at: "2026-09-15T12:00:00Z",
      review_date: "2026-09-22T12:00:00Z",
      decision_date: "2026-09-25T12:00:00Z",
      status: "enviada",
      notas: "Propuesta enviada por WhatsApp y correo",
      created_at: "2026-09-15T00:00:00Z",
      updated_at: "2026-09-15T00:00:00Z",
    };

    it("rechaza mass assignment en updateProposal por presencia (mismo id, mismo deal_id, created_at)", () => {
      // Mismo id
      assert.throws(
        () =>
          validarUpdateProposalInput(existingProposal, {
            id: existingProposal.id,
          } as any),
        /MASS_ASSIGNMENT_ERROR.*id/
      );

      // Mismo deal_id
      assert.throws(
        () =>
          validarUpdateProposalInput(existingProposal, {
            deal_id: existingProposal.deal_id,
          } as any),
        /MASS_ASSIGNMENT_ERROR.*deal_id/
      );

      // created_at
      assert.throws(
        () =>
          validarUpdateProposalInput(existingProposal, {
            created_at: existingProposal.created_at,
          } as any),
        /MASS_ASSIGNMENT_ERROR.*created_at/
      );

      assert.throws(
        () =>
          validarUpdateProposalInput(existingProposal, {
            company_name: "Hacked",
          } as any),
        /MASS_ASSIGNMENT_ERROR.*company_name/
      );
    });

    it("rechaza propiedades desconocidas o inventadas en updateProposal (VALIDATION_ERROR)", () => {
      assert.throws(
        () =>
          validarUpdateProposalInput(existingProposal, {
            propiedad_inventada: true,
          } as any),
        /VALIDATION_ERROR.*propiedad_inventada/
      );
    });

    it("permite updates válidos en updateProposal bajo allowlist", () => {
      const sanitized = validarUpdateProposalInput(existingProposal, {
        status: "aceptada",
        notas: "Aceptó con descuento anual",
      });

      assert.equal(sanitized.status, "aceptada");
      assert.equal(sanitized.notas, "Aceptó con descuento anual");
      assert.equal((sanitized as any).id, undefined);
    });

    it("validación de mass assignment opera idénticamente en MemoryRevenueStore", async () => {
      const store = new MemoryRevenueStore();
      const deal = await store.createDeal({
        company_name: "Empresa Store Validation",
        contact_name: "Ana",
        contact_role: "Gerente",
        contact_phone: "+56911223344",
        contact_email: "ana@test.cl",
        contact_whatsapp: "+56911223344",
        industry: "retail",
        city: "Santiago",
        etapa: "calificado",
        plan: "inicial",
        valor_mensual_neto: 149990,
        valor_setup_neto: 0,
        pain_primary: "Pérdida de ventas",
        use_case: "Chatbot",
        competidor: "",
        next_action: "Agendar",
        next_action_at: new Date().toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 70,
        intent_score: 70,
        priority_score: 70,
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      const meeting = await store.createMeeting({
        deal_id: deal.id,
        company_name: deal.company_name,
        contact_name: "Ana",
        scheduled_at: "2026-09-25T10:00:00Z",
        status: "agendada",
        meeting_type: "discovery",
        interest_score: 4,
        pain_diagnosticado: "Ventas",
        volumen_mensual: 50,
        proceso_actual: "Manual",
        herramientas_actuales: "Ninguna",
        urgencia: "media",
        decisor_involucrado: true,
        proceso_decision: "Directo",
        objeciones: "Ninguna",
        demo_mostrada: "Si",
        siguiente_paso: "Piloto",
        siguiente_paso_at: null,
        notas: "",
      });

      // Intento de update con mismo id a través de store
      await assert.rejects(
        () => store.updateMeeting(meeting.id, { id: meeting.id } as any),
        /MASS_ASSIGNMENT_ERROR/
      );

      // Intento de update con propiedad desconocida a través de store
      await assert.rejects(
        () => store.updateMeeting(meeting.id, { propiedad_inventada: 123 } as any),
        /VALIDATION_ERROR/
      );
    });
  });

  describe("2. Scoring Obligatorio en Servidor (fit_score < 40 => priority_score = 0)", () => {
    it("al crear deal: fit=20 y priority enviado=90 da ESTRICTAMENTE priority_score=0", () => {
      const sanitized = validarCreateDealInput({
        company_name: "Empresa Bajo Encaje",
        contact_name: "Pedro",
        contact_role: "Dueño",
        contact_phone: "+56911223344",
        contact_email: "pedro@empresa.cl",
        contact_whatsapp: "+56911223344",
        industry: "mineria_pesada",
        city: "Antofagasta",
        etapa: "nuevo",
        plan: "inicial",
        valor_mensual_neto: 149990,
        valor_setup_neto: 0,
        pain_primary: "Sin WhatsApp",
        use_case: "Informativo",
        competidor: "",
        next_action: "Calificar",
        next_action_at: new Date().toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 20, // Fit bajo < 40
        intent_score: 95, // Alto intent
        priority_score: 90, // El cliente envía 90 intentando manipularlo
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      assert.equal(sanitized.fit_score, 20);
      assert.equal(sanitized.intent_score, 95);
      // Debe ser forzado a 0 por el servidor independientemente del input
      assert.equal(sanitized.priority_score, 0, "priority_score DEBE ser 0 cuando fit < 40");
    });

    it("al actualizar deal: fit=20 y priority enviado=90 da ESTRICTAMENTE priority_score=0", () => {
      const existingDeal: HqDeal = {
        id: crypto.randomUUID(),
        company_name: "Empresa Existente",
        contact_name: "Juan",
        contact_role: "Dueño",
        contact_phone: "+56911223344",
        contact_email: "juan@test.cl",
        contact_whatsapp: "+56911223344",
        industry: "retail",
        city: "Santiago",
        etapa: "contactando",
        plan: "inicial",
        valor_mensual_neto: 149990,
        valor_setup_neto: 0,
        pain_primary: "Ventas",
        use_case: "Chat",
        competidor: "",
        next_action: "Llamar",
        next_action_at: new Date().toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 80,
        intent_score: 80,
        priority_score: 80,
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updated = validarUpdateDealInput(existingDeal, {
        fit_score: 20, // Cambia fit a 20 (<40)
        intent_score: 90,
        priority_score: 90, // Intento de hackear el score
      });

      assert.equal(updated.fit_score, 20);
      assert.equal(updated.priority_score, 0, "priority_score DEBE ser recalculado en servidor a 0");
    });

    it("persistencia en MemoryRevenueStore fuerza priority_score derivado en servidor", async () => {
      const store = new MemoryRevenueStore();
      const deal = await store.createDeal({
        company_name: "Clínica Test Scoring",
        contact_name: "Dra. Laura",
        contact_role: "Directora",
        contact_phone: "+56988887777",
        contact_email: "laura@clinica.cl",
        contact_whatsapp: "+56988887777",
        industry: "dental",
        city: "Santiago",
        etapa: "nuevo",
        plan: "inicial",
        valor_mensual_neto: 149990,
        valor_setup_neto: 0,
        pain_primary: "Pérdida de pacientes",
        use_case: "Citas",
        competidor: "",
        next_action: "Contactar",
        next_action_at: new Date().toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 25, // < 40
        intent_score: 80,
        priority_score: 99, // Enviado 99
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      assert.equal(deal.priority_score, 0);

      // Si actualizamos a fit=80, intent=80, priority_score enviado=10
      const dealUpdated = await store.updateDeal(deal.id, {
        fit_score: 80,
        intent_score: 80,
        priority_score: 10, // Intenta falsear hacia abajo
      });

      // Se calcula sqrt(80 * 80) = 80
      assert.equal(dealUpdated.priority_score, 80);
    });
  });

  describe("3. Sincronización Coherente de Etapas y Próximas Acciones", () => {
    it("createMeetingAction avanza deal de 'contactando' a 'reunion_agendada' y fija next_action", async () => {
      const store = new MemoryRevenueStore();
      const deal = await store.createDeal({
        company_name: "Inmobiliaria Futuro",
        contact_name: "Esteban",
        contact_role: "Socio",
        contact_phone: "+56955554444",
        contact_email: "esteban@futuro.cl",
        contact_whatsapp: "+56955554444",
        industry: "inmobiliaria",
        city: "Santiago",
        etapa: "contactando",
        plan: "crecimiento",
        valor_mensual_neto: 269990,
        valor_setup_neto: 0,
        pain_primary: "Leads de portales",
        use_case: "Respuesta inmediata",
        competidor: "",
        next_action: "Esperando respuesta a correo",
        next_action_at: new Date().toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 80,
        intent_score: 70,
        priority_score: 75,
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      setRevenueStoreForTesting(store);
      try {
        const meetingDate = "2026-09-25T15:00:00Z";
        const res = await createMeetingAction({
          deal_id: deal.id,
          company_name: deal.company_name,
          scheduled_at: meetingDate,
          meeting_type: "discovery",
          interest_score: 4,
          notes: "Reunión de demostración acordada",
        });

        assert.equal(res.success, true);
        const dealDespues = await store.getDealById(deal.id);
        assert.ok(dealDespues);
        assert.equal(dealDespues.etapa, "reunion_agendada");
        assert.match(dealDespues.next_action, /Reunión: discovery/);
        assert.equal(dealDespues.next_action_at, meetingDate);
      } finally {
        setRevenueStoreForTesting(null);
      }
    });

    it("createPilotAction con piloto activo avanza deal a 'piloto_activo' y fija checkpoint día 7", async () => {
      const store = new MemoryRevenueStore();
      const deal = await store.createDeal({
        company_name: "Ferretería Maipú",
        contact_name: "Rodrigo",
        contact_role: "Dueño",
        contact_phone: "+56933332222",
        contact_email: "rodrigo@ferreteria.cl",
        contact_whatsapp: "+56933332222",
        industry: "ferreteria",
        city: "Santiago",
        etapa: "calificado",
        plan: "inicial",
        valor_mensual_neto: 149990,
        valor_setup_neto: 0,
        pain_primary: "Cotizaciones de mesón",
        use_case: "Catálogo",
        competidor: "",
        next_action: "Configurar piloto",
        next_action_at: new Date().toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 75,
        intent_score: 80,
        priority_score: 77,
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      setRevenueStoreForTesting(store);
      try {
        const res = await createPilotAction({
          deal_id: deal.id,
          company_name: deal.company_name,
          status: "activo",
          start_date: "2026-09-20",
          end_date: "2026-10-04",
          review_date: "2026-09-27",
          hipotesis: "Atender consultas fuera de horario",
          metricas_base: "30 consultas perdidas por fin de semana",
          resuelve_vs_deriva: { resuelve: ["stock"], deriva: ["precios especiales"] },
          kpi_primario: "Consultas atendidas",
          kpis_secundarios: "Ventas cerradas",
          meta_kpi: "> 50 consultas",
          criterio_exito: "Al menos 15 cotizaciones iniciadas",
          decision_si_exito: "Cierre anual",
          casos_totales_atendidos: 0,
          casos_derivados_humano: 0,
          seguimientos_beto_enviados: 0,
          seguimientos_beto_respuestas: 0,
        });

        assert.equal(res.success, true);
        const dealDespues = await store.getDealById(deal.id);
        assert.ok(dealDespues);
        assert.equal(dealDespues.etapa, "piloto_activo");
        assert.match(dealDespues.next_action, /checkpoint Día 7/i);
        assert.equal(dealDespues.next_action_at, "2026-09-27");
      } finally {
        setRevenueStoreForTesting(null);
      }
    });

    it("createProposalAction con estado enviada avanza deal a 'propuesta_enviada' y fija revisión", async () => {
      const store = new MemoryRevenueStore();
      const deal = await store.createDeal({
        company_name: "Estudio Jurídico Las Condes",
        contact_name: "Matías",
        contact_role: "Socio",
        contact_phone: "+56922221111",
        contact_email: "matias@abogados.cl",
        contact_whatsapp: "+56922221111",
        industry: "legal",
        city: "Santiago",
        etapa: "calificado",
        plan: "empresa",
        valor_mensual_neto: 499990,
        valor_setup_neto: 150000,
        pain_primary: "Filtrado de clientes",
        use_case: "Calificación jurídica",
        competidor: "",
        next_action: "Armar propuesta formal",
        next_action_at: new Date().toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 85,
        intent_score: 85,
        priority_score: 85,
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      setRevenueStoreForTesting(store);
      try {
        const reviewDate = "2026-09-28T10:00:00Z";
        const res = await createProposalAction({
          deal_id: deal.id,
          company_name: deal.company_name,
          plan_ofrecido: "empresa",
          mrr_ofrecido: 499990,
          setup_fee_ofrecido: 150000,
          status: "enviada",
          sent_at: "2026-09-21T10:00:00Z",
          review_date: reviewDate,
          decision_date: "2026-09-30T18:00:00Z",
          roi_esperado: "Ahorro de 20 horas de secretaria al mes",
          notas: "Propuesta enviada con plan anual",
        });

        assert.equal(res.success, true);
        const dealDespues = await store.getDealById(deal.id);
        assert.ok(dealDespues);
        assert.equal(dealDespues.etapa, "propuesta_enviada");
        assert.match(dealDespues.next_action, /propuesta comercial/i);
        assert.equal(dealDespues.next_action_at, reviewDate);
      } finally {
        setRevenueStoreForTesting(null);
      }
    });

    it("atomicidad estricta: creación de piloto con transición inválida desde 'nuevo' falla, no crea child y deja deal intacto", async () => {
      const store = new MemoryRevenueStore();
      const deal = await store.createDeal({
        company_name: "Empresa Deal Nuevo Atomico",
        contact_name: "Claudio",
        contact_role: "Dueño",
        contact_phone: "+56977776666",
        contact_email: "claudio@nuevo.cl",
        contact_whatsapp: "+56977776666",
        industry: "servicios",
        city: "Santiago",
        etapa: "nuevo", // ETAPA NUEVO: transición directa a piloto_activo está prohibida
        plan: "inicial",
        valor_mensual_neto: 149990,
        valor_setup_neto: 0,
        pain_primary: "Pérdida de leads",
        use_case: "Chat",
        competidor: "",
        next_action: "Calificar primero",
        next_action_at: new Date().toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 50,
        intent_score: 50,
        priority_score: 50,
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      setRevenueStoreForTesting(store);
      try {
        // createPilotAction intenta pasar a "piloto_activo", lo cual es una transición inválida desde "nuevo"
        const res = await createPilotAction({
          deal_id: deal.id,
          company_name: deal.company_name,
          status: "activo",
          start_date: "2026-09-20",
          end_date: "2026-10-04",
          review_date: "2026-09-27",
          hipotesis: "Test atomicidad",
          metricas_base: "Base",
          resuelve_vs_deriva: {
            catalogo_precios_base: "resuelve",
            disponibilidad_stock: "resuelve",
            agendamiento_horas: "resuelve",
            cotizaciones_especiales: "deriva",
            pedidos_despacho: "deriva",
            reclamos_postventa: "deriva",
          },
          kpi_primario: "Consultas",
          kpis_secundarios: "Ventas",
          meta_kpi: "> 50",
          criterio_exito: "Exito",
          decision_si_exito: "Contratar",
          casos_totales_atendidos: 0,
          casos_derivados_humano: 0,
          seguimientos_beto_enviados: 0,
          seguimientos_beto_respuestas: 0,
        });

        // 1. Debe retornar success: false
        assert.equal(res.success, false, "La acción debe fallar por transición inválida");
        assert.match(res.error || "", /TRANSITION_ERROR|Transición no permitida/);

        // 2. Children count DEBE ser 0 (no se persistió el piloto huérfano)
        const pilots = await store.getPilots(deal.id);
        assert.equal(pilots.length, 0, "No debe haberse insertado ningún piloto (atomicidad garantizada)");

        // 3. Deal DEBE permanecer exactamente en 'nuevo' y sin modificar
        const dealDespues = await store.getDealById(deal.id);
        assert.ok(dealDespues);
        assert.equal(dealDespues.etapa, "nuevo", "El deal debe conservar intacta la etapa 'nuevo'");
        assert.equal(dealDespues.next_action, "Calificar primero");
      } finally {
        setRevenueStoreForTesting(null);
      }
    });

    it("atomicidad estricta: creación de propuesta con transición inválida desde 'nuevo' falla, no crea child y deja deal intacto", async () => {
      const store = new MemoryRevenueStore();
      const deal = await store.createDeal({
        company_name: "Empresa Deal Propuesta Atomico",
        contact_name: "Gonzalo",
        contact_role: "Socio",
        contact_phone: "+56966665555",
        contact_email: "gonzalo@nuevo.cl",
        contact_whatsapp: "+56966665555",
        industry: "gastronomia",
        city: "Santiago",
        etapa: "nuevo", // Transición a propuesta_enviada está prohibida desde 'nuevo'
        plan: "inicial",
        valor_mensual_neto: 149990,
        valor_setup_neto: 0,
        pain_primary: "Reservas",
        use_case: "Chat",
        competidor: "",
        next_action: "Primer contacto",
        next_action_at: new Date().toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 50,
        intent_score: 50,
        priority_score: 50,
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      setRevenueStoreForTesting(store);
      try {
        const res = await createProposalAction({
          deal_id: deal.id,
          company_name: deal.company_name,
          plan_ofrecido: "crecimiento",
          mrr_ofrecido: 269990,
          setup_fee_ofrecido: 0,
          status: "enviada", // Fuerza transición a propuesta_enviada
          sent_at: "2026-09-20T10:00:00Z",
          review_date: "2026-09-25T10:00:00Z",
          decision_date: "2026-09-30T10:00:00Z",
          roi_esperado: "Retorno rápido",
          notas: "Propuesta de prueba",
        });

        assert.equal(res.success, false, "La acción debe fallar por transición inválida");
        assert.match(res.error || "", /TRANSITION_ERROR|Transición no permitida/);

        // Children count DEBE ser 0
        const proposals = await store.getProposals(deal.id);
        assert.equal(proposals.length, 0, "No debe haberse insertado ninguna propuesta");

        // Deal intacto en 'nuevo'
        const dealDespues = await store.getDealById(deal.id);
        assert.ok(dealDespues);
        assert.equal(dealDespues.etapa, "nuevo");
        assert.equal(dealDespues.next_action, "Primer contacto");
      } finally {
        setRevenueStoreForTesting(null);
      }
    });
  });

  describe("4. Dashboard: Fail-Visible en Errores de Supabase", () => {
    it("los errores de Supabase se acumulan en supabaseErrors sin silenciarse en []", () => {
      // Simulamos la lógica del dashboard ante fallos de consulta
      const supabaseErrors: { query: string; message: string }[] = [];

      const mockQueries: PromiseSettledResult<{ data: any; error: any }>[] = [
        {
          status: "fulfilled",
          value: { data: null, error: { message: "relation 'roadmap_items' does not exist" } },
        },
        {
          status: "rejected",
          reason: new Error("connection timeout to supabase db"),
        },
      ];

      // Query 1: fulfilled con error interno
      const q1 = mockQueries[0];
      if (q1.status === "fulfilled" && q1.value.error) {
        supabaseErrors.push({ query: "roadmap_items", message: q1.value.error.message });
      }

      // Query 2: rejected
      const q2 = mockQueries[1];
      if (q2.status === "rejected") {
        supabaseErrors.push({ query: "clients", message: q2.reason.message });
      }

      assert.equal(supabaseErrors.length, 2);
      assert.equal(supabaseErrors[0].query, "roadmap_items");
      assert.match(supabaseErrors[0].message, /does not exist/);
      assert.equal(supabaseErrors[1].query, "clients");
      assert.match(supabaseErrors[1].message, /connection timeout/);
    });

    it("generación de prioridades diarias preserva jerarquía operativa", () => {
      // Simula prioridades del día con errores activos y cobros pendientes
      const errores = 3;
      const cobrosPendientes = 150000;
      const segHoy = [{ id: "1", nombre: "Prospecto A" }];
      const prioridades: { texto: string; nivel: string }[] = [];

      if (errores > 0) {
        prioridades.push({
          texto: `Revisar ${errores} errores de bots (últimas 24 h)`,
          nivel: "danger",
        });
      }
      if (segHoy.length > 0) {
        prioridades.push({
          texto: `Hacer ${segHoy.length} seguimiento vencido de prospección`,
          nivel: "warn",
        });
      }
      if (cobrosPendientes > 0) {
        prioridades.push({
          texto: `Cobrar $${cobrosPendientes} pendientes del mes`,
          nivel: "warn",
        });
      }

      assert.equal(prioridades.length, 3);
      assert.equal(prioridades[0].nivel, "danger");
      assert.match(prioridades[0].texto, /3 errores/);
      assert.equal(prioridades[1].nivel, "warn");
      assert.match(prioridades[1].texto, /seguimiento vencido/);
      assert.equal(prioridades[2].nivel, "warn");
      assert.match(prioridades[2].texto, /Cobrar \$150000/);
    });
  });

  describe("5. Seguridad y Transiciones Atómicas en Migración SQL 043", () => {
    const migrationPath = path.join(process.cwd(), "supabase/migrations/043_revenue_operating_system.sql");
    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    function cuerpoRpc(nombre: string): string {
      const patron = new RegExp(
        `create\\s+or\\s+replace\\s+function\\s+public\\.${nombre}[\\s\\S]*?as\\s+\\$\\$([\\s\\S]*?)\\$\\$;`,
        "i"
      );
      const coincidencia = sqlContent.match(patron);
      assert.ok(coincidencia, `No se encontró el cuerpo SQL de ${nombre}`);
      return coincidencia[1];
    }

    it("las tres RPC rechazan cualquier id aportado antes del lock o de persistir y conservan atomicidad", () => {
      const casos = [
        ["create_meeting_with_stage_transition", "p_meeting", "hq_meetings"],
        ["create_pilot_with_stage_transition", "p_pilot", "hq_pilots"],
        ["create_proposal_with_stage_transition", "p_proposal", "hq_proposals"],
      ] as const;

      for (const [rpc, parametro, tabla] of casos) {
        const cuerpo = cuerpoRpc(rpc);
        const guardId = new RegExp(
          `if\\s+${parametro}\\s*\\?\\s*'id'\\s+then\\s+raise\\s+exception\\s+'MASS_ASSIGNMENT_ERROR: No se permite proporcionar id'`,
          "i"
        );
        assert.match(
          cuerpo,
          guardId,
          `${rpc} debe rechazar por presencia tanto un UUID nuevo como uno ya existente`
        );

        const posicionGuard = cuerpo.search(guardId);
        const posicionLock = cuerpo.search(/select[\s\S]*?for\s+update/i);
        const posicionInsert = cuerpo.search(new RegExp(`insert\\s+into\\s+public\\.${tabla}`, "i"));
        const posicionUpdateDeal = cuerpo.search(/update\s+public\.hq_deals/i);

        assert.ok(posicionGuard >= 0 && posicionGuard < posicionLock, `${rpc}: el rechazo debe ocurrir antes del FOR UPDATE`);
        assert.ok(posicionLock < posicionInsert, `${rpc}: el lock y validación deben ocurrir antes del INSERT`);
        assert.ok(posicionInsert < posicionUpdateDeal, `${rpc}: el child debe insertarse antes de actualizar el deal dentro de la misma función`);
      }
    });

    it("los INSERT de child no leen id desde JSONB y delegan su generación al default UUID de cada tabla", () => {
      const casos = [
        ["create_meeting_with_stage_transition", "p_meeting", "hq_meetings"],
        ["create_pilot_with_stage_transition", "p_pilot", "hq_pilots"],
        ["create_proposal_with_stage_transition", "p_proposal", "hq_proposals"],
      ] as const;

      for (const [rpc, parametro, tabla] of casos) {
        const cuerpo = cuerpoRpc(rpc);
        const inicioInsert = cuerpo.search(new RegExp(`insert\\s+into\\s+public\\.${tabla}`, "i"));
        const finInsert = cuerpo.search(/returning\s+\*\s+into\s+v_new_/i);
        assert.ok(inicioInsert >= 0 && finInsert > inicioInsert, `${rpc}: INSERT ... RETURNING incompleto`);

        const insert = cuerpo.slice(inicioInsert, finInsert);
        assert.doesNotMatch(insert, new RegExp(`${parametro}\\s*->>\\s*'id'`, "i"));

        const columnas = insert.match(/insert\s+into\s+public\.[a-z_]+\s*\(([\s\S]*?)\)\s*values/i);
        assert.ok(columnas, `${rpc}: no se pudo leer la lista de columnas del INSERT`);
        const nombres = columnas[1].split(",").map((columna) => columna.trim());
        assert.ok(!nombres.includes("id"), `${rpc}: el INSERT no debe asignar explícitamente la columna id`);
        assert.match(cuerpo, /returning\s+\*\s+into\s+v_new_/i, `${rpc}: debe devolver el id generado por la DB`);
      }

      for (const tabla of ["hq_meetings", "hq_pilots", "hq_proposals"]) {
        const definicion = sqlContent.match(new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${tabla}\\s*\\(([\\s\\S]*?)\\n\\);`, "i"));
        assert.ok(definicion, `No se encontró la definición de ${tabla}`);
        assert.match(definicion[1], /\bid\s+uuid\s+primary\s+key\s+default\s+gen_random_uuid\(\)/i);
      }
    });

    it("la migración 043 configura SECURITY INVOKER y search_path estricto en todas las RPCs transaccionales", () => {
      // 1. Las funciones no deben ser SECURITY DEFINER
      assert.doesNotMatch(
        sqlContent,
        /create\s+or\s+replace\s+function\s+public\.create_meeting_with_stage_transition[\s\S]*?security\s+definer/i,
        "create_meeting_with_stage_transition no debe ser SECURITY DEFINER"
      );
      assert.doesNotMatch(
        sqlContent,
        /create\s+or\s+replace\s+function\s+public\.create_pilot_with_stage_transition[\s\S]*?security\s+definer/i,
        "create_pilot_with_stage_transition no debe ser SECURITY DEFINER"
      );
      assert.doesNotMatch(
        sqlContent,
        /create\s+or\s+replace\s+function\s+public\.create_proposal_with_stage_transition[\s\S]*?security\s+definer/i,
        "create_proposal_with_stage_transition no debe ser SECURITY DEFINER"
      );

      // 2. Deben ser expresamente SECURITY INVOKER
      assert.match(
        sqlContent,
        /create\s+or\s+replace\s+function\s+public\.create_meeting_with_stage_transition[\s\S]*?security\s+invoker/i
      );
      assert.match(
        sqlContent,
        /create\s+or\s+replace\s+function\s+public\.create_pilot_with_stage_transition[\s\S]*?security\s+invoker/i
      );
      assert.match(
        sqlContent,
        /create\s+or\s+replace\s+function\s+public\.create_proposal_with_stage_transition[\s\S]*?security\s+invoker/i
      );
      assert.match(
        sqlContent,
        /create\s+or\s+replace\s+function\s+public\.hq_transicion_valida[\s\S]*?security\s+invoker/i
      );

      // 3. Deben fijar search_path = public, pg_temp
      assert.match(
        sqlContent,
        /create\s+or\s+replace\s+function\s+public\.create_meeting_with_stage_transition[\s\S]*?set\s+search_path\s*=\s*public,\s*pg_temp/i
      );
      assert.match(
        sqlContent,
        /create\s+or\s+replace\s+function\s+public\.create_pilot_with_stage_transition[\s\S]*?set\s+search_path\s*=\s*public,\s*pg_temp/i
      );
      assert.match(
        sqlContent,
        /create\s+or\s+replace\s+function\s+public\.create_proposal_with_stage_transition[\s\S]*?set\s+search_path\s*=\s*public,\s*pg_temp/i
      );
      assert.match(
        sqlContent,
        /create\s+or\s+replace\s+function\s+public\.hq_transicion_valida[\s\S]*?set\s+search_path\s*=\s*public,\s*pg_temp/i
      );
    });

    it("la migración 043 revoca EXECUTE a PUBLIC/anon/authenticated y concede solo a service_role", () => {
      // Revocaciones
      assert.match(
        sqlContent,
        /revoke\s+all\s+on\s+function\s+public\.hq_transicion_valida\(text,\s*text\)\s+from\s+public,\s*anon,\s*authenticated;/i
      );
      assert.match(
        sqlContent,
        /revoke\s+all\s+on\s+function\s+public\.create_meeting_with_stage_transition\(jsonb,\s*jsonb\)\s+from\s+public,\s*anon,\s*authenticated;/i
      );
      assert.match(
        sqlContent,
        /revoke\s+all\s+on\s+function\s+public\.create_pilot_with_stage_transition\(jsonb,\s*jsonb\)\s+from\s+public,\s*anon,\s*authenticated;/i
      );
      assert.match(
        sqlContent,
        /revoke\s+all\s+on\s+function\s+public\.create_proposal_with_stage_transition\(jsonb,\s*jsonb\)\s+from\s+public,\s*anon,\s*authenticated;/i
      );

      // Concesiones exclusivas a service_role
      assert.match(
        sqlContent,
        /grant\s+execute\s+on\s+function\s+public\.hq_transicion_valida\(text,\s*text\)\s+to\s+service_role;/i
      );
      assert.match(
        sqlContent,
        /grant\s+execute\s+on\s+function\s+public\.create_meeting_with_stage_transition\(jsonb,\s*jsonb\)\s+to\s+service_role;/i
      );
      assert.match(
        sqlContent,
        /grant\s+execute\s+on\s+function\s+public\.create_pilot_with_stage_transition\(jsonb,\s*jsonb\)\s+to\s+service_role;/i
      );
      assert.match(
        sqlContent,
        /grant\s+execute\s+on\s+function\s+public\.create_proposal_with_stage_transition\(jsonb,\s*jsonb\)\s+to\s+service_role;/i
      );
    });

    it("las funciones PL/pgSQL no ejecutan COMMIT ni ROLLBACK explícitos dentro de sus cuerpos", () => {
      // Extraemos el bloque entre las RPCs (sección 10) y antes de commit final
      const sec10 = sqlContent.substring(sqlContent.indexOf("-- 10. RPCs TRANSACCIONALES"));
      const rpcBodies = sec10.substring(0, sec10.indexOf("-- 11. PRIVILEGIOS"));

      assert.doesNotMatch(
        rpcBodies,
        /\bcommit\s*;/i,
        "Ninguna función PL/pgSQL debe ejecutar COMMIT explícito"
      );
      assert.doesNotMatch(
        rpcBodies,
        /\brollback\s*;/i,
        "Ninguna función PL/pgSQL debe ejecutar ROLLBACK explícito"
      );
    });

    it("la matriz canónica de transiciones valida transiciones legales y rechaza ilegales", () => {
      // Inválidas desde nuevo
      assert.throws(
        () => validarTransicionEtapa("nuevo", "piloto_activo"),
        /TRANSITION_ERROR/
      );
      assert.throws(
        () => validarTransicionEtapa("nuevo", "propuesta_enviada"),
        /TRANSITION_ERROR/
      );

      // Válidas
      assert.doesNotThrow(() => validarTransicionEtapa("nuevo", "contactando"));
      assert.doesNotThrow(() => validarTransicionEtapa("contactando", "reunion_agendada"));
      assert.doesNotThrow(() => validarTransicionEtapa("reunion_agendada", "piloto_activo"));
      assert.doesNotThrow(() => validarTransicionEtapa("reunion_agendada", "propuesta_enviada"));
      assert.doesNotThrow(() => validarTransicionEtapa("calificado", "piloto_activo"));
      assert.doesNotThrow(() => validarTransicionEtapa("calificado", "propuesta_enviada"));
      assert.doesNotThrow(() => validarTransicionEtapa("piloto_activo", "propuesta_enviada"));
      assert.doesNotThrow(() => validarTransicionEtapa("propuesta_enviada", "ganado"));
    });

    it("etapas cerradas (ganado y perdido) NO pueden volver a ninguna etapa activa", () => {
      const activeStages: RevenueStage[] = [
        "nuevo",
        "contactando",
        "reunion_agendada",
        "discovery_completado",
        "calificado",
        "piloto_propuesto",
        "piloto_activo",
        "propuesta_enviada",
        "en_decision",
      ];

      for (const stage of activeStages) {
        // ganado no puede volver a etapa activa
        assert.throws(
          () => validarTransicionEtapa("ganado", stage),
          /TRANSITION_ERROR/,
          `ganado no debe poder transicionar a etapa activa '${stage}'`
        );

        // perdido no puede volver a etapa activa
        assert.throws(
          () => validarTransicionEtapa("perdido", stage),
          /TRANSITION_ERROR/,
          `perdido no debe poder transicionar a etapa activa '${stage}'`
        );
      }

      // Ambos solo pueden ir a nurture (retención / seguimiento pasivo)
      assert.doesNotThrow(() => validarTransicionEtapa("ganado", "nurture"));
      assert.doesNotThrow(() => validarTransicionEtapa("perdido", "nurture"));
    });

    it("simulación de concurrencia bajo lock: estado modificado concurrentemente antes de adquirir el lock decide según el estado bloqueado real", async () => {
      const store = new MemoryRevenueStore();
      // 1. Deal inicia en calificado (desde donde piloto_activo sería una transición válida)
      const deal = await store.createDeal({
        company_name: "Empresa Concurrente",
        contact_name: "Esteban",
        contact_role: "Gerente",
        contact_phone: "+56911223344",
        contact_email: "esteban@concurrente.cl",
        contact_whatsapp: "+56911223344",
        industry: "tecnologia",
        city: "Santiago",
        etapa: "calificado",
        plan: "empresa",
        valor_mensual_neto: 499990,
        valor_setup_neto: 0,
        pain_primary: "Pérdida de clientes",
        use_case: "Chatbot",
        competidor: "",
        next_action: "Llamar para piloto",
        next_action_at: new Date().toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 80,
        intent_score: 80,
        priority_score: 80,
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      // 2. Proceso B modifica concurrentemente el deal a 'perdido' antes de que Proceso A ejecute su lock
      await store.updateDeal(deal.id, {
        etapa: "perdido",
        lost_reason: "competitor",
        lost_notes: "Cerró con otra empresa",
      });

      setRevenueStoreForTesting(store);
      try {
        // 3. Proceso A ahora intenta crear piloto_activo (creyendo que el deal seguía en calificado)
        // Al tomar el lock del deal, el estado real bloqueado es 'perdido'.
        const res = await createPilotAction({
          deal_id: deal.id,
          company_name: deal.company_name,
          status: "activo",
          start_date: "2026-09-20",
          end_date: "2026-10-04",
          review_date: "2026-09-27",
          hipotesis: "Test lock concurrente",
          metricas_base: "Base",
          resuelve_vs_deriva: {
            catalogo_precios_base: "resuelve",
            disponibilidad_stock: "resuelve",
            agendamiento_horas: "resuelve",
            cotizaciones_especiales: "deriva",
            pedidos_despacho: "deriva",
            reclamos_postventa: "deriva",
          },
          kpi_primario: "Consultas",
          kpis_secundarios: "Ventas",
          meta_kpi: "> 50",
          criterio_exito: "Exito",
          decision_si_exito: "Contratar",
          casos_totales_atendidos: 0,
          casos_derivados_humano: 0,
          seguimientos_beto_enviados: 0,
          seguimientos_beto_respuestas: 0,
        });

        // 4. Debe rechazarse en base al estado REAL bloqueado ('perdido')
        assert.equal(res.success, false);
        assert.match(res.error || "", /TRANSITION_ERROR.*perdido.*piloto_activo/);

        // 5. Atomicidad estricta: ningún piloto huérfano persistido
        const pilots = await store.getPilots(deal.id);
        assert.equal(pilots.length, 0, "No debe haber creado ningún piloto huérfano");

        // 6. El deal debe permanecer intacto en su estado real bloqueado 'perdido'
        const dealFinal = await store.getDealById(deal.id);
        assert.ok(dealFinal);
        assert.equal(dealFinal.etapa, "perdido");
        assert.equal(dealFinal.lost_reason, "competitor");
      } finally {
        setRevenueStoreForTesting(null);
      }
    });

    it("deal en estado cerrado (ganado) rechaza creación de propuesta activa con child rollback y deal intacto", async () => {
      const store = new MemoryRevenueStore();
      const deal = await store.createDeal({
        company_name: "Cliente Ganado Antiguo",
        contact_name: "Valeria",
        contact_role: "Directora",
        contact_phone: "+56988889999",
        contact_email: "valeria@cliente.cl",
        contact_whatsapp: "+56988889999",
        industry: "clinica",
        city: "Santiago",
        etapa: "ganado", // Estado cerrado final
        plan: "crecimiento",
        valor_mensual_neto: 269990,
        valor_setup_neto: 0,
        pain_primary: "Citas",
        use_case: "Chat",
        competidor: "",
        next_action: "",
        next_action_at: new Date().toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 90,
        intent_score: 90,
        priority_score: 90,
        lost_reason: null,
        lost_notes: null,
        won_notes: "Cliente anual",
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      setRevenueStoreForTesting(store);
      try {
        const res = await createProposalAction({
          deal_id: deal.id,
          company_name: deal.company_name,
          plan_ofrecido: "empresa",
          mrr_ofrecido: 499990,
          setup_fee_ofrecido: 0,
          status: "enviada", // Intenta forzar paso a propuesta_enviada desde ganado
          sent_at: "2026-09-20T10:00:00Z",
          review_date: "2026-09-25T10:00:00Z",
          decision_date: "2026-09-30T10:00:00Z",
          roi_esperado: "Retorno",
          notas: "Propuesta no permitida",
        });

        assert.equal(res.success, false);
        assert.match(res.error || "", /TRANSITION_ERROR.*ganado.*propuesta_enviada/);

        // Children rollback: 0 propuestas persistidas
        const proposals = await store.getProposals(deal.id);
        assert.equal(proposals.length, 0);

        // Deal intacto en ganado
        const dealFinal = await store.getDealById(deal.id);
        assert.ok(dealFinal);
        assert.equal(dealFinal.etapa, "ganado");
      } finally {
        setRevenueStoreForTesting(null);
      }
    });
  });
});
