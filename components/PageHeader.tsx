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
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
      <div className="flex items-center gap-4">
        <span className="lbl max-w-[18rem] text-[12px] leading-tight">{title}</span>
        {sub && (
          <span className="border-l border-line2 pl-4 text-sm font-medium text-ink-mut">
            {sub}
          </span>
        )}
      </div>
      {right}
    </div>
  );
}
