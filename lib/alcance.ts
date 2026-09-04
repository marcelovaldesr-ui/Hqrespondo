/**
 * ALCANCE — ¿este número lo contesta quien decide, o el mesón?
 *
 * POR QUÉ EXISTE — 4-sep-2026
 * Tomás hizo una tanda de llamadas y no alcanzó a nadie. Al revisar por qué,
 * el problema no era falta de datos: era el orden de la lista.
 *
 * En Chile el formato del número dice casi todo:
 *   · CELULAR (9 xxxx xxxx) publicado por un negocio → es el teléfono de quien
 *     manda. Es el mismo con el que atiende clientes por WhatsApp. Contesta él.
 *   · FIJO (2 xxxx xxxx, 32 xxx xxxx…) → es el mesón. Contesta quien está ahí
 *     justamente para filtrar llamadas.
 *
 * Esto ya estaba escrito en el código en TRES lugares distintos —`scoring.ts`,
 * `agenteTelefono.ts` y la cascada— cada uno con su propia versión, y una
 * cuarta en SQL. Cuatro copias de la regla de la que ahora depende a quién se
 * llama primero es una que va a quedar distinta de las otras sin que nadie se
 * entere. Acá está la única.
 *
 * OJO — el espejo en SQL: `leads_foco.alcance` (migración 036) es una columna
 * generada que calcula exactamente lo mismo en Postgres, porque el orden de la
 * cola se hace en la base y traerse 1.000 filas para ordenarlas en la app no
 * es opción. Si se cambia el criterio acá, hay que cambiarlo allá. La prueba
 * `pruebas/alcance.ts` compara las dos implementaciones contra los mismos
 * casos para que no se separen en silencio.
 */

/** Solo los dígitos, sin el +56 del país. Lo que se compara siempre. */
export function digitosCL(t: string | null | undefined): string {
  const d = (t ?? "").replace(/\D/g, "");
  return d.startsWith("56") ? d.slice(2) : d;
}

/**
 * ¿Es un celular chileno? Nueve dígitos que parten en 9.
 *
 * Deliberadamente NO acepta 8 dígitos: los celulares chilenos llevan el 9
 * desde 2018 y un número de 8 dígitos hoy es un fijo viejo mal copiado.
 *
 * Mira los PRIMEROS nueve dígitos, no el largo exacto. Lo encontró la prueba
 * de paridad: en la base hay números guardados como "+56 9 8765 4321 anexo 12"
 * y "9 8765 4321 (móvil)". Exigiendo largo exacto, esos quedaban clasificados
 * como fijo — o sea un celular bueno se hundía al fondo de la cola por una
 * anotación al lado. Un falso negativo acá cuesta un lead que sí contestaba.
 */
export function esCelularChileno(t: string | null | undefined): boolean {
  const d = digitosCL(t);
  return d.length >= 9 && /^9[0-9]{8}$/.test(d.slice(0, 9));
}

/** Un fijo es cualquier número con largo de teléfono que no es celular. */
export function esFijoChileno(t: string | null | undefined): boolean {
  const d = digitosCL(t);
  return d.length >= 8 && !esCelularChileno(t);
}

export const ALCANCE_MAX = 4;

/**
 * 0-4. El celular pesa MÁS que el nombre a propósito: saber por quién
 * preguntar no sirve de nada si el que contesta está para no pasarte.
 */
export function alcanceDe(lead: { telefono?: string | null; contacto?: string | null }): number {
  const tel = (lead.telefono ?? "").trim();
  if (!tel) return 0;
  const conNombre = Boolean((lead.contacto ?? "").trim());
  if (esCelularChileno(tel)) return conNombre ? 4 : 3;
  return conNombre ? 2 : 1;
}

export const ALCANCE_LABEL: Record<number, string> = {
  4: "Celular + nombre",
  3: "Celular",
  2: "Fijo + nombre",
  1: "Fijo",
  0: "Sin teléfono",
};

/** Lo que hay que saber ANTES de marcar, en una línea. */
export const ALCANCE_QUE_ESPERAR: Record<number, string> = {
  4: "Contesta quien decide. Pregunta por la persona por su nombre.",
  3: "Es un celular de negocio: contesta el dueño o quien atiende. Falta saber su nombre.",
  2: "Es un fijo: probablemente el mesón. Ten el nombre listo y pide por él directo.",
  1: "Es un fijo y no sabemos por quién preguntar. Va a costar pasar la recepción.",
  0: "No hay número. No es llamable todavía.",
};

/** Color de estado para la ficha. Verde/ámbar/rojo, no decorativo. */
export const ALCANCE_TONO: Record<number, "ok" | "warn" | "danger"> = {
  4: "ok", 3: "ok", 2: "warn", 1: "danger", 0: "danger",
};
