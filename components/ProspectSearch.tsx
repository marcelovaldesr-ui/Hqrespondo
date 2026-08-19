"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProspectSearch({
  onSuccess,
}: {
  onSuccess?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [rubro, setRubro] = useState("");
  const [comuna, setComuna] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!rubro || !comuna || loading) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubro, comuna }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      setMsg(
        `${data.nuevos} Prospectos nuevos agregados (${data.duplicados} ya existían)`,
      );
      await onSuccess?.();
      router.refresh();
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={buscar} className="panel-hot p-4">
      <div className="relative flex flex-wrap items-center gap-3">
        <span className="font-mono text-lg text-brand" aria-hidden="true">
          &gt;
        </span>
        <input
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
          placeholder="Rubro — clínica dental, taller mecánico…"
          className="input flex-1 border-0 bg-transparent px-1 font-mono text-[15px] font-semibold focus:border-0 focus:shadow-none"
          style={{ minWidth: 160 }}
        />
        <span className="font-mono text-lg text-ink-faint" aria-hidden="true">
          ·
        </span>
        <input
          value={comuna}
          onChange={(e) => setComuna(e.target.value)}
          placeholder="Comuna — Viña del Mar"
          className="input flex-1 border-0 bg-transparent px-1 font-mono text-[15px] font-semibold focus:border-0 focus:shadow-none"
          style={{ minWidth: 140 }}
        />
        <button
          type="submit"
          disabled={loading || !rubro || !comuna}
          className="btn-primary min-h-12 px-7 text-sm"
        >
          {loading ? "Buscando y Calificando…" : "Buscar y Calificar"}
        </button>
      </div>
      {msg && (
        <p
          className={`relative mt-3 px-1 font-mono text-xs ${msg.includes("Prospectos nuevos") ? "text-brand" : "text-danger"}`}
        >
          {msg}
        </p>
      )}
    </form>
  );
}
