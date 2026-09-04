/**
 * Comprueba que las DOS implementaciones de `alcance` dan lo mismo:
 *   · la de TypeScript, en `lib/alcance.ts`
 *   · la columna generada de Postgres, en la migración 036
 *
 * Existen las dos porque el orden de la cola se hace en la base (traerse mil
 * filas a la app para ordenarlas no es opción) pero la ficha y las APIs lo
 * necesitan en la app. Dos implementaciones de la misma regla se separan
 * solas con el tiempo; esto es lo que avisa cuando pasa.
 *
 * Cómo se corre:
 *   npx tsx pruebas/alcance.ts          → imprime lo que calcula TypeScript
 *   npx tsx pruebas/alcance.ts --sql    → imprime los INSERT para Postgres
 *
 * Después se comparan las dos salidas. Los casos son formatos REALES de la
 * base: +56 con espacios, pegado, con guiones, sin código de país.
 */
import { alcanceDe, esCelularChileno } from "../lib/alcance";

export const CASOS: { caso: string; telefono: string; contacto: string }[] = [
  { caso: "celular +56 con espacios",   telefono: "+56 9 8765 4321", contacto: "Daniela Acuña" },
  { caso: "celular pegado",             telefono: "+56987654321",    contacto: "Lucas Oberst" },
  { caso: "celular sin codigo pais",    telefono: "987654321",       contacto: "Jean Susperreguy" },
  { caso: "celular con guiones",        telefono: "9-8765-4321",     contacto: "Ruben Ramis" },
  { caso: "celular con espacios sueltos", telefono: "9 8765 4325",   contacto: "Marcelo Valdes" },
  { caso: "celular sin nombre",         telefono: "+56 9 8765 4322", contacto: "" },
  { caso: "fijo santiago con nombre",   telefono: "+56 2 2591 2340", contacto: "Diana Parra" },
  { caso: "fijo valparaiso con nombre", telefono: "+56 32 259 1234", contacto: "Jorge Esper" },
  { caso: "fijo sin nombre",            telefono: "+56 2 2222 8889", contacto: "" },
  { caso: "800 sin nombre",             telefono: "800 200 300",     contacto: "" },
  { caso: "sin telefono con nombre",    telefono: "",                contacto: "Veronica Flores" },
  { caso: "sin nada",                   telefono: "",                contacto: "" },
  // Bordes que importan: 8 dígitos es un fijo viejo, no un celular.
  { caso: "ocho digitos partiendo en 9", telefono: "98765432",       contacto: "Alguien" },
  { caso: "celular con anexo pegado",    telefono: "+56 9 8765 4321 anexo 12", contacto: "Alguien" },
];

if (process.argv.includes("--sql")) {
  const esc = (s: string) => s.replace(/'/g, "''");
  console.log("truncate leads_foco;");
  for (const c of CASOS) {
    console.log(
      `insert into leads_foco (empresa, contacto, telefono, lista) values ` +
      `('${esc(c.caso)}', '${esc(c.contacto)}', '${esc(c.telefono)}', 'prueba');`,
    );
  }
  console.log(`select empresa, alcance from leads_foco order by empresa;`);
} else {
  const filas = CASOS.map((c) => ({
    caso: c.caso,
    alcance: alcanceDe(c),
    celular: esCelularChileno(c.telefono),
  })).sort((a, b) => a.caso.localeCompare(b.caso));
  console.log(JSON.stringify(filas, null, 1));
}
