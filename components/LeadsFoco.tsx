"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ENCAJE_LABEL, NIVELES_ENCAJE, senalesDeGuia, type NivelEncaje } from "@/lib/encaje";
import { secuenciaPara, verticalDe } from "@/lib/secuencias";
import {
  CONECTA_FOCO,
  ESTADO_FOCO_LABEL,
  MAX_SIN_CONTESTAR,
  RESULTADOS_FOCO,
  RESULTADO_CFG,
  type EstadoFoco,
  type LeadFoco,
  type ResumenFoco,
  type ResultadoFoco,
} from "@/lib/foco";
import NuevoLeadFoco from "@/components/NuevoLeadFoco";
import BitacoraLead from "@/components/BitacoraLead";

/**
 * Leads Foco — mesa de trabajo del segundo motor de prospección.
 *
 * DECISIONES DE DISEÑO
 * · Tabla densa a la izquierda, ficha del lead a la derecha. Se llama con la
 *   ficha abierta: acá cada llamada se prepara, no se marca en serie.
 * · El resultado se registra con un modal de 15 disposiciones cerradas. Notas
 *   libres no permiten calcular tasa de conexión — la misma lección de
 *   /llamadas, aplicada desde el día uno.
 * · Al registrar, la fila se actualiza en pantalla y el foco SALTA al
 *   siguiente lead pendiente. Sin ese salto, el operador vuelve a la tabla y
 *   pierde el hilo entre llamada y llamada.
 */

const TONO_CLASE: Record<string, string> = {
  ok: "border-ok/45 text-ok hover:bg-ok/10",
  warn: "border-warn/45 text-warn hover:bg-warn/10",
  danger: "border-danger/45 text-danger hover:bg-danger/10",
  neutro: "border-line2 text-ink-mut hover:bg-surface-4",
};

/** El encaje se lee de un vistazo por color: verde se trabaja, ámbar se
 *  confirma en la llamada, gris hay que mirarlo, rojo no se llama. */
const ENCAJE_CHIP: Record<NivelEncaje, string> = {
  alto: "border-ok/45 bg-ok/10 text-ok",
  medio: "border-warn/45 bg-warn/10 text-warn",
  sin_evaluar: "border-line2 bg-surface-4 text-ink-mut",
  bajo: "border-danger/35 bg-danger/5 text-danger/85",
  nulo: "border-danger/45 bg-danger/10 text-danger",
};

const ENCAJE_CORTO: Record<NivelEncaje, string> = {
  alto: "ALTO", medio: "MEDIO", sin_evaluar: "?", bajo: "BAJO", nulo: "NO",
};

const LED_ESTADO: Record<EstadoFoco, string> = {
  nuevo: "bg-brand led-glow-cyan",
  contactando: "bg-warn led-glow-amber",
  agendado: "bg-ok led-glow-green",
  ganado: "bg-ok led-glow-green",
  descartado: "bg-ink-faint",
};

function telLink(t: string): string {
  const d = t.replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("+")) return d;
  if (d.startsWith("56")) return `+${d}`;
  return `+56${d}`;
}

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
}

/** Un recordatorio con fecha de hoy o anterior es trabajo atrasado. */
function vencido(iso: string | null): boolean {
  return !!iso && new Date(iso).getTime() <= Date.now();
}

export default function LeadsFoco({
  filasIniciales,
  resumen,
  filtros,
  socios,
  yo,
}: {
  filasIniciales: LeadFoco[];
  resumen: ResumenFoco;
  filtros: {
    lista: string; estado: string; cargo: string; q: string; cola: string; encaje: string;
  };
  socios: string[];
  /** Quién está conectado, resuelto del login en el servidor. */
  yo: string;
}) {
  const router = useRouter();
  const [filas, setFilas] = useState(filasIniciales);
  const [sel, setSel] = useState<string | null>(filasIniciales[0]?.id ?? null);
  /** Cambiar de lead borra el resultado de la búsqueda anterior: si no, el
   *  mensaje de un lead queda pegado sobre el siguiente y se lee como suyo. */
  const elegir = useCallback((id: string | null) => {
    setSel(id);
    setResTel(null);
  }, []);
  const [busqueda, setBusqueda] = useState(filtros.q);
  const [modal, setModal] = useState(false);
  const [nota, setNota] = useState("");
  const [actor, setActor] = useState(socios.includes(yo) ? yo : socios[0] ?? "");
  // Misma llave que el selector de /llamadas: quien elige su nombre en una
  // pantalla ya está elegido en la otra.
  useEffect(() => {
    const g = window.localStorage.getItem("hq_quien_llama");
    if (g && socios.includes(g)) setActor(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function cambiarActor(n: string) {
    setActor(n);
    window.localStorage.setItem("hq_quien_llama", n);
  }
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notaFicha, setNotaFicha] = useState("");
  const [importar, setImportar] = useState(false);
  const [buscandoTel, setBuscandoTel] = useState(false);
  const [resTel, setResTel] = useState<{ ok: boolean; texto: string; detalle: string[] } | null>(null);
  const [csv, setCsv] = useState("");
  const [listaNueva, setListaNueva] = useState("lista_b");
  const [importando, setImportando] = useState(false);
  const [resImport, setResImport] = useState<string | null>(null);
  const [editandoEncaje, setEditandoEncaje] = useState(false);
  const [avisoPipeline, setAvisoPipeline] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [secuencia, setSecuencia] = useState(false);
  const [copiadoSec, setCopiadoSec] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Record<string, string>>({});
  const primeraCarga = useRef(true);

  // Cuando el servidor devuelve otra tanda (cambió un filtro), la tabla se
  // re-sincroniza. Sin esto la pantalla se queda pegada en los datos viejos.
  useEffect(() => {
    setFilas(filasIniciales);
    setSel((s) => (filasIniciales.some((f) => f.id === s) ? s : filasIniciales[0]?.id ?? null));
  }, [filasIniciales]);

  const lead = useMemo(() => filas.find((f) => f.id === sel) ?? null, [filas, sel]);
  useEffect(() => setNotaFicha(lead?.nota ?? ""), [lead?.id, lead?.nota]);
  useEffect(() => { setEditando(false); setSecuencia(false); }, [lead?.id]);

  const navegar = useCallback(
    (cambios: Partial<typeof filtros>) => {
      const p = new URLSearchParams();
      const f = { ...filtros, ...cambios };
      if (f.lista && f.lista !== "todas") p.set("lista", f.lista);
      if (f.estado && f.estado !== "activos") p.set("estado", f.estado);
      if (f.cargo && f.cargo !== "todos") p.set("cargo", f.cargo);
      if (f.q) p.set("q", f.q);
      if (f.cola && f.cola !== "hoy") p.set("cola", f.cola);
      if (f.encaje && f.encaje !== "sirven") p.set("encaje", f.encaje);
      router.push(`/foco${p.toString() ? `?${p}` : ""}`);
    },
    [filtros, router],
  );

  // Búsqueda con freno: se consulta al servidor 450 ms después de la última
  // tecla, no en cada letra.
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    if (busqueda === filtros.q) return;
    const t = setTimeout(() => navegar({ q: busqueda }), 450);
    return () => clearTimeout(t);
  }, [busqueda, filtros.q, navegar]);

  function siguientePendiente(desdeId: string): string | null {
    const i = filas.findIndex((f) => f.id === desdeId);
    for (let k = i + 1; k < filas.length; k++) {
      if (["nuevo", "contactando"].includes(filas[k].estado)) return filas[k].id;
    }
    return null;
  }

  async function registrar(resultado: ResultadoFoco) {
    if (!lead) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/foco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, resultado, nota, actor }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `HTTP ${res.status}`);
      setAvisoPipeline(
        j.dealCreado ? `${lead.empresa} entró al Pipeline como "Reunión agendada".` : null,
      );

      const cfg = RESULTADO_CFG[resultado];
      const retirado = !!j.retirado;
      const rec =
        retirado || cfg.reagendaDias === null
          ? null
          : new Date(Date.now() + cfg.reagendaDias * 864e5).toISOString();
      const siguiente = siguientePendiente(lead.id);
      // El espejo en pantalla imita TODO lo que hizo el servidor, incluido el
      // teléfono que se quita en "equivocado". Si el espejo queda a medias, la
      // ficha muestra un número que la base ya no tiene — y "probar la API no
      // prueba la pantalla" ya nos mordió una vez con los objetivos.
      setFilas((fs) =>
        fs.map((f) => {
          if (f.id !== lead.id) return f;
          const lineas: string[] = [];
          if (nota) lineas.push(`[${cfg.label}] ${nota}`);
          const quitaTelefono = resultado === "equivocado" && !!f.telefono;
          if (quitaTelefono) lineas.push(`Número equivocado: ${f.telefono} (se quitó de la ficha)`);
          if (retirado) lineas.push(`Retirado: ${MAX_SIN_CONTESTAR} llamadas sin contestar (regla de la base).`);
          const sinContestar =
            resultado === "no_contesta"
              ? f.sin_contestar + 1
              : CONECTA_FOCO.includes(resultado) || resultado === "gatekeeper" || resultado === "derivo"
                ? 0
                : f.sin_contestar;
          return {
            ...f,
            sin_contestar: sinContestar,
            estado: (retirado ? "descartado" : cfg.estado ?? f.estado) as EstadoFoco,
            ultimo_resultado: resultado,
            intentos: f.intentos + (cfg.cuentaIntento ? 1 : 0),
            ultimo_intento: new Date().toISOString(),
            recordatorio: rec,
            telefono: quitaTelefono ? "" : f.telefono,
            nota: lineas.length ? [f.nota, ...lineas].filter(Boolean).join("\n") : f.nota,
          };
        }),
      );
      setModal(false);
      setNota("");
      if (siguiente) elegir(siguiente);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function corregirEncaje(nivel: NivelEncaje) {
    if (!lead) return;
    setEditandoEncaje(false);
    const motivo = `Corregido a mano: ${ENCAJE_LABEL[nivel].toLowerCase()}.`;
    setFilas((fs) =>
      fs.map((f) =>
        f.id === lead.id
          ? { ...f, encaje: nivel, encaje_motivo: motivo, encaje_manual: true }
          : f,
      ),
    );
    try {
      await fetch("/api/foco", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, encaje: nivel, encaje_motivo: motivo }),
      });
    } catch {
      /* queda corregido en pantalla; se reintenta al volver a tocarlo */
    }
  }

  function abrirEdicion() {
    if (!lead) return;
    setBorrador({
      empresa: lead.empresa, contacto: lead.contacto, cargo: lead.cargo,
      telefono: lead.telefono, email: lead.email, web: lead.web,
      linkedin_contacto: lead.linkedin_contacto,
    });
    setEditando(true);
  }

  async function guardarEdicion() {
    if (!lead) return;
    setEditando(false);
    // Espejo primero, red después: lo escrito se ve al instante y si el PATCH
    // falla, el próximo guardado lo reintenta (el dato no se pierde de la vista).
    setFilas((fs) => fs.map((f) => (f.id === lead.id ? { ...f, ...borrador } : f)));
    try {
      await fetch("/api/foco", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, ...borrador }),
      });
      router.refresh(); // recalcula contactabilidad/contadores del servidor
    } catch {
      /* queda en pantalla; reintentar guardando de nuevo */
    }
  }

  async function guardarNota() {
    if (!lead || notaFicha === lead.nota) return;
    try {
      await fetch("/api/foco", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, nota: notaFicha }),
      });
      setFilas((fs) => fs.map((f) => (f.id === lead.id ? { ...f, nota: notaFicha } : f)));
    } catch {
      /* la nota queda en pantalla; el próximo blur reintenta */
    }
  }

  async function subirCSV() {
    setImportando(true);
    setResImport(null);
    try {
      const r = await fetch("/api/foco/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lista: listaNueva, csv }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setResImport(
        `${j.insertados} nuevos · ${j.actualizados} actualizados · ${j.conDecisor} con decisor · ${j.conTelefono} con teléfono${j.enLlamadas ? ` · ⚠ ${j.enLlamadas} también en Llamadas del día` : ""}`,
      );
      setCsv("");
      router.refresh();
    } catch (e) {
      setResImport(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImportando(false);
    }
  }

  /** Pide el teléfono de este lead a los proveedores de datos. Gasta créditos:
   *  por eso es un botón explícito, de a uno, y nunca se dispara solo. */
  const buscarTelefono = useCallback(async (leadId: string) => {
    setBuscandoTel(true);
    setResTel(null);
    try {
      const r = await fetch("/api/foco/telefono", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId }),
      });
      const d = await r.json();
      const detalle: string[] = (d.intentos ?? []).map(
        (i: { fuente: string; resultado: string }) => `${i.fuente}: ${i.resultado}`,
      );
      if (!r.ok) {
        setResTel({ ok: false, texto: d.error ?? "No se pudo buscar", detalle });
      } else if (d.telefono) {
        setResTel({
          ok: true,
          texto: `${d.telefono} — de ${d.fuente}, ${d.creditos} crédito${d.creditos === 1 ? "" : "s"}`,
          detalle,
        });
        router.refresh();
      } else {
        setResTel({ ok: false, texto: d.motivo ?? "Sin teléfono", detalle });
        if (d.email) router.refresh();
      }
    } catch (e: any) {
      setResTel({ ok: false, texto: e?.message ?? "Error de red", detalle: [] });
    } finally {
      setBuscandoTel(false);
    }
  }, [router]);

  // Teclado: ↑/↓ recorren la lista, Enter abre el modal. Se ignora mientras
  // se escribe en un campo, si no sería imposible tipear una nota.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t?.tagName)) return;
      if (modal) {
        if (e.key === "Escape") setModal(false);
        return;
      }
      const i = filas.findIndex((f) => f.id === sel);
      if (e.key === "ArrowDown" && i < filas.length - 1) {
        e.preventDefault();
        elegir(filas[i + 1].id);
      } else if (e.key === "ArrowUp" && i > 0) {
        e.preventDefault();
        elegir(filas[i - 1].id);
      } else if (e.key === "Enter" && lead) {
        e.preventDefault();
        setModal(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filas, sel, modal, lead]);

  const pendientes = filas.filter((f) => ["nuevo", "contactando"].includes(f.estado)).length;

  return (
    <div>
      {/* ---------- Encabezado ---------- */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex shrink-0 flex-col gap-[3px]" aria-hidden="true">
              <span className="block h-[3px] w-4 rounded-full bg-brand" />
              <span className="block h-[3px] w-2.5 rounded-full bg-coral/70" />
            </span>
            <h1 className="ttl truncate text-[17px] leading-tight">Leads Foco</h1>
            <span className="hidden border-l border-line2 pl-3 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-mut sm:inline">
              Decisor identificado · empresa mediana
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip">
              <span className="led bg-brand led-glow-cyan" /> {pendientes} por tocar
            </span>
            <NuevoLeadFoco />
            <button className="btn-ghost" onClick={() => setImportar(true)}>
              Importar CSV
            </button>
            <button className="btn-ghost" onClick={() => router.refresh()}>
              Actualizar
            </button>
          </div>
        </div>
        <div className="hairline" />
      </div>

      {avisoPipeline && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-[12.5px] text-ok">
          <span className="led bg-ok led-glow-green" />
          {avisoPipeline}
          <a href="/pipeline" className="ml-auto underline">
            Ver pipeline
          </a>
        </div>
      )}

      {/* ---------- Contadores ---------- */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-6">
        {[
          { l: "En la lista", v: resumen.total, d: `${resumen.listas.length} lista(s)` },
          { l: "Se trabajan", v: resumen.trabajables, d: "llamables Y con encaje" },
          { l: "Llamables", v: resumen.llamables, d: "con teléfono Y persona" },
          { l: "Con teléfono", v: resumen.conTelefono, d: `${resumen.conDecisor} con decisor` },
          { l: "Vencidos", v: resumen.vencidos, d: "promesa de llamar hoy" },
          { l: "Por investigar", v: resumen.porInvestigar, d: "encajan, falta el dato" },
        ].map((k) => (
          <div key={k.l} className="metric-card !p-3">
            <div className="lbl">{k.l}</div>
            <div className="num mt-1 text-[22px] font-semibold leading-none text-ink">{k.v}</div>
            <div className="mt-1 text-[10.5px] text-ink-faint">{k.d}</div>
          </div>
        ))}
      </div>

      {/* ---------- Filtros ---------- */}
      <div className="panel mb-3 flex flex-wrap items-center gap-2 p-2.5">
        <select
          className="input !w-auto !py-1.5 text-xs"
          value={filtros.lista}
          onChange={(e) => navegar({ lista: e.target.value })}
        >
          <option value="todas">Todas las listas</option>
          {resumen.listas.map((l) => (
            <option key={l.lista} value={l.lista}>
              {l.lista} ({l.n})
            </option>
          ))}
        </select>
        <select
          className="input !w-auto !py-1.5 text-xs"
          value={filtros.estado}
          onChange={(e) => navegar({ estado: e.target.value })}
        >
          <option value="activos">Activos ({resumen.activos})</option>
          <option value="procesados">Procesados ({resumen.procesados})</option>
          <option value="nuevo">Nuevos</option>
          <option value="contactando">Contactando</option>
          <option value="agendado">Agendados</option>
          <option value="descartado">Descartados</option>
        </select>
        <select
          className="input !w-auto !py-1.5 text-xs"
          value={filtros.cargo}
          onChange={(e) => navegar({ cargo: e.target.value })}
        >
          <option value="todos">Todos los cargos</option>
          {resumen.cargos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="input !w-auto !py-1.5 text-xs"
          value={filtros.encaje}
          onChange={(e) => navegar({ encaje: e.target.value })}
        >
          <option value="sirven">Los que sirven ({(resumen.porEncaje.alto ?? 0) + (resumen.porEncaje.medio ?? 0) + (resumen.porEncaje.sin_evaluar ?? 0)})</option>
          <option value="alto">Encaje alto ({resumen.porEncaje.alto ?? 0})</option>
          <option value="medio">Encaje medio ({resumen.porEncaje.medio ?? 0})</option>
          <option value="sin_evaluar">Sin evaluar ({resumen.porEncaje.sin_evaluar ?? 0})</option>
          <option value="todos">Todos, incluso los descartados</option>
        </select>
        <select
          className="input !w-auto !py-1.5 text-xs"
          value={filtros.cola}
          onChange={(e) => navegar({ cola: e.target.value })}
        >
          <option value="hoy">Cola de hoy (para llamar)</option>
          <option value="investigar">Por investigar ({resumen.porInvestigar})</option>
          <option value="todos">Todos (incl. agendados)</option>
        </select>
        <input
          className="input !w-72 !py-1.5 text-xs"
          placeholder="Buscar empresa, persona, cargo o teléfono…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <span className="ml-auto font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">
          {filas.length} en pantalla · ↑↓ mover · Enter registrar
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        {/* ---------- Tabla ---------- */}
        <div className="panel overflow-hidden lg:col-span-7 xl:col-span-8">
          <div className="max-h-[62vh] overflow-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-surface-3">
                <tr className="lbl">
                  <th className="px-2 py-2 font-medium">Encaje</th>
                  <th className="px-3 py-2 font-medium">Empresa</th>
                  <th className="px-3 py-2 font-medium">Contacto</th>
                  <th className="px-3 py-2 font-medium">Teléfono</th>
                  <th className="px-2 py-2 text-center font-medium">Int</th>
                  <th className="px-3 py-2 font-medium">Vuelve</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => elegir(f.id)}
                    className={`data-row cursor-pointer border-t border-line ${
                      f.id === sel ? "bg-brand/10" : ""
                    }`}
                  >
                    <td className="px-2 py-2">
                      <span
                        title={f.encaje_motivo}
                        className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9.5px] tracking-wider ${ENCAJE_CHIP[f.encaje]}`}
                      >
                        {ENCAJE_CORTO[f.encaje]}
                      </span>
                    </td>
                    <td className="max-w-[230px] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`led ${LED_ESTADO[f.estado]}`} title={ESTADO_FOCO_LABEL[f.estado]} />
                        <span className="truncate text-ink">{f.empresa}</span>
                      </div>
                      <div className="mt-0.5 truncate pl-[15px] text-[10.5px] text-ink-faint">
                        {[f.comuna, f.n_empleados ? `${f.n_empleados} trab.` : "", f.industria]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </td>
                    <td className="max-w-[190px] px-3 py-2">
                      <div className="truncate text-ink-mut">{f.contacto || "—"}</div>
                      <div className="mt-0.5 truncate text-[10.5px] text-ink-faint">{f.cargo || "sin cargo"}</div>
                    </td>
                    <td className="px-3 py-2">
                      {f.suprimido ? (
                        <span
                          className="inline-flex items-center gap-1 rounded border border-danger/45 bg-danger/10 px-1.5 py-0.5 font-mono text-[9.5px] tracking-wider text-danger"
                          title="Este número pidió no ser contactado. Vale para los dos motores."
                        >
                          SUPRIMIDO
                        </span>
                      ) : f.telefono ? (
                        <span className="num text-ink-mut">{f.telefono}</span>
                      ) : (
                        <span className="text-[10.5px] text-ink-faint">sin número</span>
                      )}
                    </td>
                    <td className="num px-2 py-2 text-center text-ink-mut">{f.intentos}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`num text-[11px] ${
                          vencido(f.recordatorio) ? "text-warn" : "text-ink-faint"
                        }`}
                      >
                        {fechaCorta(f.recordatorio)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-ink-faint">
                      No hay leads con estos filtros.
                      <br />
                      <span className="text-[11px]">
                        {filtros.encaje !== "todos"
                          ? "Ojo: la vista esconde los que no encajan con Respondo. Prueba el filtro «Todos, incluso los descartados» o el botón Importar CSV de arriba."
                          : "Importa una tanda con el botón «Importar CSV» de arriba."}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------- Ficha del lead ---------- */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="panel-hot brackets sticky top-4 p-4">
            {!lead ? (
              <div className="py-12 text-center text-sm text-ink-faint">
                Elige un lead de la lista.
              </div>
            ) : (
              <>
                <div className="lbl mb-2">Lead actual</div>
                <div className="ttl text-[15px] leading-tight">{lead.empresa}</div>
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  {[lead.razon_social, lead.rut].filter(Boolean).join(" · ") || "—"}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="chip">
                    <span className={`led ${LED_ESTADO[lead.estado]}`} />
                    {ESTADO_FOCO_LABEL[lead.estado]}
                  </span>
                  {lead.n_empleados ? <span className="chip">{lead.n_empleados} trab.</span> : null}
                  {lead.comuna ? <span className="chip">{lead.comuna}</span> : null}
                  <span className="chip">{lead.intentos} intento(s)</span>
                  {lead.tags.map((t) => (
                    <span
                      key={t}
                      className="chip border-accent/40 text-accent"
                      title="Este negocio también está en la base de Llamadas del día (Google Maps). Coordinar antes de marcar: puede que el mesón ya haya sido llamado."
                    >
                      {t}
                    </span>
                  ))}
                  {lead.sin_contestar > 0 && (
                    <span
                      className={`chip ${lead.sin_contestar >= MAX_SIN_CONTESTAR - 1 ? "border-warn/45 text-warn" : ""}`}
                      title={`A la ${MAX_SIN_CONTESTAR}ª sin contestar el lead sale solo de la base (regla TGP). Cualquier respuesta —portero incluido— reinicia el contador.`}
                    >
                      {lead.sin_contestar}/{MAX_SIN_CONTESTAR} sin contestar
                    </span>
                  )}
                </div>

                <div className="hairline my-3" />

                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="lbl">Persona y contacto</span>
                  {/* Era un enlace de 10px en gris tenue y nadie lo encontraba:
                      Marcelo pidió "una opción para editar" que llevaba semanas
                      ahí. Un botón que no se ve es un botón que no existe. */}
                  <button
                    className="btn-ghost !px-2 !py-0.5 text-[10.5px]"
                    onClick={() => (editando ? setEditando(false) : abrirEdicion())}
                  >
                    {editando ? "Cancelar" : "✎ Editar datos"}
                  </button>
                </div>
                {editando ? (
                  <div className="space-y-1.5">
                    {(
                      [
                        ["empresa", "Nombre de fantasía"],
                        ["contacto", "Persona (decisor)"],
                        ["cargo", "Cargo"],
                        ["telefono", "Teléfono"],
                        ["email", "Email"],
                        ["web", "Sitio web"],
                        ["linkedin_contacto", "LinkedIn de la persona"],
                      ] as const
                    ).map(([campo, rotulo]) => (
                      <input
                        key={campo}
                        className="input !py-1.5 text-[12px]"
                        placeholder={rotulo}
                        value={borrador[campo] ?? ""}
                        onChange={(e) => setBorrador((br) => ({ ...br, [campo]: e.target.value }))}
                      />
                    ))}
                    <button className="btn-primary w-full !py-1.5 text-[12.5px]" onClick={guardarEdicion}>
                      Guardar datos
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-ink">{lead.contacto || "— sin decisor identificado —"}</div>
                    <div className="text-[11px] text-ink-mut">{lead.cargo || "sin cargo"}</div>
                  </>
                )}

                {resTel && (
                  <div
                    className={`mt-2.5 rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed ${
                      resTel.ok ? "border-ok/40 bg-ok/10 text-ok" : "border-warn/40 bg-warn/10 text-warn"
                    }`}
                  >
                    {resTel.texto}
                    {resTel.detalle.length > 0 && (
                      <div className="mt-1 font-mono text-[10.5px] opacity-80">
                        {resTel.detalle.map((d) => (
                          <div key={d}>{d}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!editando && lead.suprimido && (
                  <div className="mt-2.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[11.5px] leading-relaxed text-danger">
                    Este número pidió <strong>no ser contactado</strong> (lista de
                    supresión, compartida con Llamadas del día). No llamar ni escribir
                    por WhatsApp; correo o LinkedIn siguen abiertos.
                  </div>
                )}
                <div className={`mt-2.5 flex flex-wrap gap-1.5 ${editando ? "hidden" : ""}`}>
                  {lead.telefono && !lead.suprimido && (
                    <>
                      <a className="btn-ghost" href={`tel:${telLink(lead.telefono)}`}>
                        📞 {lead.telefono}
                      </a>
                      <a
                        className="btn-ghost"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://wa.me/${telLink(lead.telefono).replace("+", "")}`}
                      >
                        WhatsApp
                      </a>
                    </>
                  )}
                  {lead.email && (
                    <a className="btn-ghost" href={`mailto:${lead.email}`}>
                      {lead.email}
                    </a>
                  )}
                  {lead.linkedin_contacto && (
                    <a className="btn-ghost" target="_blank" rel="noreferrer" href={lead.linkedin_contacto}>
                      LinkedIn persona
                    </a>
                  )}
                  {lead.linkedin_contacto && !lead.telefono && (
                    <button
                      className="btn-ghost !border-brand/45 !text-ink"
                      disabled={buscandoTel}
                      onClick={() => buscarTelefono(lead.id)}
                      title="Le pregunta el teléfono a Apollo y a Lusha usando el perfil de LinkedIn. Gasta créditos del plan."
                    >
                      {buscandoTel ? "Buscando…" : "Buscar teléfono"}
                    </button>
                  )}
                  {lead.web && (
                    <a className="btn-ghost" target="_blank" rel="noreferrer" href={lead.web}>
                      Sitio
                    </a>
                  )}
                  {lead.linkedin_empresa && (
                    <a className="btn-ghost" target="_blank" rel="noreferrer" href={lead.linkedin_empresa}>
                      LinkedIn empresa
                    </a>
                  )}
                </div>

                <div className="hairline my-3" />
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="lbl">¿Le sirve Respondo?</span>
                  <button
                    className="text-[10px] text-ink-faint underline hover:text-ink-mut"
                    onClick={() => setEditandoEncaje((v) => !v)}
                  >
                    {editandoEncaje ? "cancelar" : "corregir"}
                  </button>
                </div>
                {editandoEncaje ? (
                  <div className="flex flex-wrap gap-1.5">
                    {NIVELES_ENCAJE.map((n) => (
                      <button
                        key={n}
                        onClick={() => corregirEncaje(n)}
                        className={`rounded border px-2 py-1 font-mono text-[10px] tracking-wider ${ENCAJE_CHIP[n]}`}
                      >
                        {ENCAJE_LABEL[n]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] tracking-wider ${ENCAJE_CHIP[lead.encaje]}`}
                    >
                      {ENCAJE_LABEL[lead.encaje]}
                      {lead.encaje_manual ? " · a mano" : ""}
                    </span>
                    {lead.encaje_motivo && (
                      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-mut">
                        {lead.encaje_motivo}
                      </p>
                    )}
                  </>
                )}

                {senalesDeGuia(`${lead.senal} ${lead.encaje_motivo}`).length > 0 && (
                  <>
                    <div className="hairline my-3" />
                    <div className="lbl mb-1.5">Dolor visible · con qué abrir</div>
                    {senalesDeGuia(`${lead.senal} ${lead.encaje_motivo}`).map((sg) => (
                      <div
                        key={sg.nota}
                        className="mb-1.5 rounded-lg border border-ok/35 bg-ok/5 px-2.5 py-2"
                      >
                        <div className="text-[10.5px] uppercase tracking-wider text-ok">{sg.nota}</div>
                        <div className="mt-0.5 text-[12px] italic leading-relaxed text-ink-soft">
                          «{sg.frase}»
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* ---------- Fase 3: la señal vigente ----------
                    Va ARRIBA de "por qué llamarlos" y con otro color a
                    propósito: eso de abajo es lo que alguien escribió sobre por
                    qué este negocio encaja; esto es un hecho fechado y citable
                    que dice que tiene el problema AHORA. Quien llama tiene que
                    verlo antes de marcar, y poder abrir la fuente para no citar
                    de memoria un aviso que quizá ya bajaron. */}
                {lead.senal_reciente && (
                  <>
                    <div className="hairline my-3" />
                    <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-[0.13em] text-ok">
                          Señal vigente
                        </span>
                        {lead.senal_vigente_hasta && (
                          <span className="font-mono text-[9.5px] text-ink-faint">
                            hasta {fechaCorta(lead.senal_vigente_hasta)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12.5px] leading-snug text-ink">
                        {lead.senal_reciente}
                      </p>
                      {lead.senal_reciente_url && (
                        <a
                          className="mt-1 inline-block text-[10.5px] text-ok underline"
                          href={lead.senal_reciente_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          ver el aviso
                        </a>
                      )}
                    </div>
                  </>
                )}

                {lead.senal && (
                  <>
                    <div className="hairline my-3" />
                    <div className="lbl mb-1.5">Por qué llamarlos</div>
                    <p className="text-[12.5px] leading-relaxed text-ink-mut">{lead.senal}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-ink-faint">
                      <span>confianza: {lead.confianza || "—"}</span>
                      {lead.fuente_url && (
                        <a className="underline" target="_blank" rel="noreferrer" href={lead.fuente_url}>
                          fuente
                        </a>
                      )}
                    </div>
                  </>
                )}

                <div className="hairline my-3" />
                <div className="lbl mb-1.5">Notas</div>
                <textarea
                  className="input min-h-[70px] text-[12px]"
                  value={notaFicha}
                  onChange={(e) => setNotaFicha(e.target.value)}
                  onBlur={guardarNota}
                  placeholder="Lo que se dijo, con quién, qué quedó pendiente…"
                />

                <button className="btn-primary mt-3 w-full" onClick={() => setModal(true)}>
                  Registrar resultado
                </button>
                <button className="btn-ghost mt-1.5 w-full !py-1.5" onClick={() => setSecuencia(true)}>
                  Secuencia de correos
                </button>
                <div className="mt-1.5 text-center text-[10.5px] text-ink-faint">
                  Último: {lead.ultimo_resultado ? RESULTADO_CFG[lead.ultimo_resultado].label : "sin tocar"}
                  {lead.ultimo_intento ? ` · ${fechaCorta(lead.ultimo_intento)}` : ""}
                </div>

                <BitacoraLead key={lead.id} leadId={lead.id} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Secuencia de correos ---------- */}
      {secuencia && lead && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSecuencia(false)}
        >
          <div className="glass my-6 w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="lbl">Secuencia de correos en frío</div>
                <div className="ttl mt-1 text-[15px]">
                  {lead.empresa}
                  {lead.contacto ? ` · ${lead.contacto}` : ""}
                </div>
                <div className="mt-1 text-[11px] text-ink-faint">
                  {verticalDe(lead)
                    ? <>Secuencia de <b className="text-ink-mut">{verticalDe(lead)!.label}</b>, con los datos del lead ya puestos.</>
                    : "Sin secuencia para este rubro."}
                </div>
              </div>
              <button className="btn-ghost" onClick={() => setSecuencia(false)}>
                Cerrar
              </button>
            </div>

            {!secuenciaPara(lead) && (
              <div className="mt-4 rounded-lg border border-line bg-surface-3/60 p-4 text-[12.5px] leading-relaxed text-ink-mut">
                No hay secuencia escrita para este rubro. Las que existen son las seis del
                documento del equipo: clínicas dentales, clínicas estéticas, automotoras,
                inmobiliarias, gimnasios y centros boutique.
                <br />
                <span className="mt-1.5 block text-[11.5px] text-ink-faint">
                  Mandar el copy de otro rubro sería enviar referencias de clientes que no
                  aplican; preferible llamar, o escribir el correo a mano.
                </span>
              </div>
            )}
            {!lead.email && secuenciaPara(lead) && (
              <div className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[11.5px] text-warn">
                Este lead no tiene correo en la ficha. Consíguelo primero (o usa
                &quot;editar datos&quot; para anotarlo).
              </div>
            )}

            <div className="mt-4 space-y-3">
              {(secuenciaPara(lead) ?? []).map((c) => (
                <div key={c.n} className="rounded-lg border border-line bg-surface-3/60 p-3.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-ink">
                      Correo {c.n}{" "}
                      <span className="font-normal text-ink-dim">· {c.cuando}</span>
                    </span>
                    <button
                      className="btn-ghost"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(c.cuerpo);
                          setCopiadoSec(`c${c.n}`);
                          setTimeout(() => setCopiadoSec(null), 1200);
                        } catch { /* queda a la vista para seleccionarlo */ }
                      }}
                    >
                      {copiadoSec === `c${c.n}` ? "Copiado ✓" : "Copiar cuerpo"}
                    </button>
                  </div>
                  <div className="mb-2 space-y-1">
                    {(c.asuntoB
                      ? ([["A", c.asuntoA], ["B", c.asuntoB]] as const)
                      : ([["único", c.asuntoA]] as const)
                    ).map(([v, asunto]) => (
                      <div key={v} className="flex items-center gap-2">
                        <span className="lbl shrink-0">Asunto {v}</span>
                        <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-soft">
                          {asunto}
                        </span>
                        <button
                          className="btn-ghost !px-2 !py-0.5 !text-[10px]"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(asunto);
                              setCopiadoSec(`a${c.n}${v}`);
                              setTimeout(() => setCopiadoSec(null), 1200);
                            } catch { /* a la vista */ }
                          }}
                        >
                          {copiadoSec === `a${c.n}${v}` ? "✓" : "Copiar"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-ink-mut">
                    {c.cuerpo}
                  </pre>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10.5px] leading-relaxed text-ink-faint">
              Los asuntos A/B se alternan entre leads para poder comparar cuál abre más. El
              envío se hace desde el correo del equipo; acá solo se arma el texto.
            </p>
          </div>
        </div>
      )}

      {/* ---------- Modal de importación ---------- */}
      {importar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => !importando && setImportar(false)}
        >
          <div className="glass w-full max-w-3xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="lbl">Importar tanda</div>
            <div className="ttl mt-1 text-[15px]">Pegar CSV con encabezados</div>
            <div className="mt-2 space-y-2 text-[11.5px] leading-relaxed text-ink-mut">
              <p>
                Un lead de Foco es <b className="text-ink-soft">una persona dentro de una empresa</b>,
                no la empresa sola. Lo mínimo que sirve es{" "}
                <span className="font-mono text-ink-soft">empresa</span> y{" "}
                <span className="font-mono text-ink-soft">contacto</span>. Sin teléfono igual entra:
                queda en la lista esperando el número. Para llamar al mesón sin nombre, eso es
                Prospección, no Foco.
              </p>
              <p>
                De dónde sale cada columna: <b className="text-ink-soft">empresa, rubro, comuna,
                trabajadores y RUT</b> vienen del universo del SII;{" "}
                <b className="text-ink-soft">contacto y cargo</b>, del perfil de LinkedIn; el{" "}
                <b className="text-ink-soft">teléfono</b> lo devuelve Apollo después.
              </p>
              <p>
                Se aceptan los nombres del archivo de Lista B (
                <span className="font-mono">nombre_fantasia, decisor_nombre, decisor_cargo,
                telefono_publico, senal_dolor…</span>) y los genéricos. Reimportar el mismo archivo{" "}
                <b className="text-ink-soft">no duplica</b>: actualiza los datos y conserva intentos,
                resultado y notas. Por eso se puede cargar ahora sin teléfono y volver a pegar el
                mismo archivo cuando lleguen los números.
              </p>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                className="btn-ghost"
                onClick={() =>
                  setCsv(
                    "empresa,razon_social,rut,web,linkedin_empresa,industria,n_empleados,comuna,region,contacto,cargo,telefono,email,linkedin_contacto,senal,confianza,fuente_url\n",
                  )
                }
              >
                Pegar encabezados de ejemplo
              </button>
              <span className="text-[11px] text-ink-dim">
                Solo <span className="font-mono">empresa</span> es obligatoria. El resto, lo que tengas.
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="lbl">Lista</span>
              <input
                className="input !w-48 !py-1.5 text-xs"
                value={listaNueva}
                onChange={(e) => setListaNueva(e.target.value)}
                placeholder="nombre de la tanda"
              />
            </div>
            <textarea
              className="input mt-2 min-h-[220px] font-mono text-[11px]"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder="empresa,contacto,cargo,telefono,…"
            />
            <div className="mt-3 flex items-center gap-2">
              <button className="btn-primary" disabled={importando || !csv.trim()} onClick={subirCSV}>
                {importando ? "Importando…" : "Importar"}
              </button>
              <button className="btn-ghost" disabled={importando} onClick={() => setImportar(false)}>
                Cerrar
              </button>
              {resImport && (
                <span
                  className={`text-[12px] ${resImport.startsWith("Error") ? "text-danger" : "text-ok"}`}
                >
                  {resImport}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Modal de disposición ---------- */}
      {modal && lead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => !guardando && setModal(false)}
        >
          <div className="glass w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="lbl">Resultado de la llamada</div>
            <div className="ttl mt-1 text-[15px]">
              {lead.empresa} · {lead.contacto || "sin contacto"}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {RESULTADOS_FOCO.map((r) => {
                const c = RESULTADO_CFG[r];
                return (
                  <button
                    key={r}
                    disabled={guardando}
                    onClick={() => registrar(r)}
                    className={`rounded-lg border bg-surface-3 px-3 py-2 text-left text-[12.5px] transition disabled:opacity-40 ${TONO_CLASE[c.tono]}`}
                  >
                    <div className="font-medium">{c.label}</div>
                    <div className="mt-0.5 text-[10px] text-ink-faint">
                      {r === "no_contesta" && lead.sin_contestar >= MAX_SIN_CONTESTAR - 1 ? (
                        <span className="text-warn">
                          {MAX_SIN_CONTESTAR}ª sin contestar — sale de la base
                        </span>
                      ) : c.reagendaDias !== null ? (
                        `vuelve en ${c.reagendaDias}d`
                      ) : c.suprime ? (
                        "suprime el número"
                      ) : (
                        "cierra"
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <select
                className="input !w-auto !py-1.5 text-xs"
                value={actor}
                onChange={(e) => cambiarActor(e.target.value)}
              >
                {socios.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                className="input flex-1 !py-1.5 text-xs"
                placeholder="Nota del toque (opcional)"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
              />
              <button className="btn-ghost" disabled={guardando} onClick={() => setModal(false)}>
                Cancelar
              </button>
            </div>

            {error && <div className="mt-2 text-[12px] text-danger">{error}</div>}
            {guardando && <div className="mt-2 text-[12px] text-ink-faint">Guardando…</div>}
          </div>
        </div>
      )}
    </div>
  );
}
