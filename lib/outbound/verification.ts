/**
 * ADAPTADOR DE VERIFICACIÓN DE EMAIL — Outbound V1
 *
 * Principio: Desacoplado del proveedor. Soporta validación sintáctica,
 * detección de dominios desechables (disposable), consulta de registros MX en DNS,
 * y permite conectar proveedores externos (Hunter, NeverBounce, ZeroBounce, etc.).
 *
 * Estados:
 * - valid: Sintaxis OK + MX existe + no es desechable.
 * - invalid: Sintaxis rota O dominio sin MX O rechazado por proveedor.
 * - disposable: Dominio temporal o de un solo uso (bloqueado por defecto).
 * - risky / catch_all: Dominio acepta todo o alta probabilidad de rebote.
 * - unknown: No se pudo verificar o verificación no ejecutada.
 * - verification_failed: Error de red o API caída al verificar.
 */

import dns from "node:dns/promises";
import type { MxRecord } from "node:dns";
import { normalizarDominio, normalizarEmail } from "./normalization";
import { type VerificacionEmailEstado } from "./types";

export interface ResultadoVerificacion {
  estado: VerificacionEmailEstado;
  proveedor: string;
  fecha: string;
  detalle: string;
  es_enviable: boolean; // Helper según política
}

export interface EmailVerifier {
  verificar(email: string): Promise<ResultadoVerificacion>;
}

/** Dominios temporales / desechables conocidos */
const DOMINIOS_DISPOSABLE = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getairmail.com",
  "dispostable.com",
  "sharklasers.com",
  "fakemailgenerator.com",
  "burnermail.io",
]);

/** Verificador Defensivo Local (Sintaxis + Disposable + DNS MX) */
export class LocalEmailVerifier implements EmailVerifier {
  private nombreProveedor = "local_dns_mx";

  async verificar(emailRaw: string): Promise<ResultadoVerificacion> {
    const ahora = new Date().toISOString();
    const email = normalizarEmail(emailRaw);

    if (!email) {
      return {
        estado: "invalid",
        proveedor: this.nombreProveedor,
        fecha: ahora,
        detalle: "Formato sintáctico de email inválido",
        es_enviable: false,
      };
    }

    const dominio = normalizarDominio(email);
    if (!dominio) {
      return {
        estado: "invalid",
        proveedor: this.nombreProveedor,
        fecha: ahora,
        detalle: "Dominio de email inválido",
        es_enviable: false,
      };
    }

    // 1. Detección de dominios desechables
    if (DOMINIOS_DISPOSABLE.has(dominio)) {
      return {
        estado: "disposable",
        proveedor: this.nombreProveedor,
        fecha: ahora,
        detalle: `Dominio desechable detectado: ${dominio}`,
        es_enviable: false,
      };
    }

    // 2. Verificación de MX en DNS con RFC 5321 Implicit MX Fallback
    try {
      let mxRecords: MxRecord[] = [];
      let noExplicitMx = false;

      try {
        mxRecords = await dns.resolveMx(dominio);
        if (!mxRecords || mxRecords.length === 0) {
          noExplicitMx = true;
        }
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === "ENODATA" || err.code === "ENOTFOUND") {
          noExplicitMx = true;
        } else {
          // Error transitorio de red o timeout (ETIMEOUT, SERVFAIL, ECONNREFUSED) -> unknown/verification_failed, NUNCA invalid
          return {
            estado: "verification_failed",
            proveedor: this.nombreProveedor,
            fecha: ahora,
            detalle: `Error transitorio de DNS al resolver MX: ${err.code ?? String(e)}`,
            es_enviable: false,
          };
        }
      }

      if (!noExplicitMx && mxRecords && mxRecords.length > 0) {
        const mxHost = mxRecords[0].exchange;
        return {
          estado: "valid",
          proveedor: this.nombreProveedor,
          fecha: ahora,
          detalle: `MX válido: ${mxHost} (prioridad ${mxRecords[0].priority})`,
          es_enviable: true,
        };
      }

      // 3. Fallback Implicit MX (RFC 5321 Sección 5.1):
      // Si no hay MX, verificar si existen registros A o AAAA
      try {
        const aRecords = await dns.resolve4(dominio).catch(() => [] as string[]);
        const aaaaRecords = await dns.resolve6(dominio).catch(() => [] as string[]);

        if (aRecords.length > 0 || aaaaRecords.length > 0) {
          const ip = aRecords[0] || aaaaRecords[0];
          return {
            estado: "valid",
            proveedor: this.nombreProveedor,
            fecha: ahora,
            detalle: `MX implícito (RFC 5321 §5.1): sin registros MX pero con dirección A/AAAA activa (${ip})`,
            es_enviable: true,
          };
        }

        // Sin MX ni registros de dirección A/AAAA -> Dominio no enrutable
        return {
          estado: "invalid",
          proveedor: this.nombreProveedor,
          fecha: ahora,
          detalle: `Dominio sin registros MX ni registros de dirección A/AAAA (${dominio})`,
          es_enviable: false,
        };
      } catch (e: unknown) {
        const err = e as { code?: string };
        if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
          return {
            estado: "invalid",
            proveedor: this.nombreProveedor,
            fecha: ahora,
            detalle: `Dominio no existe en DNS (${dominio})`,
            es_enviable: false,
          };
        }
        return {
          estado: "verification_failed",
          proveedor: this.nombreProveedor,
          fecha: ahora,
          detalle: `Error de red consultando registros A/AAAA: ${err.code ?? String(e)}`,
          es_enviable: false,
        };
      }
    } catch (e: unknown) {
      const err = e as { code?: string };
      return {
        estado: "verification_failed",
        proveedor: this.nombreProveedor,
        fecha: ahora,
        detalle: `Fallo general en verificación de dominio: ${err.code ?? String(e)}`,
        es_enviable: false,
      };
    }
  }
}

/** Verificador Mock / Deterministico para Pruebas Unitarias */
export class MockEmailVerifier implements EmailVerifier {
  private overrides: Map<string, ResultadoVerificacion> = new Map();

  setOverride(email: string, resultado: ResultadoVerificacion) {
    this.overrides.set(email.toLowerCase().trim(), resultado);
  }

  async verificar(email: string): Promise<ResultadoVerificacion> {
    const norm = email.toLowerCase().trim();
    if (this.overrides.has(norm)) {
      return this.overrides.get(norm)!;
    }

    const ahora = new Date().toISOString();
    if (!norm.includes("@") || !norm.includes(".")) {
      return {
        estado: "invalid",
        proveedor: "mock",
        fecha: ahora,
        detalle: "Formato inválido",
        es_enviable: false,
      };
    }

    if (norm.includes("invalido") || norm.includes("bounce")) {
      return {
        estado: "invalid",
        proveedor: "mock",
        fecha: ahora,
        detalle: "Marcado inválido por mock",
        es_enviable: false,
      };
    }

    if (norm.includes("disposable") || norm.includes("tempmail")) {
      return {
        estado: "disposable",
        proveedor: "mock",
        fecha: ahora,
        detalle: "Desechable",
        es_enviable: false,
      };
    }

    if (norm.includes("catchall")) {
      return {
        estado: "catch_all",
        proveedor: "mock",
        fecha: ahora,
        detalle: "Catch-all configurado",
        es_enviable: true,
      };
    }

    return {
      estado: "valid",
      proveedor: "mock",
      fecha: ahora,
      detalle: "Verificado sintaxis y dominio mock",
      es_enviable: true,
    };
  }
}
