import Isabel from "@/components/Isabel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** /isabel — la 4ª empleada. El chat es 100% cliente; el cerebro, /api/isabel. */
export default function PaginaIsabel() {
  return (
    <div className="mx-auto max-w-3xl">
      <Isabel />
    </div>
  );
}
