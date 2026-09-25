import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

/**
 * Growth OS dentro de RespondoHQ — almacenamiento.
 *
 * El MOTOR del Growth OS (loops, skills, crítico, visual-qa, gate de marca, claims,
 * renders) NO vive aquí: sigue en la carpeta respondo-growth-os y lo corre Claude.
 * El HQ es la ventana + la bandeja de decisiones del Owner. Todo se guarda en un
 * bucket PRIVADO de Supabase Storage (sin migraciones SQL):
 *
 *   app/index.html               interfaz (la misma del artefacto, construida por tools/ui_build_hq.py)
 *   state/growth-state.json      instantánea del estado (tools/ui_adapter.py)
 *   state/manifest.json          {ruta: sha1} de lo subido (para subir solo lo que cambió)
 *   files/<ruta>                 miniaturas y vistas JPG de cada render
 *   ledger/<id>.json             decisiones del Owner tomadas en el HQ (append-only)
 *
 * Lo sube/baja tools/hq_sync.py (en la carpeta del Growth OS) con GROWTH_OS_SYNC_TOKEN.
 */
export const BUCKET = "growth-os";

export function storage() {
  return db().storage.from(BUCKET);
}

let bucketOk = false;
export async function ensureBucket() {
  if (bucketOk) return;
  const s = db().storage;
  const { data } = await s.getBucket(BUCKET);
  if (!data) {
    const { error } = await s.createBucket(BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  bucketOk = true;
}

export async function readJson<T>(path: string): Promise<T | null> {
  const { data, error } = await storage().download(path);
  if (error || !data) return null;
  return JSON.parse(await data.text()) as T;
}

/** Lista todos los objetos bajo un prefijo (pagina de a 1000). */
export async function listAll(prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage().list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error || !data) break;
    for (const o of data) if (o.id) out.push(`${prefix}/${o.name}`);
    if (data.length < 1000) break;
  }
  return out;
}

export type LedgerEntry = Record<string, string | boolean | undefined> & { id: string; type: string; item_id: string };

/**
 * Decisiones guardadas desde el HQ (orden por ts). Con `skipIds`, no descarga las que el Growth OS ya importó
 * (el id va en el nombre del archivo: <fecha>_<id>.json), así el estado carga rápido aunque el historial crezca.
 */
export async function readHqLedger(skipIds?: Set<string>): Promise<LedgerEntry[]> {
  const paths = (await listAll("ledger")).filter((p) => {
    const m = /_(hq-[0-9a-f]{12})\.json$/.exec(p);
    return !(skipIds && m && skipIds.has(m[1]));
  });
  const entries = await Promise.all(paths.map((p) => readJson<LedgerEntry>(p)));
  return entries.filter((e): e is LedgerEntry => !!e).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}

// Misma validación que tools/ui_serve.py (TYPES / FIELDS): el HQ no acepta nada distinto al Growth OS local.
export const TYPES = new Set(["decision", "approval", "material", "terminal", "create_request"]);
export const FIELDS: Record<string, number> = {
  type: 20, item_id: 120, choice: 60, label: 200, note: 4000, brand: 30, piece_sha1: 40, piece_path: 300,
  version: 10, goal: 30, format: 20, input_kind: 20, reservoir_id: 40, ts: 40, by: 20,
};

export function validateEntry(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Se esperaba un objeto JSON");
  const e = raw as Record<string, unknown>;
  if (!TYPES.has(String(e.type))) throw new Error("type inválido");
  if (!/^[\w.*~-]{1,120}$/.test(String(e.item_id ?? ""))) throw new Error("item_id inválido");
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(e)) {
    if (!(k in FIELDS) || v === null || v === undefined) continue;
    if (typeof v !== "string") throw new Error(`${k} debe ser texto`);
    if (v.length > FIELDS[k]) throw new Error(`${k} es demasiado largo`);
    clean[k] = v;
  }
  if (clean.type === "approval" && !["approve", "changes"].includes(clean.choice)) throw new Error("choice inválido para approval");
  return clean;
}

/** Ruta segura dentro del bucket (sin .., sin barras iniciales, solo caracteres esperables). */
export function safePath(p: string): string | null {
  const s = p.replace(/^\/+/, "");
  if (!s || s.length > 400 || s.includes("..") || !/^[\w./~@+-]+$/.test(s)) return null;
  return s;
}

export function syncAuthorized(req: Request): boolean {
  const t = process.env.GROWTH_OS_SYNC_TOKEN;
  const got = req.headers.get("x-growth-os-token");
  if (!t || t.length < 24 || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b);
}
