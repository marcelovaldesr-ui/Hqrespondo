/**
 * El despachador: mira cada fila de la cola y elige la cascada que corresponde.
 *
 * POR QUÉ EXISTE — error real del 26-ago-2026
 * Antes, el worker elegía la cascada por un parámetro de la URL
 * (`?fuente=foco`), o sea ANTES de saber qué fila le iba a tocar. Pero la cola
 * es UNA SOLA, compartida por objetivo: `obtener_lote_cola` reparte por
 * prioridad y no mira de qué tabla es cada fila.
 *
 * Resultado medido: se pidió `fuente=foco` y el worker tomó 10 empresas del
 * SII (prioridad 100) en vez de los leads (prioridad 80). La cascada de leads
 * las rechazó una por una — y el worker, al recibir una respuesta y no una
 * excepción, las cerró como `completado`. Diez empresas salieron de la cola sin
 * que nadie las buscara, en 1,7 segundos y sin un solo error visible.
 *
 * La lección: cuando quien reparte el trabajo y quien lo hace no se ponen de
 * acuerdo sobre QUÉ es cada cosa, el trabajo se pierde en silencio. La decisión
 * de qué cascada usar pertenece a la fila, no a la URL.
 *
 * Con esto, `?fuente=` deja de existir en el worker. Sigue existiendo en
 * `/api/cola/llenar`, donde sí corresponde: ahí se decide qué ENCOLAR, que es
 * una elección legítima de quien llena la cola.
 */

import { cascadaTelefonoDirecto } from "@/lib/cascada";
import { cascadaLeadFoco } from "@/lib/cascadaLeadFoco";
import type { ModoCascada } from "@/lib/pasosTelefono";
import type { Enriquecedor, ItemCola, SalidaEnriquecimiento } from "@/lib/cola";

export function cascadaTelefono(opts: { vivos: Set<string>; modo: ModoCascada }): Enriquecedor {
  const porSii = cascadaTelefonoDirecto(opts);
  const porFoco = cascadaLeadFoco(opts);

  return async function enriquecer(item: ItemCola): Promise<SalidaEnriquecimiento> {
    if (item.entidad === "lead_foco") return porFoco(item);
    if (item.entidad === "empresa_sii") return porSii(item);
    // Un prospect no tiene cascada de teléfono todavía. Se marca como ERROR y
    // no como 'sin_dato': así vuelve a la cola cuando exista, en vez de quedar
    // anotado para siempre como "ya se intentó".
    return {
      encontrado: false,
      intentos: [{
        proveedor: "cascada",
        resultado: "error",
        encontrado: false,
        error_detalle: `todavía no hay cascada de teléfono para ${item.entidad}`,
      }],
    };
  };
}
