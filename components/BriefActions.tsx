"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BriefActions() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/brief/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-danger">{error}</span>}
      <button onClick={generar} disabled={loading} className="btn-primary px-6 text-sm">
        {loading ? "generando…" : "generar ahora"}
      </button>
    </div>
  );
}
