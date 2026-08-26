"use client";

import { useMemo, useState } from "react";
import { clp } from "@/lib/format";
import {
  MESES,
  cajaObjetivo,
  cupoPromedio,
  excedentePromedio,
  hitos,
  proyectar,
  ticketPromedio,
  type FilaProyeccion,
  type Mezcla,
  type Supuestos,
} from "@/lib/proyeccion";
import { PLANES, PLAN_EXCEDENTE, PLAN_LABEL, PLAN_PRECIOS } from "@/lib/types";

const compacto = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}k`;
  return `${s}$${Math.round(a)}`;
};

type Escenario = { nombre: string; nota: string; s: Partial<Supuestos> };

/** Los escenarios son puntos de partida para discutir, no pronósticos. */
const ESCENARIOS: Record<string, Escenario> = {
  plan: {
    nombre: "El plan",
    nota: "3 clientes al mes hasta el 6, 5 de ahí en adelante. Es la meta, no la inercia.",
    s: { nuevos1: 3, nuevos2: 5, churn: 3, mezcla: { tino_solo: 0, inicial: 40, crecimiento: 45, empresa: 15 } },
  },
  prudente: {
    nombre: "Si cuesta más de lo pensado",
    nota: "2 y 3 al mes, y se fuga uno de cada 20 al mes.",
    s: { nuevos1: 2, nuevos2: 3, churn: 5, mezcla: { tino_solo: 0, inicial: 55, crecimiento: 35, empresa: 10 } },
  },
  inicial: {
    nombre: "Entrar barato",
    nota: "Mismo ritmo de venta, pero casi todo Inicial. Cierra más fácil y rinde bastante menos.",
    s: { nuevos1: 3, nuevos2: 5, churn: 3, mezcla: { tino_solo: 10, inicial: 75, crecimiento: 15, empresa: 0 } },
  },
  arriba: {
    nombre: "Apostar a Crecimiento",
    nota: "El plan del medio como caballo de batalla. Es la mezcla que sostiene un equipo de cuatro.",
    s: { nuevos1: 3, nuevos2: 5, churn: 3, mezcla: { tino_solo: 0, inicial: 25, crecimiento: 60, empresa: 15 } },
  },
};

interface Control {
  k: keyof Supuestos;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
  ayuda?: string;
}

const pct = (v: number) => `${v.toString().replace(".", ",")}%`;

const GRUPOS: { titulo: string; ctl: Control[] }[] = [
  {
    titulo: "Venta",
    ctl: [
      { k: "nuevos1", label: "Clientes nuevos al mes (meses 1 a 6)", min: 0, max: 10, step: 1, fmt: String },
      { k: "nuevos2", label: "Clientes nuevos al mes (mes 7 en adelante)", min: 0, max: 14, step: 1, fmt: String },
      {
        k: "reunionesPorCierre",
        label: "Reuniones válidas por cliente cerrado",
        min: 1, max: 15, step: 1, fmt: (v) => `${v} reuniones`,
        ayuda: "Si de cada 4 reuniones se cierra 1, son 4.",
      },
    ],
  },
  {
    titulo: "Retención y uso",
    ctl: [
      { k: "churn", label: "Fuga mensual de clientes", min: 0, max: 12, step: 0.5, fmt: pct },
      {
        k: "utilizacion",
        label: "Uso del cupo de conversaciones",
        min: 40, max: 180, step: 5, fmt: pct,
        ayuda: "Sobre 100% el cliente paga excedente — y también cuesta más.",
      },
      {
        k: "costoPorConversacion",
        label: "Costo directo por conversación",
        min: 0, max: 120, step: 5, fmt: clp,
        ayuda: "IA más plantilla de recordatorio. Contestar dentro de las 24 h que abre el cliente no lo cobra Meta.",
      },
    ],
  },
  {
    titulo: "Costos",
    ctl: [
      { k: "fijos", label: "Costos fijos al mes", min: 0, max: 2000000, step: 50000, fmt: clp },
      { k: "marketing", label: "Inversión en marketing al mes", min: 0, max: 2000000, step: 50000, fmt: clp },
      {
        k: "porReunion",
        label: "Pago por reunión válida conseguida",
        min: 0, max: 60000, step: 1000, fmt: clp,
        ayuda: "$8.000 acordado. Se paga a quien la consigue cuando no es un socio — hoy Amaro, mañana cualquiera. Costo variable puro: no pesa hasta que la reunión existe.",
      },
    ],
  },
  {
    titulo: "Reparto",
    ctl: [
      { k: "reinversion", label: "Porcentaje de la caja que se reinvierte", min: 0, max: 80, step: 5, fmt: pct },
      { k: "objetivo", label: "Retiro mensual objetivo por socio", min: 200000, max: 4000000, step: 50000, fmt: clp },
    ],
  },
  {
    titulo: "Capacidad",
    ctl: [
      {
        k: "personasOperando",
        label: "Personas sosteniendo implementación y soporte",
        min: 1, max: 8, step: 1, fmt: (v) => `${v} ${v === 1 ? "persona" : "personas"}`,
      },
      {
        k: "capacidadPorPersona",
        label: "Clientes que sostiene una persona",
        min: 4, max: 60, step: 2, fmt: (v) => `${v} clientes`,
        ayuda: "Sube solo si baja el tiempo de instalación. Es la métrica del norte.",
      },
    ],
  },
];

function Linea({
  filas,
  series,
  refLinea,
}: {
  filas: FilaProyeccion[];
  series: { nombre: string; datos: number[]; color: string }[];
  refLinea?: { v: number; label: string; color: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 900;
  const H = 320;
  const pad = { l: 62, r: 74, t: 14, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const maxV = Math.max(1, ...series.flatMap((s) => s.datos), refLinea?.v ?? 0);

  const ticks = useMemo(() => {
    const bruto = (maxV * 1.08) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto || 1)));
    const norm = bruto / mag;
    const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const t: number[] = [];
    for (let v = 0; v <= maxV * 1.08 + paso * 0.5; v += paso) t.push(v);
    return t;
  }, [maxV]);

  const top = ticks[ticks.length - 1] || 1;
  const x = (i: number) => pad.l + (i / (MESES - 1)) * iw;
  const y = (v: number) => pad.t + ih - (Math.max(0, v) / top) * ih;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} y1={y(t)} x2={pad.l + iw} y2={y(t)} stroke="rgba(29,27,22,0.10)" />
            <text x={pad.l - 9} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="#6A655B" fontFamily="monospace">
              {compacto(t)}
            </text>
          </g>
        ))}
        {[1, 6, 12, 18, 24, 30, 36].map((m) => (
          <text key={m} x={x(m - 1)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#6A655B" fontFamily="monospace">
            {m === 1 ? "mes 1" : m}
          </text>
        ))}

        {refLinea && refLinea.v > 0 && refLinea.v <= top && (
          <>
            <line
              x1={pad.l} y1={y(refLinea.v)} x2={pad.l + iw} y2={y(refLinea.v)}
              stroke={refLinea.color} strokeWidth="1.6" strokeDasharray="5 4" opacity="0.8"
            />
            <text x={pad.l + iw + 7} y={y(refLinea.v) + 4} fontSize="10.5" fill={refLinea.color} fontFamily="monospace">
              {refLinea.label}
            </text>
          </>
        )}

        {series.map((s) => (
          <path
            key={s.nombre}
            d={s.datos.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
            fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
          />
        ))}
        {series.map((s) => (
          <g key={`${s.nombre}-fin`}>
            <circle cx={x(MESES - 1)} cy={y(s.datos[MESES - 1])} r="4" fill={s.color} stroke="#FDFBF7" strokeWidth="2" />
          </g>
        ))}

        {hover !== null && (
          <>
            <line x1={x(hover)} y1={pad.t} x2={x(hover)} y2={pad.t + ih} stroke="rgba(29,27,22,0.30)" />
            {series.map((s) => (
              <circle key={s.nombre} cx={x(hover)} cy={y(s.datos[hover])} r="4.5" fill={s.color} stroke="#FDFBF7" strokeWidth="2" />
            ))}
          </>
        )}

        <rect
          x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent"
          onMouseMove={(e) => {
            const r = (e.target as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.max(0, Math.min(MESES - 1, Math.round(((px - pad.l) / iw) * (MESES - 1)))));
          }}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {hover !== null && (
        <div className="glass pointer-events-none absolute left-3 top-3 rounded-lg px-3 py-2 text-[12px]">
          <div className="lbl mb-1">Mes {hover + 1}</div>
          {series.map((s) => (
            <div key={s.nombre} className="flex items-center gap-2 text-ink-soft">
              <i className="h-[3px] w-3 rounded-full" style={{ background: s.color }} />
              {s.nombre}
              <b className="num ml-auto pl-3 text-ink">{clp(s.datos[hover])}</b>
            </div>
          ))}
          <div className="mt-1 flex items-center gap-2 border-t border-line pt-1 text-ink-mut">
            Clientes activos
            <b className="num ml-auto pl-3 text-ink">{Math.round(filas[hover].activos)}</b>
          </div>
          <div className="flex items-center gap-2 text-ink-mut">
            Por socio
            <b className="num ml-auto pl-3 text-ink">{clp(filas[hover].porSocio)}</b>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Proyeccion({
  clientesIniciales,
  mrrInicial,
  costoRealPorConversacion,
}: {
  clientesIniciales: number;
  mrrInicial: number;
  costoRealPorConversacion: number | null;
}) {
  const [s, setS] = useState<Supuestos>({
    nuevos1: 3,
    nuevos2: 5,
    mezcla: { tino_solo: 0, inicial: 40, crecimiento: 45, empresa: 15 },
    churn: 3,
    utilizacion: 105,
    costoPorConversacion: costoRealPorConversacion ?? 25,
    fijos: 150000,
    marketing: 400000,
    porReunion: 8000,
    reunionesPorCierre: 4,
    reinversion: 30,
    socios: 3,
    objetivo: 600000,
    capacidadPorPersona: 12,
    personasOperando: 2,
    clientesIniciales,
    mrrInicial,
  });
  const [escenario, setEscenario] = useState<string | null>("plan");
  const [verTabla, setVerTabla] = useState(false);

  const set = (k: keyof Supuestos, v: number) => {
    setEscenario(null);
    setS((p) => ({ ...p, [k]: v }));
  };
  const setMezcla = (p: keyof Mezcla, v: number) => {
    setEscenario(null);
    setS((prev) => ({ ...prev, mezcla: { ...prev.mezcla, [p]: v } }));
  };

  const filas = useMemo(() => proyectar(s, PLAN_EXCEDENTE), [s]);
  const h = useMemo(() => hitos(filas, s), [filas, s]);
  const ticket = ticketPromedio(s.mezcla);
  const cupo = cupoPromedio(s.mezcla);
  const precioExc = excedentePromedio(s.mezcla, PLAN_EXCEDENTE);
  const objetivoCaja = cajaObjetivo(s);
  const r24 = filas[23];
  const r36 = filas[35];

  // Contraste: la misma cantidad de clientes, pero vendiendo casi todo Inicial.
  const filasInicial = useMemo(
    () => proyectar({ ...s, mezcla: { tino_solo: 10, inicial: 75, crecimiento: 15, empresa: 0 } }, PLAN_EXCEDENTE),
    [s],
  );
  const razon = filasInicial[23].mrr > 0 ? r24.mrr / filasInicial[23].mrr : 0;

  const totalMezcla = PLANES.reduce((a, p) => a + Math.max(0, s.mezcla[p]), 0);

  return (
    <div className="space-y-4">
      {clientesIniciales === 0 && (
        <div className="panel border-warn/30 p-3 text-[12.5px] text-ink-soft">
          <span className="lbl text-warn">Punto de partida</span>{" "}
          Todavía no hay clientes cargados en HQ, así que el modelo parte de cero. Cuando cargues
          los clientes reales en <span className="text-ink">Clientes &amp; Bots</span>, esta pantalla
          arranca desde el recurrente que ya existe en vez de desde el mes cero.
        </div>
      )}

      {/* ---------- escenarios ---------- */}
      <div className="panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(ESCENARIOS).map(([k, e]) => (
            <button
              key={k}
              onClick={() => {
                setEscenario(k);
                setS((p) => ({ ...p, ...e.s }));
              }}
              className={
                escenario === k
                  ? "rounded-full border border-brand bg-brand px-3.5 py-1.5 text-[12.5px] font-medium text-white"
                  : "rounded-full border border-line2 bg-surface-3 px-3.5 py-1.5 text-[12.5px] text-ink-mut transition hover:border-brand/50 hover:text-ink"
              }
            >
              {e.nombre}
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-[12.5px] text-ink-mut">
          {escenario ? ESCENARIOS[escenario].nota : "Supuestos propios. Toca un escenario para volver a un punto conocido."}
        </p>
      </div>

      {/* ---------- KPIs ---------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="metric-card">
          <div className="lbl mb-1.5">Recurrente al mes 24</div>
          <div className="num text-[26px] font-semibold leading-none">{compacto(r24.mrr)}</div>
          <div className="mt-1.5 text-[12px] text-ink-mut">{Math.round(r24.activos)} clientes activos</div>
        </div>
        <div className="metric-card">
          <div className="lbl mb-1.5">Retiro por socio al mes 24</div>
          <div className="num text-[26px] font-semibold leading-none">{compacto(r24.porSocio)}</div>
          <div className="mt-1.5 text-[12px] text-ink-mut">
            entre {s.socios} socios, reinvirtiendo {s.reinversion}%
          </div>
        </div>
        <div className="metric-card">
          <div className="lbl mb-1.5">Cada socio llega a {compacto(s.objetivo)}</div>
          <div className={`num text-[26px] font-semibold leading-none ${h.objetivo ? "text-ok" : "text-warn"}`}>
            {h.objetivo ? `Mes ${h.objetivo.mes}` : "No llega en 36"}
          </div>
          <div className="mt-1.5 text-[12px] text-ink-mut">
            {h.breakeven ? `Caja positiva desde el mes ${h.breakeven.mes}` : "La caja nunca llega a positiva"}
          </div>
        </div>
        <div className="metric-card">
          <div className="lbl mb-1.5">Ticket promedio de la mezcla</div>
          <div className="num text-[26px] font-semibold leading-none">{compacto(ticket)}</div>
          <div className="mt-1.5 text-[12px] text-ink-mut">
            neto, sin IVA · cupo {Math.round(cupo).toLocaleString("es-CL")} conversaciones
          </div>
        </div>
      </div>

      {/* ---------- mezcla ---------- */}
      <div className="panel p-4">
        <h2 className="ttl text-[15px]">Qué se vende</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-mut">
          Pesos relativos, no porcentajes: se normalizan solos. De acá salen el ticket promedio, el
          cupo de conversaciones y el precio del excedente.
        </p>
        <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {PLANES.map((p) => {
            const share = totalMezcla > 0 ? (Math.max(0, s.mezcla[p]) / totalMezcla) * 100 : 0;
            return (
              <div key={p}>
                <label className="mb-1.5 flex items-baseline justify-between text-[12.5px] text-ink-soft">
                  <span>
                    {PLAN_LABEL[p]}{" "}
                    <span className="num text-ink-dim">{clp(PLAN_PRECIOS[p].mensual)}</span>
                  </span>
                  <span className="num font-semibold text-ink">{share.toFixed(0)}%</span>
                </label>
                <input
                  type="range" min={0} max={100} step={5} value={s.mezcla[p]}
                  onChange={(e) => setMezcla(p, Number(e.target.value))}
                  className="w-full accent-brand"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- supuestos ---------- */}
      <div className="panel p-4">
        <h2 className="ttl text-[15px]">Supuestos</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-mut">
          Todo en pesos netos. La implementación no aparece porque hoy va incluida: la tabla vigente
          dice setup $0.
        </p>
        <div className="mt-4 space-y-5">
          {GRUPOS.map((g) => (
            <div key={g.titulo}>
              <div className="lbl mb-2.5">{g.titulo}</div>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.ctl.map((c) => (
                  <div key={c.k}>
                    <label className="mb-1.5 flex items-baseline justify-between gap-3 text-[12.5px] text-ink-soft">
                      <span>{c.label}</span>
                      <span className="num shrink-0 font-semibold text-ink">{c.fmt(s[c.k] as number)}</span>
                    </label>
                    <input
                      type="range" min={c.min} max={c.max} step={c.step} value={s[c.k] as number}
                      onChange={(e) => set(c.k, Number(e.target.value))}
                      className="w-full accent-brand"
                    />
                    {c.ayuda && <p className="mt-1 text-[11.5px] leading-snug text-ink-dim">{c.ayuda}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div>
            <div className="lbl mb-2.5">Equipo</div>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[12.5px] text-ink-soft">Socios que se reparten la caja</label>
                <select
                  value={s.socios}
                  onChange={(e) => set("socios", Number(e.target.value))}
                  className="input py-1.5 text-[13px]"
                >
                  {[2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n} socios</option>
                  ))}
                </select>
                <p className="mt-1 text-[11.5px] leading-snug text-ink-dim">
                  Quien consigue reuniones y no es socio no entra acá: cobra por reunión válida y
                  ya está contado en costos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- gráfico ---------- */}
      <div className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="ttl text-[15px]">Recurrente y caja, 36 meses</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-mut">
              El recurrente es lo que se acumula. La caja del mes descuenta costos, marketing y lo
              que se paga por las reuniones conseguidas ese mes.
            </p>
          </div>
          <button className="btn-ghost" onClick={() => setVerTabla((v) => !v)}>
            {verTabla ? "Ver como gráfico" : "Ver como tabla"}
          </button>
        </div>

        <div className="mb-3 mt-3 flex flex-wrap gap-4 text-[12px] text-ink-mut">
          <span className="flex items-center gap-2"><i className="h-[3px] w-4 rounded-full bg-series-1" />Recurrente</span>
          <span className="flex items-center gap-2"><i className="h-[3px] w-4 rounded-full bg-series-3" />Caja del mes</span>
          <span className="flex items-center gap-2"><i className="h-[3px] w-4 rounded-full bg-ok" />Caja necesaria para el retiro objetivo</span>
        </div>

        {verTabla ? (
          <Tabla filas={filas} />
        ) : (
          <Linea
            filas={filas}
            series={[
              { nombre: "Recurrente", datos: filas.map((f) => f.mrr), color: "#5C42C4" },
              { nombre: "Caja del mes", datos: filas.map((f) => Math.max(0, f.caja)), color: "#B4553F" },
            ]}
            refLinea={{ v: objetivoCaja, label: "objetivo", color: "#2F6B45" }}
          />
        )}

        <p className="mt-3 text-[12.5px] text-ink-mut">
          La línea verde es la caja que hace falta para que cada socio retire {clp(s.objetivo)} al
          mes siendo {s.socios} y reinvirtiendo {s.reinversion}%.{" "}
          {h.objetivo
            ? `Con estos supuestos se cruza en el mes ${h.objetivo.mes}.`
            : "Con estos supuestos no se cruza en 36 meses: hay que vender más, vender más caro, o ser menos socios."}
        </p>
      </div>

      {/* ---------- mezcla vs mezcla ---------- */}
      <div className="panel p-4">
        <h2 className="ttl text-[15px]">La misma venta, distinta mezcla</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-mut">
          Mismos clientes al mes, mismo trabajo de prospección e implementación. Lo único que cambia
          es cuál plan se cierra. Es la comparación que decide si el equipo se sostiene.
        </p>
        <div className="mb-3 mt-3 flex flex-wrap gap-4 text-[12px] text-ink-mut">
          <span className="flex items-center gap-2"><i className="h-[3px] w-4 rounded-full bg-series-1" />Tu mezcla</span>
          <span className="flex items-center gap-2"><i className="h-[3px] w-4 rounded-full bg-series-2" />Casi todo Inicial</span>
        </div>
        <Linea
          filas={filas}
          series={[
            { nombre: "Tu mezcla", datos: filas.map((f) => f.mrr), color: "#5C42C4" },
            { nombre: "Casi todo Inicial", datos: filasInicial.map((f) => f.mrr), color: "#1B7F92" },
          ]}
        />
        <p className="mt-3 text-[12.5px] text-ink-mut">
          {razon >= 1.05
            ? `Al mes 24 tu mezcla rinde ${razon.toFixed(1).replace(".", ",")} veces lo que rinde vender casi todo Inicial. Esa diferencia no se consigue trabajando más horas.`
            : "Con esta mezcla el resultado es parecido al de vender casi todo Inicial. Mueve los pesos hacia Crecimiento para ver la diferencia."}
        </p>
      </div>

      {/* ---------- hitos ---------- */}
      <div className="panel p-4">
        <h2 className="ttl text-[15px]">Los meses que importan</h2>
        <div className="mt-3 overflow-x-auto">
          <Tabla filas={[6, 12, 18, 24, 36].map((m) => filas[m - 1])} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Hito
            titulo="Cuándo deja de costar plata"
            valor={h.breakeven ? `Mes ${h.breakeven.mes}` : "Nunca en 36"}
            nota={
              h.recuperaInversion
                ? `La caja acumulada vuelve a cero en el mes ${h.recuperaInversion.mes}.`
                : "La caja acumulada sigue en rojo al mes 36."
            }
          />
          <Hito
            titulo="Cuándo el equipo no da abasto"
            valor={h.techoOperativo ? `Mes ${h.techoOperativo.mes}` : "No se cruza en 36"}
            nota={
              h.techoOperativo
                ? `Ahí la base pasa los ${s.capacidadPorPersona * s.personasOperando} clientes que ${s.personasOperando} ${s.personasOperando === 1 ? "persona sostiene" : "personas sostienen"}. De ese mes en adelante la curva de arriba supone una capacidad que todavía no existe: o se contrata, o baja el tiempo de instalación, o el crecimiento se frena solo.`
                : "Con esta capacidad el equipo aguanta todo el horizonte del modelo."
            }
          />
          <Hito
            titulo="Cuándo hace falta el cuarto integrante"
            valor={h.doceClientes ? `Mes ${h.doceClientes.mes}` : "No llega en 36"}
            nota={
              h.doceClientes
                ? `Son 12 clientes activos y ${compacto(h.doceClientes.mrr)} de recurrente: implementar deja de caber en el tiempo disponible y la caja ya alcanza para un sueldo.`
                : "Con este ritmo no se llega a 12 clientes activos en el horizonte del modelo."
            }
          />
        </div>
      </div>

      {/* ---------- qué cambió ---------- */}
      <details className="panel p-4 [&_summary]:cursor-pointer">
        <summary className="ttl text-[15px] marker:text-ink-dim">
          Qué cambió desde el modelo de julio
        </summary>
        <div className="mt-3 space-y-3 text-[12.5px] leading-relaxed text-ink-soft">
          <p className="text-ink-mut">
            El modelo original se armó cuando Respondo era un chatbot de WhatsApp que se vendía a
            $39.990 con implementación aparte. Estos son los supuestos suyos que ya no son ciertos, y
            ninguno es cosmético.
          </p>
          <Cambio
            titulo="La implementación ya no se cobra"
            antes="$390.000 por cliente. El modelo decía de eso que era «literalmente la caja de los primeros seis meses»."
            ahora="Setup $0: la instalación va incluida (tabla vigente, migración 018 del 12-ago-2026). Toda la caja tiene que salir del recurrente, y eso atrasa el punto en que el negocio se paga solo."
          />
          <Cambio
            titulo="Ya no hay un ticket, hay una mezcla"
            antes="Un «ticket promedio» de $200.000 puesto a mano, y la comparación se hacía contra los planes de julio ($39.990 + setup $290.000)."
            ahora="Cuatro planes reales con precio, cupo de conversaciones y precio de excedente. El ticket sale de cuál se cierra, y la comparación útil pasó a ser entre mezclas."
          />
          <Cambio
            titulo="Los 14 días de prueba cuestan"
            antes="El cliente facturaba completo desde el mes en que entraba."
            ahora="El mes de entrada rinde algo más de la mitad, y el cliente ya consume conversaciones desde el día uno. Una prueba larga no es gratis."
          />
          <Cambio
            titulo="El costo variable salió del porcentaje"
            antes="Un 20% del recurrente elegido a dedo."
            ahora="Costo por conversación, sobre el mismo cupo que se vende. Así el margen del plan sale del plan. Contestar dentro de la ventana de 24 h que abre el cliente no lo cobra Meta, que es justo el caso de Tino."
          />
          <Cambio
            titulo="Los excedentes no existían en el modelo"
            antes="No aparecían por ningún lado."
            ahora="Cada conversación sobre el cupo se factura entre $50 y $90 según el plan. Es ingreso que crece sin vender nada nuevo."
          />
          <Cambio
            titulo="Quien consigue las reuniones no estaba"
            antes="Toda la caja se repartía entre socios y no había ninguna línea de costo comercial."
            ahora="$8.000 por cada reunión válida conseguida, para cualquiera que las consiga y no sea socio. No reparte caja: es costo variable atado al embudo, y sube justo cuando sube la venta."
          />
          <Cambio
            titulo="El roadmap del modelo ya se cumplió"
            antes="Planificaba recordatorios para agosto, agenda para septiembre y recuperación de inactivos para octubre."
            ahora="Agenda, recordatorios y los cuatro asistentes ya existen. Esa parte del documento es historia, no plan, y por eso no se trajo a esta pantalla."
          />
          <Cambio
            titulo="El techo operativo ahora se avisa"
            antes="La curva crecía para siempre. El texto reconocía que el límite lo pone la instalación, pero el modelo no lo mostraba."
            ahora="Cuando la base pasa lo que el equipo puede sostener, la pantalla lo dice. Es la diferencia entre una proyección y un deseo."
          />
          <div className="subpanel p-3">
            <div className="lbl mb-1.5">Dos fechas que siguen en pie</div>
            <p>
              La <b className="text-ink">Ley 21.719</b> de datos personales entra en plena vigencia
              el <b className="text-ink">1 de diciembre de 2026</b>, con multas de hasta 20.000 UTM
              por infracción gravísima. Llegar con eso resuelto es, además, argumento de venta.
            </p>
            <p className="mt-2">
              Meta empezó a cobrarles a los <b className="text-ink">proveedores de IA</b> los
              mensajes fuera de plantilla: Italia desde el 16 de febrero de 2026 y otros 30 países
              desde el 11 de marzo, incluido Brasil. Chile todavía no está en la lista, pero que
              Brasil sí lo esté es motivo suficiente para mirar el control de costo por conversación
              de vez en cuando.
            </p>
          </div>
        </div>
      </details>

      {/* ---------- de dónde sale cada número ---------- */}
      <div className="panel p-4">
        <h2 className="ttl text-[15px]">De dónde sale cada número</h2>
        <div className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-ink-soft">
          <p>
            <b className="text-ink">Ticket promedio ({clp(ticket)}).</b> Sale de la mezcla de arriba
            aplicada a la tabla de planes vigente. No es un número elegido a mano.
          </p>
          <p>
            <b className="text-ink">Excedentes.</b> El cupo promedio de la mezcla es{" "}
            {Math.round(cupo).toLocaleString("es-CL")} conversaciones al mes.{" "}
            {s.utilizacion > 100 ? (
              <>
                Con {s.utilizacion}% de uso cada cliente pasa{" "}
                {Math.round(cupo * (s.utilizacion / 100) - cupo).toLocaleString("es-CL")}{" "}
                conversaciones, a {clp(precioExc)} cada una. Nunca se corta el servicio: se avisa al
                80% y al 100% del cupo.
              </>
            ) : (
              <>
                Con {s.utilizacion}% de uso nadie pasa el cupo, así que no hay excedentes. Sube el
                control para ver cuánto aportan cuando la base usa de más.
              </>
            )}
          </p>
          <p>
            <b className="text-ink">Costo variable.</b> Es la misma conversación que se vende, por{" "}
            {clp(s.costoPorConversacion)}. El modelo anterior usaba un porcentaje suelto del
            recurrente; acá el cupo del plan manda el costo y el excedente a la vez, que es la única
            forma de que el margen salga del plan.
            {costoRealPorConversacion !== null && " Este valor viene del costo real registrado en los eventos de bots."}
          </p>
          <p>
            <b className="text-ink">Los 14 días de prueba.</b> El cliente que entra este mes factura
            algo más de la mitad, y ya genera costo completo. Es la parte que hace que una prueba
            larga cueste plata de verdad.
          </p>
          <p>
            <b className="text-ink">Las reuniones.</b> {s.reunionesPorCierre} reuniones válidas por
            cierre, a {clp(s.porReunion)} cada una para quien la consigue si no es socio. Al mes 24
            son {Math.round(r24.reuniones)} reuniones y {clp(r24.costoReuniones)} al mes. No reparte
            caja porque no es socio: es costo, y sube justo cuando sube la venta.
          </p>
          <p className="text-ink-mut">
            Todos los montos son netos, sin IVA, igual que la tabla de planes. Al mes 36 el
            recurrente anual sería {compacto(r36.mrr * 12)}.
          </p>
        </div>
      </div>
    </div>
  );
}

function Cambio({ titulo, antes, ahora }: { titulo: string; antes: string; ahora: string }) {
  return (
    <div className="subpanel p-3">
      <div className="mb-1.5 font-medium text-ink">{titulo}</div>
      <p className="text-ink-dim">
        <span className="lbl mr-1.5">Antes</span>
        {antes}
      </p>
      <p className="mt-1.5">
        <span className="lbl mr-1.5 text-brand">Ahora</span>
        {ahora}
      </p>
    </div>
  );
}

function Hito({ titulo, valor, nota }: { titulo: string; valor: string; nota: string }) {
  return (
    <div className="subpanel p-3.5">
      <div className="lbl mb-1.5">{titulo}</div>
      <div className="num text-[19px] font-semibold text-ink">{valor}</div>
      <p className="mt-1.5 text-[12px] leading-snug text-ink-mut">{nota}</p>
    </div>
  );
}

function Tabla({ filas }: { filas: FilaProyeccion[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right text-[12.5px]">
        <thead>
          <tr className="lbl border-b border-line2 [&>th]:pb-2 [&>th]:pl-3 [&>th]:font-mono">
            <th className="text-left">Mes</th>
            <th>Clientes</th>
            <th>Recurrente</th>
            <th>Excedentes</th>
            <th>Costos</th>
            <th>Reuniones</th>
            <th>Caja del mes</th>
            <th>Por socio</th>
          </tr>
        </thead>
        <tbody className="num">
          {filas.map((f) => (
            <tr key={f.mes} className="border-b border-line last:border-0 [&>td]:py-1.5 [&>td]:pl-3">
              <td className="text-left text-ink-mut">{f.mes}</td>
              <td>{Math.round(f.activos)}</td>
              <td>{clp(f.mrr)}</td>
              <td className="text-ink-mut">{clp(f.excedentes)}</td>
              <td className="text-ink-mut">{clp(f.costos)}</td>
              <td className="text-ink-mut">{clp(f.costoReuniones)}</td>
              <td className={f.caja >= 0 ? "text-ok" : "text-danger"}>{clp(f.caja)}</td>
              <td className="font-semibold">{clp(f.porSocio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
