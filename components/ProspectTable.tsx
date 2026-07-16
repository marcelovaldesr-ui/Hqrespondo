"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { plantillasPara } from "@/lib/mensajes";
import KitVenta from "@/components/KitVenta";
import { matchRubroSlug, conDemo } from "@/lib/growth/match";
import { rubroPorSlug } from "@/lib/growth/industries";
import {
  AREA_OBJETIVO_LABEL,
  AREA_OBJETIVO_OPTIONS,
  ESTADO_CONFIG,
  ESTADO_LABEL,
  ESTADO_OPTIONS,
  FUENTE_LABEL,
  FUENTES_CONTACTO,
  type AreaObjetivo,
  type ContactoDecision,
  type Estado,
  type Fuente,
  type Prospect,
} from "@/lib/types";

function scoreCls(score: number) {
  if (score >= 70) return { text: "text-ok", bar: "bg-ok" };
  if (score >= 40) return { text: "text-warn", bar: "bg-warn" };
  return { text: "text-ink-dim", bar: "bg-ink-faint" };
}

/** Acción recomendada por reglas simples (score + estado). */
function accionRecomendada(p: Prospect): string {
  if (p.estado === "nuevo")
    return p.score >= 70
      ? "Contactar hoy con el mensaje personalizado"
      : p.score >= 40
        ? "Contactar esta semana (prioriza los de score más alto primero)"
        : "Baja prioridad — contactar solo si sobra capacidad, o descartar";
  if (p.estado === "contactado")
    return "Sin respuesta aún: enviar follow-up 1 a los 2–3 días (máx. 3–4 toques)";
  if (p.estado === "respondio")
    return "Responder hoy mismo, calificar (volumen, quién responde, horario ciego) y mandar la demo";
  if (p.estado === "reunion")
    return "Hacer la demo guiada y enviar propuesta de 1 página el MISMO día";
  if (p.estado === "en_pipeline") return "Gestionar desde Pipeline";
  return "Descartado — sin acción";
}

/** Fecha hoy+n en formato YYYY-MM-DD. */
function enDias(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

const ESTADO_PILL: Record<Estado, string> = {
  nuevo: "border-accent/40 text-accent",
  contactado: "border-warn/40 text-warn",
  respondio: "border-ok/40 text-ok",
  reunion: "border-ok/40 text-ok",
  en_pipeline: "border-line2 text-ink-mut",
  descartado: "border-line text-ink-faint",
};

type Orden = "score" | "nombre" | "rubro" | "comuna" | "recientes";

const ORDEN_OPTIONS: { value: Orden; label: string }[] = [
  { value: "score", label: "Mayor score" },
  { value: "recientes", label: "Más recientes" },
  { value: "nombre", label: "Nombre A-Z" },
  { value: "rubro", label: "Rubro A-Z" },
  { value: "comuna", label: "Comuna A-Z" },
];

/** Genera un CSV compatible con Excel es-CL (BOM UTF-8 + separador ;) */
function descargarCSV(rows: Prospect[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const cab = [
    "Nombre", "Rubro", "Comuna", "Teléfono", "Web", "Dirección",
    "Rating", "Reviews", "Score", "Estado", "Próxima acción", "Mensaje", "Notas",
  ];
  const lineas = rows.map((p) =>
    [
      p.nombre, p.rubro, p.comuna, p.telefono, p.web, p.direccion,
      p.rating, p.reviews, p.score, ESTADO_LABEL[p.estado],
      p.proxima_accion, p.mensaje, p.notas,
    ].map(esc).join(";"),
  );
  const csv = "﻿" + [cab.map(esc).join(";"), ...lineas].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prospectos-respondo-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Lee la respuesta de un fetch sin asumir que siempre es JSON válido — si
 * Vercel corta la función a medias (timeout del plan Hobby, crash, etc.)
 * devuelve una página de error plana, no JSON, y un res.json() directo
 * revienta con un mensaje ilegible ("Unexpected token..."). Acá se atrapa
 * eso y se devuelve un mensaje entendible.
 */
async function leerRespuesta(res: Response): Promise<any> {
  const texto = await res.text();
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    return {
      error: res.ok
        ? "El servidor respondió algo inesperado (no era JSON)."
        : `Error ${res.status}: la función falló o se demoró demasiado (revisa los logs de Vercel).`,
    };
  }
}

/** Link wa.me con el mensaje pre-cargado (envío manual, 1 clic) */
function linkWhatsApp(p: Prospect): string | null {
  if (!p.telefono) return null;
  let digits = p.telefono.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("9")) digits = "56" + digits;
  return `https://wa.me/${digits}${p.mensaje ? `?text=${encodeURIComponent(p.mensaje)}` : ""}`;
}

export default function ProspectTable({
  prospects,
}: {
  prospects: Prospect[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Prospect[]>(prospects);
  const [filtro, setFiltro] = useState<Estado | "todos">("todos");
  const [quick, setQuick] = useState<"" | "hot" | "sin_respuesta" | "seguir_hoy">("");
  const [rubro, setRubro] = useState<string>("todos");
  const [comuna, setComuna] = useState<string>("todos");
  const [orden, setOrden] = useState<Orden>("score");
  const [q, setQ] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [estadoError, setEstadoError] = useState<string | null>(null);
  // Borradores de la fila expandida (una a la vez)
  const [proxDraft, setProxDraft] = useState("");
  const [notasDraft, setNotasDraft] = useState("");
  const [guardandoDetalle, setGuardandoDetalle] = useState(false);
  // Mensajes con IA (2 variantes) para el prospecto abierto
  const [iaVariantes, setIaVariantes] = useState<string[]>([]);
  const [iaTipo, setIaTipo] = useState<string | null>(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);
  // Contacto del encargado (prospección adicional, beta) — por prospecto
  const [contactos, setContactos] = useState<Record<string, ContactoDecision[]>>({});
  const [areaSel, setAreaSel] = useState<Record<string, AreaObjetivo>>({});
  const [fuenteSel, setFuenteSel] = useState<Record<string, Fuente>>({});
  const [contactoLoading, setContactoLoading] = useState<string | null>(null);
  const [contactoError, setContactoError] = useState<Record<string, string>>({});
  const [revelandoId, setRevelandoId] = useState<string | null>(null);

  useEffect(() => {
    setItems(prospects);
  }, [prospects]);

  const rubros = useMemo(
    () => Array.from(new Set(items.map((p) => p.rubro).filter(Boolean))).sort(),
    [items],
  );

  const comunas = useMemo(
    () => Array.from(new Set(items.map((p) => p.comuna).filter(Boolean))).sort(),
    [items],
  );

  const filtrados = useMemo(() => {
    const hoyStr = enDias(0);
    const base = items.filter(
      (p) =>
        (filtro === "todos" || p.estado === filtro) &&
        (quick === "" ||
          (quick === "hot" && p.estado === "nuevo" && p.score >= 70) ||
          (quick === "sin_respuesta" && p.estado === "contactado") ||
          (quick === "seguir_hoy" &&
            p.proxima_accion != null &&
            p.proxima_accion <= hoyStr &&
            p.estado !== "descartado" &&
            p.estado !== "en_pipeline")) &&
        (rubro === "todos" || p.rubro === rubro) &&
        (comuna === "todos" || p.comuna === comuna) &&
        (q === "" ||
          `${p.nombre} ${p.rubro} ${p.comuna}`
            .toLowerCase()
            .includes(q.toLowerCase())),
    );
    const s = [...base];
    switch (orden) {
      case "score":
        s.sort((a, b) => b.score - a.score);
        break;
      case "recientes":
        s.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "nombre":
        s.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        break;
      case "rubro":
        s.sort((a, b) => a.rubro.localeCompare(b.rubro, "es") || b.score - a.score);
        break;
      case "comuna":
        s.sort((a, b) => a.comuna.localeCompare(b.comuna, "es") || b.score - a.score);
        break;
    }
    return s;
  }, [items, filtro, quick, rubro, comuna, q, orden]);

  async function cambiarEstado(id: string, estado: Estado) {
    const anterior = items.find((p) => p.id === id);
    setEstadoError(null);

    // Cadencia automática (regla del kit): al marcar "contactado" sin fecha se
    // agenda el follow-up 1 a +3 días; al marcar "respondió" sin fecha se agenda
    // responder HOY (un lead que contestó no puede esperar).
    const autoProxima =
      estado === "contactado" && anterior && !anterior.proxima_accion
        ? enDias(3)
        : estado === "respondio" && anterior && !anterior.proxima_accion
          ? enDias(0)
          : undefined;

    setItems((actuales) =>
      actuales.map((p) =>
        p.id === id
          ? { ...p, estado, proxima_accion: autoProxima ?? p.proxima_accion }
          : p,
      ),
    );

    try {
      const res = await fetch(`/api/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado,
          ...(autoProxima ? { proxima_accion: autoProxima } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar");
      if (data.prospect?.estado) {
        setItems((actuales) =>
          actuales.map((p) =>
            p.id === id ? { ...p, estado: data.prospect.estado } : p,
          ),
        );
      }
    } catch (err: any) {
      if (anterior) {
        setItems((actuales) =>
          actuales.map((p) => (p.id === id ? anterior : p)),
        );
      }
      setEstadoError(err.message ?? "No se pudo actualizar el estado");
    }
  }

  async function borrarTodos() {
    if (items.length === 0) return;
    if (
      !confirm(
        `Vas a borrar TODOS los prospectos (${items.length}). Esto no se puede deshacer. ¿Continuar?`,
      )
    )
      return;
    if (!confirm("Última confirmación: ¿borrar absolutamente todo y partir de cero?")) return;
    setEstadoError(null);
    try {
      const res = await fetch("/api/prospects", {
        method: "DELETE",
        headers: { "x-confirm": "BORRAR-TODO" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setItems([]);
      router.refresh();
    } catch (err: any) {
      setEstadoError(`No se pudo borrar todo: ${err.message}`);
    }
  }

  async function eliminar(p: Prospect) {
    if (!confirm(`¿Eliminar el prospecto "${p.nombre}"? Esto no se puede deshacer.`)) return;
    setEstadoError(null);
    const previos = items;
    setItems((actuales) => actuales.filter((x) => x.id !== p.id));
    try {
      const res = await fetch(`/api/prospects/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      router.refresh();
    } catch (err: any) {
      setItems(previos);
      setEstadoError(`No se pudo eliminar: ${err.message}`);
    }
  }

  async function copiarMensaje(p: Prospect) {
    if (!p.mensaje) return;
    await navigator.clipboard.writeText(p.mensaje);
    setCopiado(p.id);
    setTimeout(() => setCopiado(null), 1500);
  }

  async function copiarTexto(id: string, texto: string) {
    await navigator.clipboard.writeText(texto);
    setCopiado(id);
    setTimeout(() => setCopiado(null), 1500);
  }

  function toggleDetalle(p: Prospect) {
    setIaVariantes([]);
    setIaTipo(null);
    setIaError(null);
    if (abierto === p.id) {
      setAbierto(null);
      return;
    }
    setAbierto(p.id);
    setProxDraft(p.proxima_accion ?? "");
    setNotasDraft(p.notas ?? "");
    if (!contactos[p.id]) cargarContactos(p.id);
  }

  /** Carga los contactos de encargado ya buscados para este prospecto. */
  async function cargarContactos(id: string) {
    try {
      const res = await fetch(`/api/prospects/${id}/contactos`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar");
      setContactos((c) => ({ ...c, [id]: data.contactos ?? [] }));
    } catch {
      // Silencioso: esto es un enriquecimiento opcional, no debe bloquear el detalle.
    }
  }

  /** Busca al encargado del área elegida, con la fuente elegida (IA / Hunter / Apollo). */
  async function buscarContacto(p: Prospect) {
    setContactoLoading(p.id);
    setContactoError((e) => ({ ...e, [p.id]: "" }));
    try {
      const area = areaSel[p.id] ?? "gerencia_general";
      const fuente = fuenteSel[p.id] ?? "todas";
      const res = await fetch(`/api/prospects/${p.id}/contactos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area_objetivo: area, fuente }),
      });
      const data = await leerRespuesta(res);
      if (!res.ok) throw new Error(data.error ?? "No se pudo buscar");
      // Apollo devuelve varios candidatos a la vez (data.contactos); las
      // demás fuentes devuelven uno solo (data.contacto).
      const nuevos: ContactoDecision[] = data.contactos ?? (data.contacto ? [data.contacto] : []);
      if (nuevos.length === 0 && data.motivo) {
        setContactoError((e) => ({ ...e, [p.id]: data.motivo }));
      }
      if (nuevos.length > 0) {
        setContactos((c) => ({ ...c, [p.id]: [...nuevos, ...(c[p.id] ?? [])] }));
      }
    } catch (err: any) {
      setContactoError((e) => ({ ...e, [p.id]: err.message ?? "Error al buscar" }));
    } finally {
      setContactoLoading(null);
    }
  }

  /** Revela email/teléfono de un candidato de Apollo o Lusha — gasta crédito, por eso pide confirmación. */
  async function revelarContacto(p: Prospect, contactoId: string, fuente: Fuente | string) {
    const mensaje =
      fuente === "lusha" || fuente === "hunter_lusha"
        ? "Esto gasta crédito de tu plan gratuito de Lusha (1 por email, 5 por teléfono). ¿Continuar?"
        : "Esto gasta 1 crédito de tu plan gratuito de Apollo. ¿Continuar?";
    if (!confirm(mensaje)) return;
    setRevelandoId(contactoId);
    setContactoError((e) => ({ ...e, [p.id]: "" }));
    try {
      const res = await fetch(`/api/prospects/${p.id}/contactos/${contactoId}/revelar`, {
        method: "POST",
      });
      const data = await leerRespuesta(res);
      if (!res.ok) throw new Error(data.error ?? "No se pudo revelar");
      setContactos((c) => ({
        ...c,
        [p.id]: (c[p.id] ?? []).map((x) => (x.id === contactoId ? data.contacto : x)),
      }));
    } catch (err: any) {
      setContactoError((e) => ({ ...e, [p.id]: err.message ?? "Error al revelar" }));
    } finally {
      setRevelandoId(null);
    }
  }

  /** El humano confirma (o desmarca) que revisó el dato antes de contactar. */
  async function marcarVerificado(p: Prospect, contactoId: string, verificado: boolean) {
    setContactos((c) => ({
      ...c,
      [p.id]: (c[p.id] ?? []).map((x) => (x.id === contactoId ? { ...x, verificado } : x)),
    }));
    await fetch(`/api/prospects/${p.id}/contactos/${contactoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificado }),
    });
  }

  async function eliminarContacto(p: Prospect, contactoId: string) {
    if (!confirm("¿Eliminar este contacto?")) return;
    setContactos((c) => ({ ...c, [p.id]: (c[p.id] ?? []).filter((x) => x.id !== contactoId) }));
    await fetch(`/api/prospects/${p.id}/contactos/${contactoId}`, { method: "DELETE" });
  }

  async function generarIA(
    p: Prospect,
    tipo: "primero" | "follow1" | "reactivacion",
  ) {
    setIaLoading(true);
    setIaError(null);
    setIaTipo(tipo);
    setIaVariantes([]);
    try {
      const res = await fetch(`/api/prospects/${p.id}/mensaje`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setIaVariantes(data.variantes ?? []);
    } catch (e: any) {
      setIaError(e.message ?? "No se pudo generar");
    } finally {
      setIaLoading(false);
    }
  }

  async function usarComoMensaje(p: Prospect, texto: string) {
    setItems((actuales) =>
      actuales.map((x) => (x.id === p.id ? { ...x, mensaje: texto } : x)),
    );
    await fetch(`/api/prospects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: texto }),
    });
  }

  /** Guarda próxima acción + notas de la fila expandida. */
  async function guardarDetalle(p: Prospect) {
    if (guardandoDetalle) return;
    setGuardandoDetalle(true);
    setEstadoError(null);
    try {
      const res = await fetch(`/api/prospects/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proxima_accion: proxDraft || null,
          notas: notasDraft || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      setItems((actuales) =>
        actuales.map((x) =>
          x.id === p.id
            ? { ...x, proxima_accion: proxDraft || null, notas: notasDraft || null }
            : x,
        ),
      );
    } catch (err: any) {
      setEstadoError(`No se pudo guardar: ${err.message}`);
    } finally {
      setGuardandoDetalle(false);
    }
  }

  async function aPipeline(p: Prospect) {
    await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospect_id: p.id }),
    });
    router.push("/pipeline");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          className="input w-48 py-2 text-xs"
        />
        <select
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          className="input w-auto py-2 text-xs"
          aria-label="Filtrar por rubro"
        >
          <option value="todos">Todos los rubros</option>
          {rubros.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={comuna}
          onChange={(e) => setComuna(e.target.value)}
          className="input w-auto py-2 text-xs"
          aria-label="Filtrar por comuna"
        >
          <option value="todos">Todas las comunas</option>
          {comunas.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value as Orden)}
          className="input w-auto py-2 text-xs"
          aria-label="Ordenar por"
        >
          {ORDEN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>Ordenar: {o.label}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          {[{ value: "todos" as const, label: "Todos" }, ...ESTADO_OPTIONS].map(
            (estado) => (
            <button
              key={estado.value}
              onClick={() => {
                setFiltro(estado.value);
                setQuick("");
              }}
              className={`chip transition ${
                filtro === estado.value && quick === ""
                  ? "border-brand/50 bg-brand/10 text-brand"
                  : "hover:text-ink"
              }`}
            >
              {estado.label}
            </button>
            ),
          )}
          <button
            onClick={() => {
              setQuick(quick === "hot" ? "" : "hot");
              setFiltro("todos");
            }}
            className={`chip transition ${
              quick === "hot"
                ? "border-ok/50 bg-ok/10 text-ok"
                : "hover:text-ink"
            }`}
            title="Prospectos nuevos con score ≥ 70 — contactar primero"
          >
            ⚡ Calientes s/contactar
          </button>
          <button
            onClick={() => {
              setQuick(quick === "sin_respuesta" ? "" : "sin_respuesta");
              setFiltro("todos");
            }}
            className={`chip transition ${
              quick === "sin_respuesta"
                ? "border-warn/50 bg-warn/10 text-warn"
                : "hover:text-ink"
            }`}
            title="Contactados que aún no responden — candidatos a follow-up"
          >
            ⏳ Sin respuesta
          </button>
          <button
            onClick={() => {
              setQuick(quick === "seguir_hoy" ? "" : "seguir_hoy");
              setFiltro("todos");
            }}
            className={`chip transition ${
              quick === "seguir_hoy"
                ? "border-accent/50 bg-accent/10 text-accent"
                : "hover:text-ink"
            }`}
            title="Prospectos con seguimiento agendado para hoy o vencido — que ninguno se caiga"
          >
            ⏰ Seguir hoy
          </button>
        </div>
        <span className="ml-auto flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-ink-dim">
            {filtrados.length} prospectos
          </span>
          <button
            onClick={() => descargarCSV(filtrados)}
            disabled={filtrados.length === 0}
            className="btn-ghost px-3 py-1.5"
            title="Descarga lo filtrado como CSV (se abre en Excel)"
          >
            ⬇ Exportar a Excel
          </button>
          <a
            href="/api/prospects/csv-llamadas"
            className="btn-ghost px-3 py-1.5"
            title="Excel de llamadas del día: 40 mejores con score ≥70 y teléfono. Marca la ronda (no se repiten hasta 7 días). Re-descargarlo el mismo día entrega la misma lista."
          >
            📞 Llamadas del día
          </a>
          <button
            onClick={borrarTodos}
            disabled={items.length === 0}
            className="btn-ghost px-3 py-1.5 hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
            title="Borra todos los prospectos para partir de cero (pide doble confirmación)"
          >
            🗑 Borrar todos
          </button>
        </span>
      </div>
      {estadoError && (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {estadoError}
        </p>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-3/60">
              <th className="lbl px-5 py-3 font-normal">Score</th>
              <th className="lbl px-5 py-3 font-normal">Negocio</th>
              <th className="lbl px-5 py-3 font-normal">Señales</th>
              <th className="lbl px-5 py-3 font-normal">Estado</th>
              <th className="lbl px-5 py-3 font-normal">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtrados.map((p) => {
              const sc = scoreCls(p.score);
              const wa = linkWhatsApp(p);
              const rSlug = matchRubroSlug(p.rubro);
              const rc = rSlug ? rubroPorSlug(rSlug) : null;
              return (
                <Fragment key={p.id}>
                  <tr className="data-row">
                    <td className="px-5 py-4 align-top">
                      <span className={`font-mono text-xl ${sc.text}`}>
                        {p.score}
                      </span>
                      <span
                        className="mt-2 block h-[3px] w-16 overflow-hidden rounded-full bg-surface-3"
                        title={p.razon_score ?? undefined}
                      >
                        <span
                          className={`block h-full ${sc.bar}`}
                          style={{ width: `${p.score}%` }}
                        />
                      </span>
                    </td>
                    <td className="max-w-60 px-5 py-4 align-top">
                      <div className="truncate text-[15px] font-semibold">
                        {p.nombre}
                      </div>
                      <div className="mt-1 text-[11px] text-ink-dim">
                        {p.rubro} · {p.comuna}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-wrap gap-1">
                        {p.senales_web?.potencial === "alto" && (
                          <span className="chip border-ok/40 bg-ok/10 px-1.5 py-0 text-[10px] font-semibold text-ok">
                            {p.senales_web?.solo_redes
                              ? "SOLO REDES"
                              : p.senales_web?.celular_whatsapp
                                ? "SOLO WHATSAPP"
                                : p.senales_web?.formulario_hora
                                  ? "FORMULARIO"
                                  : "MANUAL"}
                          </span>
                        )}
                        {p.senales_web?.potencial === "bajo" && (
                          <span className="chip border-danger/40 bg-danger/10 px-1.5 py-0 text-[10px] font-semibold text-danger">
                            {p.senales_web?.chatbot
                              ? `BOT: ${p.senales_web.chatbot}`
                              : p.senales_web?.reservas
                                ? `AGENDA: ${p.senales_web.reservas}`
                                : "AUTOMATIZADO"}
                          </span>
                        )}
                        {!p.web && (
                          <span className="chip border-warn/30 px-1.5 py-0 text-[10px] text-warn">
                            Sin web
                          </span>
                        )}
                        {p.rating != null && (
                          <span className="chip px-1.5 py-0 text-[10px]">
                            ★ {p.rating} ·{" "}
                            <span className="font-mono">{p.reviews ?? 0}</span>
                          </span>
                        )}
                        {p.telefono && (
                          <span className="chip px-1.5 py-0 font-mono text-[10px]">
                            {p.telefono}
                          </span>
                        )}
                        {p.web && (
                          <a
                            href={p.web}
                            target="_blank"
                            rel="noreferrer"
                            className="chip px-1.5 py-0 text-[10px] underline hover:text-ink"
                          >
                            Web
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <select
                        value={p.estado}
                        onChange={(e) =>
                          cambiarEstado(p.id, e.target.value as Estado)
                        }
                        className={`rounded-full border bg-surface-3 px-2 py-1 text-[11px] outline-none transition focus:border-brand ${ESTADO_PILL[p.estado]}`}
                      >
                        {ESTADO_OPTIONS.map((estado) => (
                          <option key={estado.value} value={estado.value}>
                            {estado.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-ok/40 bg-ok/10 px-2.5 py-1 text-xs font-medium text-ok transition hover:bg-ok/20"
                            title="Abre WhatsApp con el mensaje listo (envío manual)"
                          >
                            WhatsApp
                          </a>
                        )}
                        <button
                          onClick={() => copiarMensaje(p)}
                          disabled={!p.mensaje}
                          className="btn-ghost"
                        >
                          {copiado === p.id ? "Copiado ✓" : "Copiar"}
                        </button>
                        <button
                          onClick={() => toggleDetalle(p)}
                          className={`btn-ghost ${abierto === p.id ? "border-brand/40 text-brand" : ""}`}
                          title="Razón del score, mensaje, follow-ups, próxima acción y notas"
                        >
                          {abierto === p.id ? "Cerrar" : "Detalle"}
                        </button>
                        {p.estado !== ESTADO_CONFIG.en_pipeline.value && (
                          <button
                            onClick={() => aPipeline(p)}
                            className="btn-ghost"
                          >
                            → Pipeline
                          </button>
                        )}
                        <button
                          onClick={() => eliminar(p)}
                          className="btn-ghost hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                          aria-label={`Eliminar ${p.nombre}`}
                          title="Eliminar prospecto"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                  {abierto === p.id && (
                    <tr>
                      <td colSpan={5} className="px-3 pb-4 pt-0">
                        <div className="ml-0 grid gap-3 rounded-lg border border-line bg-surface-3/45 p-4 sm:ml-12 lg:grid-cols-[1.2fr_1fr]">
                          {/* Columna izquierda: score explicado + mensaje */}
                          <div className="flex flex-col gap-3">
                            <div>
                              <div className="lbl mb-1.5">Por qué score {p.score}</div>
                              <p className="text-[12.5px] leading-relaxed text-ink-soft">
                                {p.razon_score || "Sin razón registrada (score por defecto)."}
                              </p>
                              <p className="mt-1.5 text-[12px] text-ink-mut">
                                <span className="font-medium text-brand">Acción recomendada:</span>{" "}
                                {accionRecomendada(p)}
                              </p>
                            </div>
                            {p.mensaje && (
                              <div>
                                <div className="lbl mb-1.5">Primer mensaje</div>
                                <div className="rounded-lg border-l-2 border-ok bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                                  <p className="whitespace-pre-wrap">{p.mensaje}</p>
                                </div>
                              </div>
                            )}
                            <div>
                              <div className="lbl mb-1.5">Follow-ups sugeridos (copiar)</div>
                              <div className="flex flex-wrap gap-1.5">
                                {plantillasPara(p).map((t) => (
                                  <button
                                    key={t.id}
                                    onClick={() => copiarTexto(`${p.id}-${t.id}`, t.genera(p))}
                                    className="btn-ghost px-2.5 py-1"
                                    title={t.genera(p).slice(0, 140) + "…"}
                                  >
                                    {copiado === `${p.id}-${t.id}` ? "Copiado ✓" : t.label}
                                  </button>
                                ))}
                              </div>
                              <p className="mt-1.5 text-[10.5px] text-warn">
                                Envío manual desde tu WhatsApp Business — nunca por Cloud API.
                                Revisa los [corchetes] antes de enviar.
                              </p>
                            </div>
                            {/* Mensajes con IA — voz de fundador, 2 variantes por toque */}
                            <div>
                              <div className="lbl mb-1.5">✨ Mensajes con IA (voz de fundador)</div>
                              <div className="flex flex-wrap gap-1.5">
                                <button onClick={() => generarIA(p, "primero")} disabled={iaLoading} className="btn-ghost px-2.5 py-1">
                                  Primer mensaje
                                </button>
                                <button onClick={() => generarIA(p, "follow1")} disabled={iaLoading} className="btn-ghost px-2.5 py-1">
                                  Follow-up 1
                                </button>
                                <button onClick={() => generarIA(p, "reactivacion")} disabled={iaLoading} className="btn-ghost px-2.5 py-1">
                                  Reactivación
                                </button>
                              </div>
                              {iaLoading && (
                                <p className="mt-1.5 text-[11px] text-ink-dim">Generando 2 opciones…</p>
                              )}
                              {iaError && <p className="mt-1.5 text-[11px] text-danger">{iaError}</p>}
                              {iaVariantes.length > 0 && (
                                <div className="mt-2 flex flex-col gap-2">
                                  {iaVariantes.map((v, i) => (
                                    <div key={i} className="rounded-lg border border-brand/20 bg-brand/[0.04] px-3 py-2">
                                      <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-soft">{v}</p>
                                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        <button onClick={() => copiarTexto(`${p.id}-ia-${i}`, v)} className="btn-ghost px-2 py-0.5 text-[10px]">
                                          {copiado === `${p.id}-ia-${i}` ? "Copiado ✓" : "Copiar"}
                                        </button>
                                        {iaTipo === "primero" && (
                                          <button onClick={() => usarComoMensaje(p, v)} className="btn-ghost px-2 py-0.5 text-[10px]">
                                            Usar como primer mensaje
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <p className="mt-1.5 text-[10px] text-ink-dim">
                                2 opciones con ángulos distintos. Vuelve a tocar el botón para pedir otras.
                              </p>
                            </div>
                            {rc && (
                              <div>
                                <div className="lbl mb-1.5">Contenido para este rubro</div>
                                <div className="rounded-lg border border-brand/20 bg-brand/[0.04] px-3 py-2.5">
                                  <p className="text-[12.5px] font-medium text-ink">{rc.formula_sin}</p>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {[rc.ideas_reel[0], rc.ideas_post[0], rc.ideas_carrusel[0]]
                                      .filter((x): x is string => Boolean(x))
                                      .map((idea, i) => (
                                        <button
                                          key={i}
                                          onClick={() => copiarTexto(`${p.id}-rc-${i}`, idea)}
                                          className="btn-ghost px-2.5 py-1"
                                          title={idea}
                                        >
                                          {copiado === `${p.id}-rc-${i}`
                                            ? "Copiado ✓"
                                            : idea.length > 30
                                              ? idea.slice(0, 30) + "…"
                                              : idea}
                                        </button>
                                      ))}
                                  </div>
                                  <button
                                    onClick={() => copiarTexto(`${p.id}-rcmsg`, conDemo(rc.mensaje_prospeccion))}
                                    className="btn-ghost mt-1.5 px-2.5 py-1"
                                    title={conDemo(rc.mensaje_prospeccion)}
                                  >
                                    {copiado === `${p.id}-rcmsg` ? "Copiado ✓" : "Copiar mensaje del rubro"}
                                  </button>
                                  <a
                                    href={`/growth/rubros#${rc.slug}`}
                                    className="mt-1.5 block text-[11px] text-brand hover:underline"
                                  >
                                    Ver todo el contenido de {rc.nombre} →
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                          {/* Columna derecha: próxima acción + notas */}
                          <div className="flex flex-col gap-2.5">
                            <div>
                              <label className="lbl mb-1.5 block">Próxima acción (fecha)</label>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <input
                                  type="date"
                                  value={proxDraft}
                                  onChange={(e) => setProxDraft(e.target.value)}
                                  className="input w-auto py-1.5 text-xs"
                                />
                                <button onClick={() => setProxDraft(enDias(0))} className="btn-ghost px-2 py-1">Hoy</button>
                                <button onClick={() => setProxDraft(enDias(3))} className="btn-ghost px-2 py-1">+3d · F1</button>
                                <button onClick={() => setProxDraft(enDias(5))} className="btn-ghost px-2 py-1">+5d · F2</button>
                                <button onClick={() => setProxDraft(enDias(7))} className="btn-ghost px-2 py-1">+7d</button>
                              </div>
                            </div>
                            <div className="flex flex-1 flex-col">
                              <label className="lbl mb-1.5 block">Notas</label>
                              <textarea
                                value={notasDraft}
                                onChange={(e) => setNotasDraft(e.target.value)}
                                placeholder="Quién contesta, qué preguntaron, objeciones…"
                                rows={4}
                                className="input flex-1 resize-y text-xs"
                              />
                            </div>
                            <button
                              onClick={() => guardarDetalle(p)}
                              disabled={guardandoDetalle}
                              className="btn-primary self-end px-4 py-1.5 text-xs"
                            >
                              {guardandoDetalle ? "Guardando…" : "Guardar"}
                            </button>
                          </div>
                        </div>
                        <details className="mt-2 sm:ml-12">
                          <summary className="cursor-pointer select-none text-[12px] font-medium text-brand">
                            🧰 Kit de venta — objeciones y preguntas de diagnóstico
                          </summary>
                          <div className="mt-2 rounded-lg border border-line bg-surface-3/45 p-3">
                            <KitVenta />
                          </div>
                        </details>
                        <details className="mt-2 sm:ml-12">
                          <summary className="cursor-pointer select-none text-[12px] font-medium text-brand">
                            🎯 Contacto del encargado (beta) — prospección adicional
                          </summary>
                          <div className="mt-2 rounded-lg border border-line bg-surface-3/45 p-3">
                            <p className="mb-2 text-[11px] text-ink-dim">
                              Busca al encargado de un área específica — útil en negocios
                              medianos/grandes con áreas separadas. En una pyme chica el dueño
                              suele ser el mismo contacto de arriba: úsalo solo si tiene sentido
                              acá. Ningún dato se usa para contactar hasta que lo marques como
                              verificado.
                              <br />
                              <strong className="text-ink-soft">"Hunter + IA" (recomendado)</strong>{" "}
                              busca primero en Hunter (dato real) y usa la IA solo para
                              VERIFICAR que la persona sigue ahí y sumar teléfono/LinkedIn si
                              hay una fuente pública — nunca para inventar un nombre. Si Hunter
                              no encuentra nada, cae automáticamente a búsqueda 100% IA.
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <select
                                value={areaSel[p.id] ?? "gerencia_general"}
                                onChange={(e) =>
                                  setAreaSel((a) => ({
                                    ...a,
                                    [p.id]: e.target.value as AreaObjetivo,
                                  }))
                                }
                                className="input w-auto py-1.5 text-xs"
                                aria-label="Área objetivo"
                              >
                                {AREA_OBJETIVO_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={fuenteSel[p.id] ?? "todas"}
                                onChange={(e) =>
                                  setFuenteSel((f) => ({
                                    ...f,
                                    [p.id]: e.target.value as Fuente,
                                  }))
                                }
                                className="input w-auto py-1.5 text-xs"
                                aria-label="Fuente de búsqueda"
                              >
                                {FUENTES_CONTACTO.map((f) => (
                                  <option key={f} value={f} disabled={f === "apollo"}>
                                    {f === "apollo" ? `${FUENTE_LABEL[f]} (no disponible en plan gratuito)` : FUENTE_LABEL[f]}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => buscarContacto(p)}
                                disabled={contactoLoading === p.id}
                                className="btn-ghost px-2.5 py-1"
                              >
                                {contactoLoading === p.id ? "Buscando…" : "Buscar encargado"}
                              </button>
                            </div>
                            <p className="mt-1 text-[10.5px] text-ink-dim">
                              "Todas las fuentes" cruza Hunter + Lusha (y usa IA solo para verificar
                              si no hay cruce) — es la opción más confiable, pero gasta ~1 crédito
                              de Lusha y cupo de Hunter en CADA búsqueda (no solo al revelar). Si
                              quieres ahorrar créditos, usa "Hunter + IA" (100% gratis) o "Lusha"
                              solo. Apollo.io queda deshabilitado por ahora: confirmado con Apollo
                              (API_INACCESSIBLE) que "mixed_people/api_search" no está disponible en
                              el plan gratuito, sin importar la key.
                            </p>
                            {contactoError[p.id] && (
                              <p className="mt-1.5 text-[11px] text-danger">{contactoError[p.id]}</p>
                            )}
                            <div className="mt-2 flex flex-col gap-2">
                              {(contactos[p.id] ?? []).map((c) => (
                                <div
                                  key={c.id}
                                  className="rounded-lg border border-line2 bg-surface-2 px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`chip px-1.5 py-0 text-[10px] ${
                                        c.confianza === "alta"
                                          ? "border-ok/40 text-ok"
                                          : c.confianza === "media"
                                            ? "border-warn/40 text-warn"
                                            : "border-danger/40 text-danger"
                                      }`}
                                    >
                                      Confianza {c.confianza}
                                    </span>
                                    <span className="text-[11px] text-ink-dim">
                                      {AREA_OBJETIVO_LABEL[c.area_objetivo as AreaObjetivo] ??
                                        c.area_objetivo}
                                    </span>
                                    <span className="chip px-1.5 py-0 text-[10px] text-ink-mut">
                                      {FUENTE_LABEL[c.fuente as Fuente] ?? c.fuente}
                                    </span>
                                    {!c.verificado && (
                                      <span className="chip border-warn/40 px-1.5 py-0 text-[10px] text-warn">
                                        Sin verificar — no contactar aún
                                      </span>
                                    )}
                                  </div>
                                  {c.nombre ? (
                                    <>
                                      <p className="mt-1.5 text-[13px] font-semibold">
                                        {c.nombre}
                                        {c.cargo ? ` — ${c.cargo}` : ""}
                                      </p>
                                      <div className="mt-1 flex flex-wrap gap-2 text-[11.5px] text-ink-soft">
                                        {c.telefono && <span className="font-mono">{c.telefono}</span>}
                                        {c.email && <span>{c.email}</span>}
                                        {c.linkedin_url && (
                                          <a
                                            href={c.linkedin_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="underline hover:text-ink"
                                          >
                                            LinkedIn
                                          </a>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <p className="mt-1.5 text-[12px] text-ink-dim">
                                      No se encontró un encargado publicado para esta área.
                                    </p>
                                  )}
                                  {c.notas && (
                                    <p className="mt-1 text-[11px] text-ink-mut">{c.notas}</p>
                                  )}
                                  {c.fuentes.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      {c.fuentes.map((f, i) => (
                                        <a
                                          key={i}
                                          href={f.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-[10.5px] text-brand underline"
                                        >
                                          {f.titulo || "fuente"} ↗
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center gap-2.5">
                                    {((c.fuente === "apollo" && !c.telefono && !c.email) ||
                                      (c.lusha_contact_id && (!c.telefono || !c.email))) && (
                                      <button
                                        onClick={() => revelarContacto(p, c.id, c.fuente)}
                                        disabled={revelandoId === c.id}
                                        className="btn-ghost px-2 py-0.5 text-[10px] text-brand"
                                        title={`Consulta a ${c.lusha_contact_id ? "Lusha" : "Apollo"} el email/teléfono real de este candidato`}
                                      >
                                        {revelandoId === c.id
                                          ? "Revelando…"
                                          : c.lusha_contact_id
                                            ? "Revelar contacto (gasta crédito Lusha)"
                                            : "Revelar contacto (gasta 1 crédito Apollo)"}
                                      </button>
                                    )}
                                    <label className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                                      <input
                                        type="checkbox"
                                        checked={c.verificado}
                                        onChange={(e) =>
                                          marcarVerificado(p, c.id, e.target.checked)
                                        }
                                      />
                                      Verificado (lo confirmé yo)
                                    </label>
                                    <button
                                      onClick={() => eliminarContacto(p, c.id)}
                                      className="btn-ghost px-2 py-0.5 text-[10px] hover:border-danger/40 hover:text-danger"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {(contactos[p.id] ?? []).length === 0 && !contactoError[p.id] && (
                                <p className="text-[11px] text-ink-dim">
                                  Todavía no se ha buscado un encargado para este prospecto.
                                </p>
                              )}
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-ink-dim">
                  {items.length === 0
                    ? "Todavía no hay prospectos guardados. Busca un rubro + comuna arriba — el próximo cliente está en esa lista."
                    : "Nada calza con los filtros actuales. Límpialos o busca un rubro nuevo arriba."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
