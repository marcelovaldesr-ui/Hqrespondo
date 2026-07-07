# GROWTH STUDIO — RESPONDO HQ
**Fecha:** 6-jul-2026 · Módulo interno de contenido comercial dentro de RespondHQ.
Convierte la estrategia (Prompt 3), las páginas por rubro/SEO (Prompt 2) y los aprendizajes de RespondHQ en piezas publicables. **No es una app genérica de contenido:** es el motor de contenido y crecimiento de Respondo, conectado a la operación real.

---

## 1. Decisión de nombre
Se eligió **"Growth Studio"** (sobre Content Studio / Growth Engine / Media Lab / Marketing OS) porque:
- "Growth" comunica que el objetivo es **generar demanda comercial**, no solo publicar (encaja con la prioridad #1: conseguir clientes).
- "Studio" transmite el lado creativo/de producción (carruseles, guiones) sin sonar a suite empresarial pesada.
- Es corto, cabe en el sidebar y no choca con el tono founder-cockpit de RespondHQ.
Registrado como decisión de marca (recomendado anotar en RespondHQ → Decisiones).

## 2. Arquitectura (respeta RespondHQ)
- **Framework:** Next.js App Router, igual que el resto. Rutas bajo `app/growth/*`, cada página es Server Component (`export const dynamic = "force-dynamic"`) y delega interacción a Client Components en `components/growth/*`.
- **Navegación:** una entrada nueva en el `Sidebar` (`/growth`, icono "spark") entre *Clientes & Bots* y *Finanzas* — posición que le da prominencia sin romper el flujo de venta diario. Dentro del módulo, `GrowthNav` da la sub-navegación (Panel · Ideas · Generador · Calendario · Rubros · Battlecards · Destacadas · Copies).
- **Datos:** el contenido base vive como **seed de código** en `lib/growth/*` (cero migraciones, funciona en Vercel al instante). La persistencia de ideas/calendario creados por el equipo es **opcional y additiva** (migración `009_growth_studio.sql`), con lecturas **defensivas** (`lib/growth/store.ts`): si la migración no corrió, el módulo funciona en modo lectura sin romper nada.
- **Estética:** usa exactamente los tokens de `tailwind.config.ts` (brand violeta #7B5BF0, coral #EC6A56, accent azul #2563EB, ok/warn/danger) y las clases de `globals.css` (`panel`, `metric-card`, `chip`, `lbl`, `led`, `btn-primary`, `input`). Gradientes sutiles azul/violeta/coral. Verde WhatsApp solo como acento, nunca dominante.

## 3. Secciones
| Sección | Ruta | Qué hace |
|---|---|---|
| **Panel** | `/growth` | "¿Qué creamos esta semana?": producción (ideas pendientes/borrador/listas/publicadas), calendario de la semana, próximas piezas, contenido por rubro prioritario, apoyo directo a ventas, mezcla de pilares, CTAs. |
| **Ideas** | `/growth/ideas` | Biblioteca filtrable (pilar, rubro, canal, estado). Crear ideas propias (BD), cambiar estado, eliminar. Seed = solo lectura. |
| **Generador** | `/growth/generador` | Genera **carruseles**, **guiones** e **ideas desde estrategia** (objeciones, rubros, competencia, diferenciadores, FAQ) por plantillas deterministas. Copiar / guardar como idea. |
| **Calendario** | `/growth/calendario` | Vista por fecha, filtros (canal/formato/pilar/estado), marca atrasadas, agendar/mover/eliminar piezas propias. |
| **Rubros** | `/growth/rubros` | Contenido por industria (dolores, preguntas, casos, ideas, mensaje de prospección, objeciones, CTA, fórmula "sin", página SEO). |
| **Battlecards** | `/growth/battlecards` | Competencia → argumentos + ángulos de contenido + objeción/respuesta + qué NO copiar + riesgos. |
| **Destacadas** | `/growth/destacadas` | Plan de destacadas de IG con guion por historia y orden del perfil. |
| **Copies** | `/growth/copies` | Biblioteca reutilizable (hooks, CTAs, captions, posicionamiento, objeciones, prospección, intros/cierres, landing, anuncio, propuesta) con copiar al portapapeles. |

## 4. Generadores (sin IA externa)
Deterministas, en `lib/growth/generators.ts`. Ensamblan piezas desde la estrategia real: fórmula "sin" por rubro, datos-ancla, reglas de tono, CTA según nivel de venta (suave/medio/directo). No dependen de ningún modelo ni API — funcionan siempre. Si más adelante se conecta Gemini (ya presente en el proyecto para scoring/brief), estos generadores pueden servir de estructura base (ver ROADMAP_GROWTH_STUDIO.md).

## 5. Integración con la operación (conceptual)
- **Prospección:** copies y contenido por rubro para calentar/seguir leads.
- **Pipeline:** piezas post-demo / post-propuesta desde el pilar Venta.
- **Roadmap:** una idea puede volverse tarea de contenido (fase 2: botón directo).
- **Decisiones:** decisiones de marca/mensaje se registran en el módulo Decisiones.
- **Objetivos/Brief:** el panel de Growth Studio complementa el ritmo semanal.
- **Prompt 3 / Prompt 2:** el seed nace de esos entregables; los rubros mapean a páginas SEO.

## 6. Qué NO hace (por decisión)
No publica a redes automáticamente. No integra Canva/Figma todavía. No inventa clientes/testimonios/logos/métricas. No usa verde WhatsApp como identidad. No promete resultados irreales. Todo esto está en el ROADMAP como futuro.

## 7. Riesgos y mitigaciones
- **Build no ejecutado en esta sesión** (la carpeta no se pudo montar en el sandbox): correr `npm run build` antes de desplegar (ver RESUMEN_FINAL).
- **Tabla no migrada:** cubierto por lecturas defensivas; el módulo no rompe.
- **Contenido desactualizado:** el seed vive en código; se edita en `lib/growth/*` y se versiona con git.
