import { redirect } from "next/navigation";

// Respaldo del redirect que ahora hace el middleware.
// force-dynamic es obligatorio: sin esto Next prerenderiza esta página como
// artefacto estático y el caché de Vercel la sirve como 307 sin header
// `Location`, dejando la home en blanco (bug del 14-ago-2026, ver middleware.ts).
export const dynamic = "force-dynamic";

export default function Home() {
  redirect("/dashboard");
}
