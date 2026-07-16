/**
 * Autorización simple para los endpoints del agente.
 * Acepta el secreto por header (Authorization: Bearer …, que es lo que manda
 * Vercel Cron) o por query (?key=…, cómodo para probar con curl / cron-job.org).
 */
export function autorizado(req: Request): boolean {
  // PROS_CRON_SECRET = el nuestro (curl / cron-job.org).
  // CRON_SECRET = el que Vercel Cron manda solo como Authorization: Bearer.
  const secretos = [process.env.PROS_CRON_SECRET, process.env.CRON_SECRET].filter(
    Boolean,
  ) as string[];
  if (!secretos.length) return false; // sin secreto configurado, no se autoriza nada

  const auth = req.headers.get("authorization") ?? "";
  const key = new URL(req.url).searchParams.get("key");
  return secretos.some((s) => auth === `Bearer ${s}` || key === s);
}
