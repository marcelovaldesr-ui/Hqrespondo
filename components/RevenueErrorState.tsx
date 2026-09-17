import Link from "next/link";

interface RevenueErrorStateProps {
  error: string;
  route: string;
}

export default function RevenueErrorState({ error, route }: RevenueErrorStateProps) {
  const isMigrationMissing =
    error.toLowerCase().includes("relation") ||
    error.toLowerCase().includes("hq_") ||
    error.toLowerCase().includes("migración");
  const isConfigError =
    error.toLowerCase().includes("config") ||
    error.toLowerCase().includes("supabase_url") ||
    error.toLowerCase().includes("credenciales");

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-10">
      <div className="panel border-danger/30 bg-surface p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-danger/10 text-danger flex items-center justify-center font-mono font-bold text-lg shrink-0 border border-danger/20">
              ⚠
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-ink">
                  {isConfigError
                    ? "Configuración de Base de Datos Incompleta"
                    : isMigrationMissing
                    ? "Migración de Revenue OS Requerida"
                    : "Error Operativo en Revenue OS"}
                </h2>
                <span className="inline-flex items-center gap-1 rounded bg-danger/10 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-danger border border-danger/20">
                  Fail-Closed
                </span>
              </div>
              <p className="text-xs text-ink-dim mt-0.5">
                Ruta afectada: <code className="font-mono text-ink bg-surface-3 px-1.5 py-0.5 rounded border border-line">{route}</code> · Las operaciones están bloqueadas para prevenir inconsistencias de datos.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-surface-3 border border-line p-3.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-mut mb-1">Detalle del Error Runtime:</div>
          <p className="font-mono text-xs text-danger break-all leading-relaxed">{error}</p>
        </div>

        {isMigrationMissing && (
          <div className="rounded-lg border border-line bg-surface-3 p-4 text-xs space-y-2.5">
            <p className="font-semibold text-ink flex items-center gap-1.5">
              <span>🛠️</span> Instrucciones de Despliegue para el Operador (Marcelo):
            </p>
            <ol className="list-decimal pl-4 space-y-1.5 text-ink-dim text-[11px]">
              <li>Abra la consola web de Supabase del proyecto Respondo HQ.</li>
              <li>Navegue a la sección <b>SQL Editor</b>.</li>
              <li>
                Ejecute la migración transaccional:{" "}
                <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-ink border border-line">
                  supabase/migrations/043_revenue_operating_system.sql
                </code>
              </li>
              <li>Recargue esta página para verificar la conectividad de las tablas operativas.</li>
            </ol>
          </div>
        )}

        {isConfigError && (
          <div className="rounded-lg border border-line bg-surface-3 p-4 text-xs space-y-2.5">
            <p className="font-semibold text-ink flex items-center gap-1.5">
              <span>🔑</span> Variables de Entorno Requeridas:
            </p>
            <p className="text-ink-dim text-[11px]">
              Verifique que <code className="font-mono font-semibold text-ink">SUPABASE_URL</code> y{" "}
              <code className="font-mono font-semibold text-ink">SUPABASE_SERVICE_ROLE_KEY</code> estén configuradas en{" "}
              <code className="font-mono text-ink">.env.local</code>.
            </p>
            <p className="text-[11px] text-ink-mut">
              Para pruebas desconectadas de interfaz sin base de datos, defina{" "}
              <code className="font-mono font-semibold text-brand">HQ_DEMO_MODE=true</code> de forma explícita.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-line">
          <button
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="btn-primary text-xs py-2 px-4"
          >
            Reintentar Conexión
          </button>
          <Link
            href="/dashboard"
            className="btn-ghost text-xs py-2 px-4"
          >
            Volver al Centro de Mando
          </Link>
        </div>
      </div>
    </div>
  );
}
