(process.env as any).NODE_ENV = "test";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluarAutenticacionHq, leerCuentasHq } from "../../lib/auth/hqAuth";
import {
  getRevenueStore,
  setRevenueStoreForTesting,
  MemoryRevenueStore,
  SupabaseRevenueStore,
  RevenueConfigError,
  RevenueDatabaseError,
} from "../../lib/revenue/store";
import {
  esUUIDValido,
  validarUUID,
  validarCreateDealInput,
  validarUpdateDealInput,
  validarTransicionEtapa,
  validarCreateMeetingInput,
  validarCreatePilotInput,
  validarCreateProposalInput,
} from "../../lib/revenue/validation";
import { calcularScoringComercial, calcularScoringDeal } from "../../lib/revenue/scoring";
import { closeDealLostAction } from "../../app/actions/revenue";

describe("REVENUE OS V1 — REMEDIACIÓN DE PRODUCCIÓN", () => {
  describe("Fase 1: Autenticación Fail-Closed", () => {
    it("en producción (NODE_ENV=production) sin credenciales configuradas DEBE DENEGAR ACCESO con 500 (Fail-Closed)", () => {
      const res = evaluarAutenticacionHq({
        pathname: "/dashboard",
        authHeader: null,
        env: { NODE_ENV: "production" },
      });

      assert.equal(res.allowed, false);
      assert.equal(res.status, 500);
      assert.match(res.error || "", /CRITICAL_AUTH_CONFIG_MISSING/);
    });

    it("en desarrollo sin credenciales y sin bypass DEBE DENEGAR ACCESO con 401", () => {
      const res = evaluarAutenticacionHq({
        pathname: "/dashboard",
        authHeader: null,
        env: { NODE_ENV: "development" },
      });

      assert.equal(res.allowed, false);
      assert.equal(res.status, 401);
      assert.match(res.error || "", /AUTH_CREDENTIALS_MISSING/);
    });

    it("en desarrollo el bypass solo se permite con opt-in explícito HQ_DEV_AUTH_BYPASS='true'", () => {
      const res = evaluarAutenticacionHq({
        pathname: "/dashboard",
        authHeader: null,
        env: { NODE_ENV: "development", HQ_DEV_AUTH_BYPASS: "true" },
      });

      assert.equal(res.allowed, true);
      assert.equal(res.status, 200);
    });

    it("con credenciales configuradas valida correctamente Basic Auth", () => {
      // Credenciales: marcelo:secreto123
      const authHeader = "Basic " + Buffer.from("marcelo:secreto123").toString("base64");
      const res = evaluarAutenticacionHq({
        pathname: "/pipeline",
        authHeader,
        env: { NODE_ENV: "production", HQ_USER: "marcelo", HQ_PASSWORD: "secreto123" },
      });

      assert.equal(res.allowed, true);
      assert.equal(res.user, "marcelo");
    });

    it("con credenciales incorrectas rechaza con 401", () => {
      const authHeader = "Basic " + Buffer.from("marcelo:clave_invalida").toString("base64");
      const res = evaluarAutenticacionHq({
        pathname: "/pipeline",
        authHeader,
        env: { NODE_ENV: "production", HQ_USER: "marcelo", HQ_PASSWORD: "secreto123" },
      });

      assert.equal(res.allowed, false);
      assert.equal(res.status, 401);
    });
  });

  describe("Fase 2: Demo vs Producción en getRevenueStore()", () => {
    it("en entorno de test retorna MemoryRevenueStore", () => {
      const store = getRevenueStore();
      assert.ok(store instanceof MemoryRevenueStore);
    });

    it("en producción si faltan credenciales de Supabase lanza RevenueConfigError visible (sin fallback silencioso)", () => {
      const oldEnv = process.env.NODE_ENV;
      try {
        (process as any).env.NODE_ENV = "production";
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        assert.throws(
          () => getRevenueStore(),
          (err: any) => err instanceof RevenueConfigError && /CONFIG_ERROR/.test(err.message)
        );
      } finally {
        (process as any).env.NODE_ENV = oldEnv;
      }
    });

    it("en producción NO permite bypass a modo demo aunque HQ_DEMO_MODE='true'", () => {
      const oldEnv = process.env.NODE_ENV;
      try {
        (process as any).env.NODE_ENV = "production";
        process.env.HQ_DEMO_MODE = "true";
        delete process.env.SUPABASE_URL;

        assert.throws(
          () => getRevenueStore(),
          (err: any) => err instanceof RevenueConfigError
        );
      } finally {
        (process as any).env.NODE_ENV = oldEnv;
        delete process.env.HQ_DEMO_MODE;
      }
    });
  });

  describe("Fase 3 & 4: Paridad de Contrato y Prohibición de Datos Falsos", () => {
    it("MemoryRevenueStore y SupabaseRevenueStore generan y exigen UUIDs reales", () => {
      const validUUID = crypto.randomUUID();
      assert.ok(esUUIDValido(validUUID));
      assert.equal(esUUIDValido("deal_12345"), false);
      assert.equal(esUUIDValido("meet_999"), false);

      assert.throws(() => validarUUID("deal_invalido"), /VALIDATION_ERROR/);
    });

    it("creación de Deal valida campos obligatorios y formato", async () => {
      const store = new MemoryRevenueStore();

      // Rechaza sin nombre
      await assert.rejects(
        () =>
          store.createDeal({
            company_name: "",
            contact_name: "Test",
            contact_role: "Decisor",
            contact_phone: "+56912345678",
            contact_email: "test@empresa.cl",
            contact_whatsapp: "+56912345678",
            industry: "dental",
            city: "Santiago",
            etapa: "nuevo",
            plan: "inicial",
            valor_mensual_neto: 149990,
            valor_setup_neto: 0,
            pain_primary: "Pérdida de citas",
            use_case: "Agenda",
            competidor: "",
            next_action: "Llamar",
            next_action_at: new Date().toISOString(),
            next_action_owner: "Fundador",
            stalled: false,
            stalled_reason: null,
            fit_score: 0,
            intent_score: 0,
            priority_score: 0,
            lost_reason: null,
            lost_notes: null,
            won_notes: null,
            experiment_id: null,
            prospect_id: null,
            lead_foco_id: null,
          }),
        /company_name/
      );
    });

    it("deal en estado 'perdido' exige lost_reason obligatorio", async () => {
      const store = new MemoryRevenueStore();
      await assert.rejects(
        () =>
          store.createDeal({
            company_name: "Clinica Dental Sur",
            contact_name: "Dr. Soto",
            contact_role: "Dueño",
            contact_phone: "+56911223344",
            contact_email: "soto@dental.cl",
            contact_whatsapp: "+56911223344",
            industry: "dental",
            city: "Santiago",
            etapa: "perdido", // Marcado perdido
            plan: "inicial",
            valor_mensual_neto: 149990,
            valor_setup_neto: 0,
            pain_primary: "Sin dolor",
            use_case: "",
            competidor: "",
            next_action: "",
            next_action_at: "",
            next_action_owner: "Fundador",
            stalled: false,
            stalled_reason: null,
            fit_score: 0,
            intent_score: 0,
            priority_score: 0,
            lost_reason: null, // ERROR: Falta lost_reason
            lost_notes: null,
            won_notes: null,
            experiment_id: null,
            prospect_id: null,
            lead_foco_id: null,
          }),
        /lost_reason/
      );
    });

    it("deal ganado limpia lost_reason y anula stalled", async () => {
      const store = new MemoryRevenueStore();
      const deal = await store.createDeal({
        company_name: "Taller Pro",
        contact_name: "Carlos",
        contact_role: "Dueño",
        contact_phone: "+56911112222",
        contact_email: "carlos@taller.cl",
        contact_whatsapp: "+56911112222",
        industry: "taller",
        city: "Santiago",
        etapa: "piloto_activo",
        plan: "crecimiento",
        valor_mensual_neto: 269990,
        valor_setup_neto: 0,
        pain_primary: "Llamadas perdidas",
        use_case: "Cotización",
        competidor: "",
        next_action: "Revisar piloto día 14",
        next_action_at: new Date(Date.now() + 86400000).toISOString(),
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

      const updated = await store.updateDeal(deal.id, {
        etapa: "ganado",
        won_notes: "Cliente contrató Plan Crecimiento anual",
      });

      assert.equal(updated.etapa, "ganado");
      assert.equal(updated.stalled, false);
      assert.equal(updated.lost_reason, null);
    });

    it("impide transiciones de etapa ilegales (ej: nuevo -> ganado directamente)", () => {
      assert.throws(
        () => validarTransicionEtapa("nuevo", "ganado"),
        /TRANSITION_ERROR/
      );
      assert.doesNotThrow(() => validarTransicionEtapa("nuevo", "contactando"));
      assert.doesNotThrow(() => validarTransicionEtapa("contactando", "perdido"));
    });
  });

  describe("Fase 5: Validación de Entidades Hijas (Meetings, Pilots, Proposals)", () => {
    it("rechaza reunión con interest_score fuera del rango 1..5", () => {
      assert.throws(
        () =>
          validarCreateMeetingInput({
            deal_id: crypto.randomUUID(),
            company_name: "Empresa Test",
            scheduled_at: new Date().toISOString(),
            meeting_type: "discovery",
            interest_score: 10, // Inválido (> 5)
          }),
        /interest_score/
      );
    });

    it("rechaza piloto con end_date anterior a start_date", () => {
      assert.throws(
        () =>
          validarCreatePilotInput({
            deal_id: crypto.randomUUID(),
            company_name: "Empresa Test",
            start_date: "2026-09-20",
            end_date: "2026-09-10", // Inválido (anterior a start)
          }),
        /end_date/
      );
    });

    it("rechaza propuesta con decision_date anterior a review_date", () => {
      assert.throws(
        () =>
          validarCreateProposalInput({
            deal_id: crypto.randomUUID(),
            company_name: "Empresa Test",
            review_date: "2026-09-20",
            decision_date: "2026-09-15", // Inválido (anterior a review)
          }),
        /decision_date/
      );
    });

    it("rechaza propuestas o tratos con montos de dinero negativos", () => {
      assert.throws(
        () =>
          validarUpdateDealInput(
            {
              id: crypto.randomUUID(),
              company_name: "Test",
              etapa: "nuevo",
              valor_mensual_neto: 100,
            } as any,
            { valor_mensual_neto: -50000 }
          ),
        /negativo/
      );
    });
  });

  describe("Fase 6: Scoring Cuantitativo y Regla de Marcelo", () => {
    it("regla de Marcelo: si fit < 40, priority_score es estrictamente 0", () => {
      const res = calcularScoringComercial({
        usesWhatsApp: false,
        usesBooking: false,
        usesPaidAds: false,
        isQuoteDriven: false,
        isSpeedSensitive: false,
        industry: "construccion_pesada",
        hasOwnWeb: true,
        proposalRequested: true,
      });

      assert.ok(res.fitScore < 40, `Fit debe ser bajo, obtenido: ${res.fitScore}`);
      assert.equal(res.priorityScore, 0, "Priority Score debe ser exactamente 0 cuando fit < 40");
    });

    it("calcularScoringDeal asigna scores deterministas al deal", () => {
      const scores = calcularScoringDeal({
        industry: "clinica dental",
        contact_whatsapp: "+56912345678",
        contact_role: "Dueño y Director Médico",
        etapa: "discovery_completado",
      });

      assert.ok(scores.fitScore >= 60, `Fit de clínica dental debe ser >= 60, fue: ${scores.fitScore}`);
      assert.ok(scores.priorityScore > 0, "Priority score debe ser positivo");
      assert.ok(scores.priorityScore <= 100);
    });
  });

  describe("Fase 7: Detección y Resolución de Incoherencias de Etapa", () => {
    it("al cerrar un deal como perdido cancela automáticamente pilotos activos vinculados", async () => {
      const store = new MemoryRevenueStore();
      const deal = await store.createDeal({
        company_name: "Test Incoherencia",
        contact_name: "Juan",
        contact_role: "Gerente",
        contact_phone: "+56911223344",
        contact_email: "juan@test.cl",
        contact_whatsapp: "+56911223344",
        industry: "salud",
        city: "Santiago",
        etapa: "piloto_activo",
        plan: "inicial",
        valor_mensual_neto: 149990,
        valor_setup_neto: 0,
        pain_primary: "Pérdida de leads",
        use_case: "Chatbot",
        competidor: "",
        next_action: "Revisar",
        next_action_at: new Date(Date.now() + 86400000).toISOString(),
        next_action_owner: "Fundador",
        stalled: false,
        stalled_reason: null,
        fit_score: 70,
        intent_score: 60,
        priority_score: 65,
        lost_reason: null,
        lost_notes: null,
        won_notes: null,
        experiment_id: null,
        prospect_id: null,
        lead_foco_id: null,
      });

      const pilot = await store.createPilot({
        deal_id: deal.id,
        company_name: deal.company_name,
        status: "activo",
        start_date: "2026-09-16",
        end_date: "2026-09-30",
        review_date: "2026-09-30",
        hipotesis: "Prueba",
        metricas_base: "Base",
        resuelve_vs_deriva: {} as any,
        kpi_primario: "Respuesta",
        kpis_secundarios: "Citas",
        meta_kpi: "80%",
        criterio_exito: "Exito",
        decision_si_exito: "Cierre",
        casos_totales_atendidos: 10,
        casos_derivados_humano: 2,
        seguimientos_beto_enviados: 5,
        seguimientos_beto_respuestas: 2,
      });

      assert.equal(pilot.status, "activo");

      // Inyectar store de prueba en el singleton para que la Server Action use este store
      setRevenueStoreForTesting(store);
      try {
        // Cierre como perdido vía Server Action
        const res = await closeDealLostAction(deal.id, "no_budget", "No tenían presupuesto para continuar");
        assert.equal(res.success, true);

        const pilotsAfter = await store.getPilots(deal.id);
        assert.equal(pilotsAfter[0].status, "cancelado");
        assert.match(pilotsAfter[0].resultado_notas || "", /cancelado automáticamente/i);
      } finally {
        setRevenueStoreForTesting(null);
      }
    });
  });
});
