export const STATES = [
  "BACKLOG",
  "DISCOVERY",
  "EN_DESARROLLO",
  "VALIDACION",
  "BLOQUEADO",
  "CERRADO",
] as const;
export const HEALTH = ["EN_CURSO", "ATENCION", "BLOQUEADO"] as const;
export type Front = {
  id: string;
  nombre: string;
  objetivo: string;
  categoria: string;
  estado: (typeof STATES)[number];
  salud: (typeof HEALTH)[number];
  prioridad: "P0" | "P1" | "P2";
  fase: string;
  proximo_hito: string;
  proxima_accion: string;
  bloqueo: string;
  owner_action: string;
  fecha_objetivo: string;
  cerrado_at: string | null;
  created_at: string;
  updated_at: string;
  hitos: { nombre: string; completado_at: string | null }[];
  links: { label: string; reference: string }[];
  updates: {
    fecha: string;
    autor: string;
    texto: string;
    anterior?: Omit<Front, "updates">;
  }[];
};
export function validate(value: unknown): asserts value is Front {
  if (!value || typeof value !== "object") throw new Error("Frente inválido");
  const f = value as Front;
  for (const key of [
    "nombre",
    "objetivo",
    "categoria",
    "fase",
    "proximo_hito",
    "proxima_accion",
    "bloqueo",
    "owner_action",
    "fecha_objetivo",
  ] as const)
    if (typeof f[key] !== "string" || f[key].length > 4000)
      throw new Error(`Campo inválido: ${key}`);
  if (!f.nombre.trim() || !f.objetivo.trim())
    throw new Error("Nombre y objetivo son obligatorios");
  if (
    !STATES.includes(f.estado) ||
    !HEALTH.includes(f.salud) ||
    !["P0", "P1", "P2"].includes(f.prioridad)
  )
    throw new Error("Estado, salud o prioridad inválidos");
  if (f.estado !== "CERRADO" && !f.proxima_accion.trim())
    throw new Error("Indica una próxima acción");
  if (
    f.fecha_objetivo &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha_objetivo) ||
      new Date(f.fecha_objetivo).toISOString().slice(0, 10) !==
        f.fecha_objetivo)
  )
    throw new Error("Fecha inválida");
  if (
    !Array.isArray(f.hitos) ||
    f.hitos.length > 30 ||
    f.hitos.some(
      (h) =>
        !h ||
        typeof h.nombre !== "string" ||
        !h.nombre.trim() ||
        h.nombre.length > 200 ||
        (h.completado_at !== null &&
          !Number.isFinite(Date.parse(h.completado_at))),
    )
  )
    throw new Error("Hitos inválidos");
  if (
    !Array.isArray(f.links) ||
    f.links.length > 20 ||
    f.links.some(
      (l) =>
        !l ||
        typeof l.label !== "string" ||
        !l.label.trim() ||
        typeof l.reference !== "string" ||
        !l.reference.trim() ||
        l.reference.length > 2000 ||
        /^(javascript|data|vbscript):/i.test(l.reference.trim()),
    )
  )
    throw new Error("Referencias inválidas");
}
export function saveFront(
  input: unknown,
  previous: Front | null,
  author: string,
  note: string,
  now = new Date().toISOString(),
): Front {
  validate(input);
  if (typeof note !== "string" || !note.trim() || note.length > 4000)
    throw new Error("Escribe una actualización breve");
  const f = input;
  const anterior = previous
    ? (({ updates: _updates, ...snapshot }) => snapshot)(previous)
    : undefined;
  return {
    ...f,
    id: previous?.id ?? crypto.randomUUID(),
    created_at: previous?.created_at ?? now,
    updated_at: now,
    cerrado_at: f.estado === "CERRADO" ? (previous?.cerrado_at ?? now) : null,
    updates: [
      ...(previous?.updates ?? []),
      { fecha: now, autor: author, texto: note.trim(), anterior },
    ],
  };
}
export function staleDays(f: Front, now = Date.now()) {
  return f.estado === "CERRADO" || f.estado === "BACKLOG"
    ? 0
    : Math.max(0, Math.floor((now - Date.parse(f.updated_at)) / 86400000));
}
export function summary(fronts: Front[], now = Date.now()) {
  const active = fronts.filter(
    (f) => !["CERRADO", "BACKLOG"].includes(f.estado),
  );
  return {
    active,
    blocked: active.filter(
      (f) => f.estado === "BLOQUEADO" || f.salud === "BLOQUEADO",
    ).length,
    owner: active.filter((f) => f.owner_action.trim()),
    stale: active.filter((f) => staleDays(f, now) > 7).length,
  };
}
export function progress(f: Front) {
  return f.hitos.length
    ? {
        done: f.hitos.filter((h) => h.completado_at).length,
        total: f.hitos.length,
      }
    : null;
}
export function emptyFront(): Front {
  return {
    id: "",
    nombre: "",
    objetivo: "",
    categoria: "PRODUCTO",
    estado: "DISCOVERY",
    salud: "EN_CURSO",
    prioridad: "P1",
    fase: "",
    proximo_hito: "",
    proxima_accion: "",
    bloqueo: "",
    owner_action: "",
    fecha_objetivo: "",
    cerrado_at: null,
    created_at: "",
    updated_at: "",
    hitos: [],
    links: [],
    updates: [],
  };
}
