"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clp, fechaCorta } from "@/lib/format";
import type { Cobro, Gasto } from "@/lib/types";

interface CobroConNombre extends Cobro {
  cliente_nombre: string;
}

function mesActual(): string {
  return new Date().toISOString().slice(0, 7);
}

const CATEGORIAS_SUGERIDAS = [
  "Dominio y hosting",
  "Marketing",
  "APIs e IA",
  "Herramientas",
  "Transporte",
  "Otros",
];

/** Mensualidad de referencia para "clientes que faltan": plan ancla
 *  Crecimiento ($149.000, estructura final jul-2026). Si ya hay clientes,
 *  se usa el promedio real de sus mensualidades. */
const MENSUALIDAD_REFERENCIA = 149000;

export default function Finanzas({
  gastosIniciales,
  mrrActual = 0,
  clientesActivos: nClientesActivos = 0,
}: {
  gastosIniciales: Gasto[];
  mrrActual?: number;
  clientesActivos?: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"cobros" | "gastos">("cobros");
  const [mes, setMes] = useState(mesActual());
  const [cobros, setCobros] = useState<CobroConNombre[]>([]);
  const [clientesActivos, setClientesActivos] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form gasto
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const cargarCobros = useCallback(async (m: string) => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/cobros?mes=${m}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setCobros(data.cobros ?? []);
      setClientesActivos(data.clientes_activos ?? 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarCobros(mes);
  }, [mes, cargarCobros]);

  async function generarCobros() {
    setError(null);
    const res = await fetch("/api/cobros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? `Error ${res.status}`);
    await cargarCobros(mes);
  }

  async function togglePagado(c: CobroConNombre) {
    const estado = c.estado === "pagado" ? "pendiente" : "pagado";
    const res = await fetch(`/api/cobros/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`No se pudo actualizar: ${data.error ?? res.status}`);
    }
    await cargarCobros(mes);
  }

  async function crearGasto(e: React.FormEvent) {
    e.preventDefault();
    if (!concepto.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gastos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concepto,
          monto: Number(monto) || 0,
          categoria: categoria || null,
          fecha,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setConcepto("");
      setMonto("");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminarGasto(g: Gasto) {
    if (!confirm(`¿Eliminar el gasto "${g.concepto}" (${clp(g.monto)})?`)) return;
    const res = await fetch(`/api/gastos/${g.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`No se pudo eliminar: ${data.error ?? res.status}`);
    }
    router.refresh();
  }

  const gastosDelMes = useMemo(
    () => gastosIniciales.filter((g) => g.fecha.startsWith(mes)),
    [gastosIniciales, mes],
  );
  const totalGastosMes = gastosDelMes.reduce((a, g) => a + g.monto, 0);
  const porCategoria = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const g of gastosDelMes) {
      const k = g.categoria ?? "Sin categoría";
      acc[k] = (acc[k] ?? 0) + g.monto;
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [gastosDelMes]);

  const cobrado = cobros.filter((c) => c.estado === "pagado").reduce((a, c) => a + c.monto, 0);
  const pendiente = cobros.filter((c) => c.estado === "pendiente").reduce((a, c) => a + c.monto, 0);

  // ---- Resumen founder: equilibrio y margen ----
  const margen = mrrActual - totalGastosMes;
  const mensualidadRef =
    nClientesActivos > 0 && mrrActual > 0
      ? mrrActual / nClientesActivos
      : MENSUALIDAD_REFERENCIA;
  const clientesFaltan =
    margen >= 0 ? 0 : Math.ceil((totalGastosMes - mrrActual) / mensualidadRef);

  return (
    <div>
      {/* ---- Resumen del negocio ---- */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="metric-card px-4 py-3.5">
          <div className="lbl">MRR actual</div>
          <div className="mt-1.5 font-mono text-2xl leading-none text-ok">{clp(mrrActual)}</div>
          <div className="mt-1.5 text-[10.5px] text-ink-dim">
            {nClientesActivos === 0
              ? "fase inicial — sin clientes aún"
              : `${nClientesActivos} cliente${nClientesActivos === 1 ? "" : "s"} activo${nClientesActivos === 1 ? "" : "s"}`}
          </div>
        </div>
        <div className="metric-card px-4 py-3.5">
          <div className="lbl">Margen del mes</div>
          <div className={`mt-1.5 font-mono text-2xl leading-none ${margen >= 0 ? "text-ok" : "text-danger"}`}>
            {clp(margen)}
          </div>
          <div className="mt-1.5 text-[10.5px] text-ink-dim">MRR − gastos de {mes}</div>
        </div>
        <div className="metric-card px-4 py-3.5">
          <div className="lbl">Punto de equilibrio</div>
          <div className="mt-1.5 font-mono text-2xl leading-none">
            {margen >= 0 ? "✓" : clientesFaltan}
          </div>
          <div className="mt-1.5 text-[10.5px] text-ink-dim">
            {margen >= 0
              ? "los gastos están cubiertos"
              : `cliente${clientesFaltan === 1 ? "" : "s"} más para cubrir gastos (ref. ${clp(Math.round(mensualidadRef))}/mes)`}
          </div>
        </div>
        <div className="metric-card px-4 py-3.5">
          <div className="lbl">Por cobrar ({mes})</div>
          <div className={`mt-1.5 font-mono text-2xl leading-none ${pendiente > 0 ? "text-warn" : ""}`}>
            {clp(pendiente)}
          </div>
          <div className="mt-1.5 text-[10.5px] text-ink-dim">
            {pendiente > 0 ? "hay mensualidades sin pagar" : "sin cobros pendientes"}
          </div>
        </div>
      </div>

      {totalGastosMes > mrrActual && (
        <p className="mb-4 rounded-lg border border-warn/30 bg-warn/[0.07] px-3 py-2 text-xs text-warn">
          ⚠ Los gastos del mes ({clp(totalGastosMes)}) superan el MRR ({clp(mrrActual)}).
          {nClientesActivos === 0
            ? " Normal en fase de validación — cada cliente cerrado acorta esta brecha."
            : ` Faltan ~${clientesFaltan} cliente${clientesFaltan === 1 ? "" : "s"} para el equilibrio.`}
        </p>
      )}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex overflow-hidden rounded-lg border border-line2">
          <button
            onClick={() => setTab("cobros")}
            className={`px-4 py-2 text-sm transition ${tab === "cobros" ? "bg-brand/10 font-medium text-brand" : "bg-surface-2 text-ink-mut hover:bg-surface-3"}`}
          >
            Cobros
          </button>
          <button
            onClick={() => setTab("gastos")}
            className={`px-4 py-2 text-sm transition ${tab === "gastos" ? "bg-brand/10 font-medium text-brand" : "bg-surface-2 text-ink-mut hover:bg-surface-3"}`}
          >
            Gastos
          </button>
        </span>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="input w-auto py-1.5 text-sm"
          aria-label="Mes"
        />
        <span className="ml-auto flex gap-3">
          <span className="metric-card px-4 py-2.5">
            <span className="lbl">Cobrado </span>
            <span className="ml-2 font-mono text-lg text-ok">{clp(cobrado)}</span>
          </span>
          <span className="metric-card px-4 py-2.5">
            <span className="lbl">Pendiente </span>
            <span className="ml-2 font-mono text-lg text-warn">{clp(pendiente)}</span>
          </span>
          <span className="metric-card px-4 py-2.5">
            <span className="lbl">Gastos </span>
            <span className="ml-2 font-mono text-lg text-danger">{clp(totalGastosMes)}</span>
          </span>
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {tab === "cobros" && (
        <div className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="lbl">Mensualidades de {mes}</span>
            <button onClick={generarCobros} className="btn-primary text-xs">
              Generar cobros del mes
            </button>
          </div>
          {cargando ? (
            <p className="text-sm text-ink-dim">Cargando…</p>
          ) : cobros.length === 0 ? (
            <p className="text-sm text-ink-dim">
              Sin cobros para este mes.{" "}
              {clientesActivos === 0
                ? "Cuando tengan clientes activos, el botón de arriba crea una fila por cada uno con su mensualidad."
                : `Hay ${clientesActivos} cliente(s) activo(s): usa "Generar cobros del mes".`}
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-line">
              {cobros.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className={`led ${c.estado === "pagado" ? "bg-ok" : "bg-warn"}`} />
                  <span className="flex-1 truncate text-[14px] font-medium">
                    {c.cliente_nombre}
                  </span>
                  <span className="font-mono text-sm">{clp(c.monto)}</span>
                  <button
                    onClick={() => togglePagado(c)}
                    className={`btn-ghost px-3 py-1 ${c.estado === "pagado" ? "border-ok/40 text-ok" : ""}`}
                  >
                    {c.estado === "pagado" ? "Pagado ✓" : "Marcar pagado"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "gastos" && (
        <div className="flex flex-col gap-4">
          <form onSubmit={crearGasto} className="panel-hot flex flex-wrap items-end gap-2.5 p-4">
            <div className="min-w-44 flex-1">
              <label className="lbl mb-1.5 block">Concepto</label>
              <input
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Dominio respondo.cl, campaña IG…"
                className="input"
              />
            </div>
            <div className="w-32">
              <label className="lbl mb-1.5 block">Monto CLP</label>
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="12000"
                className="input"
              />
            </div>
            <div className="w-44">
              <label className="lbl mb-1.5 block">Categoría</label>
              <input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                list="categorias-gasto"
                placeholder="Marketing"
                className="input"
              />
              <datalist id="categorias-gasto">
                {CATEGORIAS_SUGERIDAS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="lbl mb-1.5 block">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="input"
              />
            </div>
            <button type="submit" disabled={!concepto.trim() || saving} className="btn-primary text-xs">
              {saving ? "Guardando…" : "Agregar gasto"}
            </button>
          </form>

          {porCategoria.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {porCategoria.map(([cat, total]) => (
                <span key={cat} className="chip px-3 py-1">
                  {cat}: <span className="ml-1 font-mono">{clp(total)}</span>
                </span>
              ))}
            </div>
          )}

          <div className="panel p-5">
            <div className="lbl mb-3">Gastos de {mes}</div>
            {gastosDelMes.length === 0 ? (
              <p className="text-sm text-ink-dim">
                Sin gastos registrados este mes. Registra los gastos reales
                (dominio, APIs, marketing) para saber cuántos clientes necesitan
                para cubrir costos — ese número aparece arriba.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {gastosDelMes.map((g) => (
                  <div key={g.id} className="group flex items-center gap-3 py-2.5">
                    <span className="w-14 shrink-0 font-mono text-[11px] text-ink-dim">
                      {fechaCorta(`${g.fecha}T12:00:00`)}
                    </span>
                    <span className="flex-1 truncate text-[14px]">{g.concepto}</span>
                    {g.categoria && (
                      <span className="chip px-2 py-0 text-[10px]">{g.categoria}</span>
                    )}
                    {g.pagado_por && (
                      <span className="font-mono text-[10px] text-ink-faint">{g.pagado_por}</span>
                    )}
                    <span className="font-mono text-sm text-danger">-{clp(g.monto)}</span>
                    <button
                      onClick={() => eliminarGasto(g)}
                      className="btn-ghost hidden px-2 py-0.5 hover:border-danger/40 hover:bg-danger/10 hover:text-danger group-hover:inline-flex"
                      aria-label={`Eliminar ${g.concepto}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
