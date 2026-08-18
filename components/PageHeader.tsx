export default function PageHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Marca de sección: dos barritas de marca, ancla el ojo al inicio de la línea */}
          <span className="flex shrink-0 flex-col gap-[3px]" aria-hidden="true">
            <span className="block h-[3px] w-4 rounded-full bg-brand" />
            <span className="block h-[3px] w-2.5 rounded-full bg-coral/70" />
          </span>
          <h1 className="ttl truncate text-[17px] leading-tight">{title}</h1>
          {sub && (
            <span className="hidden border-l border-line2 pl-3 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-mut sm:inline">
              {sub}
            </span>
          )}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
      <div className="hairline" />
    </div>
  );
}
