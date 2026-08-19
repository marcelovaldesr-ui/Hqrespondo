import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluarEncaje } from "@/lib/encaje";
import { normalizarTelefono } from "@/lib/actividades";

/**
 * /api/foco/importar — carga una tanda de leads en `leads_foco`.
 *
 * Recibe CSV pegado tal cual sale del archivo de la Lista B (o de cualquier
 * planilla con encabezados). Se acepta un puñado de nombres alternativos por
 * columna porque las tandas van a venir de fuentes distintas y renombrar a
 * mano el encabezado antes de pegar es exactamente el paso que nadie hace.
 *
 * Es idempotente: la llave es (lista + empresa + contacto). Volver a pegar el
 * mismo CSV NO duplica; actualiza los datos de contacto y deja intacto el
 * estado operativo (intentos, resultado, recordatorio, notas), que es trabajo
 * humano y no debe perderse por reimportar.
 */

/**
 * CSV con comillas dobles y saltos de línea dentro de campo.
 *
 * El separador se DETECTA en el encabezado en vez de aceptar cualquiera de
 * los tres: el archivo de Lista B trae punto y coma dentro de campos de texto
 * ("Telefono +56 2 ...; correo generico ..."), y tratar el ';' como separador
 * corría las columnas en 71 de 100 filas — sin fallar, solo con datos mal
 * puestos. Un error silencioso es peor que uno ruidoso.
 */
function detectarSeparador(texto: string): string {
  const primera = texto.split(/\r?\n/)[0] ?? "";
  let mejor = ",";
  let max = -1;
  for (const sep of [",", ";", "\t"]) {
    let n = 0;
    let dentro = false;
    for (const c of primera) {
      if (c === '"') dentro = !dentro;
      else if (c === sep && !dentro) n++;
    }
    if (n > max) { max = n; mejor = sep; }
  }
  return mejor;
}

function parseCSV(texto: string): string[][] {
  const sep = detectarSeparador(texto);
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;
  const t = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; }
        else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((c) => c.trim()));
}

function norm(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");
}

/** Nombre interno → encabezados que se aceptan para esa columna. */
const ALIAS: Record<string, string[]> = {
  empresa: ["empresa", "nombre_fantasia", "nombre", "company", "razon_social"],
  razon_social: ["razon_social", "razon", "legal_name"],
  rut: ["rut", "rut_completo", "rut_empresa"],
  web: ["web", "sitio", "sitio_web", "website", "url"],
  linkedin_empresa: ["linkedin_empresa", "linkedin_company", "company_linkedin"],
  industria: ["industria", "subrubro", "rubro", "sector", "giro"],
  n_empleados: ["n_empleados", "n_trabajadores", "trabajadores", "empleados", "headcount"],
  comuna: ["comuna", "city", "ciudad"],
  region: ["region"],
  contacto: ["contacto", "decisor_nombre", "nombre_contacto", "persona", "full_name"],
  cargo: ["cargo", "decisor_cargo", "puesto", "title", "job_title"],
  telefono: ["telefono", "telefono_publico", "telefono_directo", "fono", "phone", "celular"],
  email: ["email", "correo", "mail"],
  linkedin_contacto: ["linkedin_contacto", "decisor_linkedin", "linkedin", "linkedin_persona"],
  senal: ["senal", "senal_dolor", "motivo", "trigger"],
  confianza: ["confianza", "confidence"],
  fuente_url: ["fuente_url", "fuente", "source_url", "source"],
  canales: ["canal_contacto", "canales", "contacto_canal"],
  whatsapp: ["tiene_whatsapp_web", "whatsapp", "tiene_whatsapp"],
};

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const lista = (String(b.lista ?? "").trim() || "general").slice(0, 60);
    const csv = String(b.csv ?? "");
    if (!csv.trim()) return NextResponse.json({ error: "CSV vacío" }, { status: 400 });

    const filas = parseCSV(csv);
    if (filas.length < 2) return NextResponse.json({ error: "Falta el encabezado o no hay filas" }, { status: 400 });

    const cab = filas[0].map(norm);
    const idx: Record<string, number> = {};
    // Se recorre la lista de alias EN ORDEN, no los encabezados: si el archivo
    // trae `nombre_fantasia` y `razon_social`, gana el nombre de fantasía
    // porque es como la empresa se presenta al teléfono.
    for (const [campo, alias] of Object.entries(ALIAS)) {
      for (const a of alias) {
        const i = cab.indexOf(a);
        if (i >= 0) { idx[campo] = i; break; }
      }
    }
    if (idx.empresa === undefined) {
      return NextResponse.json(
        { error: `No se encontró la columna de empresa. Encabezados leídos: ${cab.join(", ")}` },
        { status: 400 },
      );
    }

    const val = (f: string[], campo: string) => (idx[campo] !== undefined ? (f[idx[campo]] ?? "").trim() : "");

    const nuevos: Record<string, unknown>[] = [];
    const vistos = new Set<string>();
    for (const f of filas.slice(1)) {
      const empresa = val(f, "empresa") || val(f, "razon_social");
      if (!empresa) continue;
      const contacto = val(f, "contacto");
      const clave = `${empresa.toLowerCase()}|${contacto.toLowerCase()}`;
      if (vistos.has(clave)) continue; // duplicado dentro del mismo archivo
      vistos.add(clave);

      const n = parseInt(val(f, "n_empleados").replace(/[^\d]/g, ""), 10);
      // El encaje se calcula acá, con los campos crudos: el texto de canales
      // observados es la mejor evidencia de cómo opera el negocio y no se
      // guarda en la tabla, así que si no se usa ahora se pierde.
      const encaje = evaluarEncaje({
        empresa: val(f, "empresa"),
        razon_social: val(f, "razon_social"),
        industria: val(f, "industria"),
        senal: val(f, "senal"),
        canales: val(f, "canales"),
        tieneWhatsapp: /^(si|sí|s|yes|true|1)$/i.test(val(f, "whatsapp")),
        nEmpleados: Number.isFinite(n) && n > 0 ? n : null,
      });
      nuevos.push({
        // SIEMPRE presente: PostgREST exige columnas uniformes en el insert
        // masivo, y una fila sin la llave recibe null (no el default de la
        // tabla). Con tags not-null, medio lote se caía por esto.
        tags: [] as string[],
        encaje: encaje.nivel,
        encaje_motivo: encaje.motivo,
        lista,
        empresa,
        razon_social: val(f, "razon_social"),
        rut: val(f, "rut"),
        web: val(f, "web"),
        linkedin_empresa: val(f, "linkedin_empresa"),
        industria: val(f, "industria"),
        n_empleados: Number.isFinite(n) && n > 0 ? n : null,
        comuna: val(f, "comuna"),
        region: val(f, "region"),
        contacto,
        cargo: val(f, "cargo"),
        telefono: val(f, "telefono"),
        email: val(f, "email"),
        linkedin_contacto: val(f, "linkedin_contacto"),
        senal: val(f, "senal"),
        confianza: val(f, "confianza") || "baja",
        fuente_url: val(f, "fuente_url"),
      });
    }
    if (!nuevos.length) return NextResponse.json({ error: "Ninguna fila tenía empresa" }, { status: 400 });

    const s = db();

    // Cruce con el OTRO motor. Si el negocio ya está en la base de Google
    // Maps, los dos motores podrían llamarlo sin saberlo — y no hay peor
    // presentación que "te llamé ayer... ¿o fue mi socio?". Se marca con un
    // tag visible; no se bloquea, porque en Foco se llama a una PERSONA
    // distinta del mesón y a veces ese doble camino es a propósito.
    let cruceOk = false;
    try {
      const { data: pros } = await s.from("prospects").select("nombre,telefono").limit(10000);
      const telefonosGM = new Set<string>();
      const nombresGM = new Set<string>();
      for (const p of (pros ?? []) as { nombre: string; telefono: string | null }[]) {
        const t = normalizarTelefono(p.telefono ?? "");
        if (t) telefonosGM.add(t);
        if (p.nombre?.trim()) nombresGM.add(p.nombre.trim().toLowerCase());
      }
      for (const r of nuevos) {
        const t = normalizarTelefono(String(r.telefono ?? ""));
        const coincideTel = !!t && telefonosGM.has(t);
        const coincideNombre = nombresGM.has(String(r.empresa).trim().toLowerCase());
        if (coincideTel || coincideNombre) {
          r.tags = [coincideTel ? "en-llamadas (mismo fono)" : "en-llamadas (mismo nombre)"];
        }
      }
      cruceOk = true;
    } catch (e) {
      console.error("[foco/importar] cruce con prospects falló:", e);
    }
    // Se leen las llaves ya existentes de esta lista para separar altas de
    // actualizaciones. Es una consulta más, pero evita el escenario feo:
    // reimportar y pisar el estado de leads ya trabajados.
    const { data: previos, error: eSel } = await s
      .from("leads_foco")
      .select("id,empresa,contacto,encaje_manual")
      .eq("lista", lista);
    if (eSel) throw new Error(eSel.message || "no se pudo leer la lista existente");

    const mapa = new Map<string, string>();
    const manuales = new Set<string>();
    for (const p of (previos ?? []) as {
      id: string; empresa: string; contacto: string; encaje_manual: boolean;
    }[]) {
      mapa.set(`${p.empresa.toLowerCase()}|${(p.contacto ?? "").toLowerCase()}`, p.id);
      if (p.encaje_manual) manuales.add(p.id);
    }

    let insertados = 0;
    let actualizados = 0;
    const aInsertar = nuevos.filter(
      (r) => !mapa.has(`${String(r.empresa).toLowerCase()}|${String(r.contacto).toLowerCase()}`),
    );
    const aActualizar = nuevos.filter((r) =>
      mapa.has(`${String(r.empresa).toLowerCase()}|${String(r.contacto).toLowerCase()}`),
    );

    for (let i = 0; i < aInsertar.length; i += 200) {
      const trozo = aInsertar.slice(i, i + 200);
      const { error } = await s.from("leads_foco").insert(trozo);
      if (error) throw new Error(error.message || "no se pudieron insertar las filas");
      insertados += trozo.length;
    }

    for (const r of aActualizar) {
      const id = mapa.get(`${String(r.empresa).toLowerCase()}|${String(r.contacto).toLowerCase()}`)!;
      const { lista: _l, empresa: _e, contacto: _c, ...resto } = r;
      // Si el cruce con la otra base falló, el tag calculado es [] por defecto
      // y pisaría un "en-llamadas" legítimo puesto en un import anterior.
      if (!cruceOk) delete (resto as Record<string, unknown>).tags;
      // Si alguien corrigió el encaje a mano, la regla no lo vuelve a tocar.
      if (manuales.has(id)) {
        delete (resto as Record<string, unknown>).encaje;
        delete (resto as Record<string, unknown>).encaje_motivo;
      }
      const { error } = await s
        .from("leads_foco")
        .update({ ...resto, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
      actualizados++;
    }

    return NextResponse.json({
      ok: true,
      lista,
      leidos: nuevos.length,
      insertados,
      actualizados,
      conTelefono: nuevos.filter((r) => String(r.telefono).trim()).length,
      conDecisor: nuevos.filter((r) => String(r.contacto).trim()).length,
      enLlamadas: nuevos.filter((r) => Array.isArray(r.tags) && r.tags.length).length,
      porEncaje: nuevos.reduce<Record<string, number>>((acc, r) => {
        const k = String(r.encaje);
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    });
  } catch (e: any) {
    console.error("[foco/importar]", e);
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
