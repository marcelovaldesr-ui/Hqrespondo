export const dynamic = "force-dynamic";

/**
 * Growth OS (Respondo + Impresora Color) dentro del HQ.
 * La interfaz es la misma del artefacto (servida desde /api/growth-os/app, mismo origen: hereda el login del HQ).
 * El motor sigue en la carpeta respondo-growth-os; aquí se ve el estado y se toman las decisiones del Owner.
 */
export default function GrowthOsPage() {
  return (
    <div className="-mx-4 -my-5 sm:-mx-6 lg:-mx-8" style={{ height: "100dvh" }}>
      <iframe
        src="/api/growth-os/app"
        title="Growth OS"
        className="block h-full w-full border-0"
      />
      <a
        href="/api/growth-os/app"
        target="_blank"
        rel="noopener"
        className="fixed bottom-3 right-3 z-10 hidden rounded-md border border-line2 bg-bg px-2.5 py-1 font-mono text-[11px] text-ink-mut hover:text-ink lg:block"
      >
        Pantalla completa ↗
      </a>
    </div>
  );
}
