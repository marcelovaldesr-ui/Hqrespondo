/**
 * PARIDAD · `prioridad` vive en dos lugares: la columna generada de la
 * migración 039 y `prioridadComercial` en lib/contactabilidad.ts. Si se
 * separan, la pantalla ordena distinto a lo que dice la ficha del lead y
 * nadie se entera hasta que el vendedor pierde la mañana.
 */
import { prioridadComercial } from "@/lib/contactabilidad";
const casos: [number, number][] = [];
for (let o = 0; o <= 100; o += 7) for (let c = 0; c <= 100; c += 11) casos.push([o, c]);
casos.push([100,100],[0,0],[1,1],[50,51],[49,50],[2,2],[99,1],[1,99],[93,41],[31,17],[24,0],[95,0]);
console.log(casos.map(([o,c]) => `${o} ${c} ${prioridadComercial(o,c)}`).join("\n"));
