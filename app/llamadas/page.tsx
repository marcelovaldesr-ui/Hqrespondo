import { listaLlamadasDelDia, resumenHoy } from "@/lib/llamadas";
import LlamadasHoy from "@/components/LlamadasHoy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * /llamadas — la lista de llamadas del día, VIVA.
 * Misma selección que el Excel, pero el resultado se registra con un clic
 * y queda en la base: "no contestó" vuelve mañana solo, "interesado" pasa
 * al pipeline, 4 intentos sin contacto y sale de la lista.
 */
export default async function PaginaLlamadas({
  searchParams,
}: {
  searchParams?: { n?: string };
}) {
  // /llamadas?n=80 para tandas más grandes (default 40, máx 150)
  const limit = Math.min(Math.max(Number(searchParams?.n) || 40, 10), 150);
  const [filas, resumen] = await Promise.all([
    listaLlamadasDelDia({ limit }),
    resumenHoy(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <LlamadasHoy filasIniciales={filas} llamadasHoy={resumen.llamadas_hoy} />
    </div>
  );
}
