"use client";

import { useCallback, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ProspectSearch from "@/components/ProspectSearch";
import ProspectTable from "@/components/ProspectTable";
import type { Prospect } from "@/lib/types";

export default function ProspectionClient({
  initialProspects,
}: {
  initialProspects: Prospect[];
}) {
  const [prospects, setProspects] = useState<Prospect[]>(initialProspects);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadProspects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/prospects", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cargar prospectos");
      setProspects(data.prospects ?? []);
    } catch (err: any) {
      setError(err.message ?? "No se pudo cargar prospectos");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Prospección"
        sub="Motor de Captación"
        right={
          <span className="font-mono text-[11px] text-ink-dim">
            {loading ? "Actualizando..." : `${prospects.length} En Base`}
          </span>
        }
      />
      <ProspectSearch onSuccess={reloadProspects} />
      {error && (
        <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
      <div className="mt-4">
        <ProspectTable prospects={prospects} />
      </div>
    </div>
  );
}
