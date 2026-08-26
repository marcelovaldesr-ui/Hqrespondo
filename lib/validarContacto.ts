/**
 * ¿Esto que escribieron parece de verdad un teléfono / un correo?
 *
 * POR QUÉ EXISTE — reporte de Marcelo, 26-ago-2026
 * "Al agregar leads a mano, a veces pongo el nombre y al guardarlo lo deja en
 * la sección de teléfono, o el correo igual."
 *
 * Revisé el camino completo y el mapeo de campos está bien: el formulario
 * manda `telefono` y el endpoint guarda `telefono`. Nadie corre los datos de
 * casillero. Lo que faltaba es más simple y más importante: **nadie estaba
 * mirando si el contenido correspondía al campo**. Un nombre escrito en la
 * casilla del teléfono se guardaba como teléfono, sin una sola queja.
 *
 * Y da lo mismo cómo llegó ahí — el autocompletar del navegador, la lectura
 * del sitio con IA, o un dedo apurado. El formulario no tiene por qué saber de
 * quién fue la culpa; tiene que negarse a guardar un nombre como número.
 *
 * Efecto secundario feo que esto corta: un nombre en la casilla del teléfono
 * se guardaba en la columna `telefono` (la que ordena la cola y la que se
 * compara contra la lista de no contactar) pero NO en el arreglo `telefonos`,
 * porque `limpiarContactos` normaliza a solo dígitos y un nombre queda en "".
 * O sea, la ficha terminaba contradiciéndose consigo misma.
 *
 * El criterio es a propósito flojo: no valida formato chileno ni corrige nada.
 * Solo ataja lo que no puede ser. Un teléfono tiene números; un correo tiene
 * arroba y un punto después. Todo lo demás pasa — anexos, prefijos raros,
 * notas al lado. Un validador estricto termina rechazando datos buenos, y eso
 * es peor que el problema que arregla.
 */

/** Los dígitos, sin nada más. */
export function soloDigitos(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/**
 * Mínimo 7 dígitos. Un fijo chileno sin código de área tiene 7; un móvil, 9.
 * Un nombre tiene cero, que es justo el caso que queremos atajar.
 */
export function pareceTelefono(v: string): boolean {
  return soloDigitos(v).length >= 7;
}

export function pareceEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v ?? "").trim());
}

export type ContactoLibre = { valor?: string | null };

/**
 * Revisa todo lo que se va a guardar y devuelve los problemas en castellano,
 * listos para mostrar. Lista vacía = se puede guardar.
 *
 * Devuelve TODOS los problemas juntos, no el primero: si alguien se equivocó
 * en dos casillas, que los vea las dos de una vez y no una por guardado.
 */
export function revisarContactos(x: {
  telefono?: string | null;
  email?: string | null;
  otrosTels?: ContactoLibre[];
  otrosMails?: ContactoLibre[];
}): string[] {
  const problemas: string[] = [];
  const recorta = (v: string) => (v.length > 40 ? `${v.slice(0, 40)}…` : v);

  const tel = (x.telefono ?? "").trim();
  if (tel && !pareceTelefono(tel)) {
    problemas.push(`"${recorta(tel)}" está en la casilla del teléfono y no tiene números. ¿Va en otro campo?`);
  }

  const mail = (x.email ?? "").trim();
  if (mail && !pareceEmail(mail)) {
    problemas.push(`"${recorta(mail)}" está en la casilla del correo y no parece un correo (le falta el @ o el punto).`);
  }

  (x.otrosTels ?? []).forEach((t, i) => {
    const v = (t?.valor ?? "").trim();
    if (v && !pareceTelefono(v)) {
      problemas.push(`Otro teléfono #${i + 1}: "${recorta(v)}" no tiene números.`);
    }
  });

  (x.otrosMails ?? []).forEach((m, i) => {
    const v = (m?.valor ?? "").trim();
    if (v && !pareceEmail(v)) {
      problemas.push(`Otro correo #${i + 1}: "${recorta(v)}" no parece un correo.`);
    }
  });

  return problemas;
}
