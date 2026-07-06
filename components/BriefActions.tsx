"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ClienteOption {
  id: string;
  nombre: string;
}

export default function BriefActions({ clients }: { clients: ClienteOption[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"diario" | "mensual" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");

  async function generar() {
    if (loading) return;
    setLoading("diario");
    setError(null);
    try {
      const res = await fetch("/api/brief/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  async function generarMensual() {
    if (loading || !clientId) return;
    setLoading("mensual");
    setError(null);
    try {
      const res = await fetch("/api/brief/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {error && <span className="text-xs text-danger">{error}</span>}

      {clients.length > 0 && (
        <span className="flex items-center gap-2">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="input w-auto py-1.5 text-xs"
            aria-label="cliente para reporte mensual"
          >
            <option value="">Reporte mensual: elegir cliente…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <button
            onClick={generarMensual}
            disabled={!clientId || loading !== null}
            className="btn-ghost px-3 py-1.5"
          >
            {loading === "mensual" ? "Generando…" : "Generar mensual"}
          </button>
        </span>
      )}

      <button
        onClick={generar}
        disabled={loading !== null}
        className="btn-primary px-6 text-sm"
      >
        {loading === "diario" ? "Generando…" : "Generar ahora"}
      </button>
    </div>
  );
}
