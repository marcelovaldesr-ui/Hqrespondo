# AUDITORÍA DE CONTENIDO — RESPONDO
**Fecha:** 6 de julio de 2026 · Base para el módulo **Growth Studio** en RespondHQ.
Este documento inventaría el contenido estratégico existente en el workspace, qué se reutiliza, qué falta y cómo alimenta Growth Studio. No duplica material: lo conecta.

---

## 1. Carpetas y documentos revisados

### Prompt 3 — Estrategia comercial (`ChatBot Ventas/estrategia-comercial/`)
| Documento | Qué aporta a Growth Studio |
|---|---|
| `DIAGNOSTICO_COMERCIAL_RESPONDO.md` | Contexto y foco comercial. |
| `ICP_RESPONDO.md` | **5 perfiles priorizados** (ferretería, corredora, clínica, estética, taller) con dolores, casos de uso, promesa, objeciones. → base de **Contenido por rubro**. |
| `PLANES_Y_PRECIOS_RESPONDO.md` | Estructura final (Inicial $79k / Crecimiento $149k / Pro $279k / Empresa a medida). → precios en copies, carruseles de venta y destacada Planes. |
| `OFERTA_LANZAMIENTO_RESPONDO.md` | **Piloto Fundador** (dcto. setup 30/20/20/10/10%). → pilar Venta, destacada Pilotos. |
| `DEMO_COMERCIAL_RESPONDO.md` | Guion de demo, ejemplo del cemento. → pilar Demo, guiones. |
| `ROADMAP_COMERCIAL_30_DIAS_RESPONDO.md` | Metas del mes y salida a vender 13-jul. → alineación del calendario. |
| `OBJECIONES_RESPONDO.md` | **18 objeciones con respuesta**. → biblioteca de copies (objeciones) + generador de ideas. |
| `SCRIPTS_DE_VENTA_RESPONDO.md` | Guiones de venta. → contenido para ventas. |
| `MENSAJES_PROSPECCION_RESPONDO.md` | Mensajes fríos + follow-ups + **5 mensajes por rubro**. → copies de prospección, contenido por rubro. |
| `INSTAGRAM_RESPONDO.md` | **Pilares (mezcla real), hooks ganadores, datos-ancla, 8 destacadas, calendario Semana 1, fórmula "sin"**. → columna vertebral del mapa de contenido y las destacadas. |
| `RESUMEN_FINAL_COMERCIAL_RESPONDO.md` | Síntesis. |

### Prompt 2 — Web / SEO / Rubros (`web-respondo/`)
| Documento | Qué aporta |
|---|---|
| `RUBROS_WEB_RESPONDO.md` | Matriz de rubros para páginas. → mapeo `pagina_seo` por rubro. |
| `SEO_RESPONDO.md` | Keywords y estructura. → ideas de artículos de blog por rubro. |
| `AUDITORIA_WEB_RESPONDO.md`, `ROADMAP_WEB_RESPONDO.md`, `RESUMEN_CAMBIOS_WEB_RESPONDO.md` | Estado de la landing y roadmap web. → no se toca la landing; se referencia. |
| `Analisis_Landing_Respondo_v2.md`, `Plan_Motion_Microinteracciones.md` | Copy y tono de la web. → frases para landing en copies. |
| `contenido-seo/`, `brand/`, `referencias-diseno/` | Material de marca y SEO. → identidad visual y referencias. |

### Sistema de Instagram (`respondo-instagram-system/` — referenciado en INSTAGRAM_RESPONDO.md)
Contiene posicionamiento, pilares, calendario mensual, hooks investigados, benchmark de destacadas (Darwin), frames diseñados y analytics. **Sigue siendo la fuente operativa del día a día de IG.** Growth Studio lo complementa, no lo reemplaza: traduce su estrategia a un sistema reutilizable dentro de RespondHQ.

### RespondHQ (`respondo-hq/`)
`AUDITORIA_REAL_RESPONDHQ.md`, `MAPA_FUNCIONAL_RESPONDHQ.md`, `MODELO_DATOS_RESPONDHQ.md`, `INTEGRACIONES_RESPONDHQ.md`, `GUIA_USO_RESPONDHQ.md`, `ROADMAP_RESPONDHQ.md`, `VARIABLES_ENTORNO_RESPONDHQ.md`, `SEGURIDAD_RESPONDHQ.md`, `RESUMEN_FINAL_RESPONDHQ.md`. → definen arquitectura (Next.js App Router + Supabase service_role), estética (tema claro premium, violeta/coral), patrones de página/componente y modelo de datos que Growth Studio **respeta y extiende sin romper**.

---

## 2. Información estratégica que ya existe (y se reutiliza)

- **Posicionamiento:** "El asistente de ventas inteligente para WhatsApp de las empresas latinoamericanas".
- **Diferenciadores documentados:** *no te dejamos solo* (implementación + acompañamiento), *no inventa precios* (regla de diseño), *hablas directo con los fundadores*, *publicamos precios* (transparencia), *especialistas, no todólogos*.
- **Datos-ancla de mercado:** 78% compra al primero · <1 min = 8x conversión · LATAM 2–4 h · −3–5% de cierre por minuto · inmobiliaria <5 min ≈ 100x.
- **Pilares y mezcla (validados por research):** Dolor 30% · Acompañamiento 25% · Producto & Prueba 20% · Educación 15% · BTS/Origen 10%.
- **Investigación de competencia:** Vambe (~$382k/mes + impl, soporte débil), respond.io (self-service ~USD159/mes), Darwin (100% imagen estática, engagement bajo, no publica precios), chatbots de botones ($15k), WhatsApp Business casero.
- **Rubros prioritarios (orden de ataque):** 1) Ferreterías/distribuidoras · 2) Corredoras · 3) Clínicas sin software · 4) Estética con volumen · 5) Talleres chicos.
- **Tono de marca:** dolor y resultado (no tecnología), frases cortas, 2ª persona, máx 1–2 emojis. Prohibido: "revolucionario/disruptivo/solución integral/potenciar/vende 10x".

---

## 3. Qué contenido ya existía

- **Ideas de contenido:** backlog de IG (Semana 1 lista para producir + resto priorizado) en INSTAGRAM_RESPONDO.md y `respondo-instagram-system/02_content-strategy/`.
- **Destacadas:** 5 con portadas/frames diseñados + 3 comerciales nuevas definidas.
- **Calendario:** Mes 1 semana a semana en el sistema de IG.
- **Hooks:** banco de `01_research/hooks-ganadores.md`.
- **Objeciones, mensajes de prospección, scripts:** completos en Prompt 3.

## 4. Qué faltaba (y Growth Studio aporta)

- Un **lugar operativo dentro de RespondHQ** para organizar, generar y planificar ese contenido (antes vivía solo en .md dispersos).
- **Generadores** (carrusel/guion/ideas desde estrategia) que producen borradores on-brand en segundos.
- **Battlecards** estructuradas como argumentos + ángulos de contenido.
- **Biblioteca de copies** filtrable y lista para copiar.
- Conexión conceptual con pipeline, prospección, roadmap y objetivos.

## 5. Conflictos detectados y cómo se resolvieron

| Conflicto | Resolución |
|---|---|
| Precios de junio (piloto gratis) en material antiguo del sistema IG | Se usa **solo** la estructura final + Piloto Fundador. Todo el seed de Growth Studio nace con precios finales. |
| Identidad índigo+coral aún no 100% cerrada | Growth Studio usa los tokens **ya existentes** de RespondHQ (brand violeta #7B5BF0 + coral #EC6A56 + accent azul #2563EB). Verde WhatsApp solo como acento, nunca dominante. |
| Precios interinos de la landing vs. estructura final | Prevalece la **estructura final** (objeción §15 cubre el desfase de la web). |
| Prioridad: prospección vs. producir contenido | El panel de Growth Studio recuerda que la prospección es #1; si el tiempo aprieta, se recorta contenido antes que prospección. |

## 6. Cómo se usa este material dentro de Growth Studio

- **ICP → `lib/growth/industries.ts`** (Contenido por rubro).
- **Objeciones → `lib/growth/copies.ts`** + generador de ideas (pilar Objeciones).
- **Instagram (pilares/hooks/datos) → `lib/growth/pillars.ts`, `copies.ts`, generadores.**
- **Competencia → `lib/growth/battlecards.ts`.**
- **Destacadas → `lib/growth/highlights.ts`.**
- **Backlog + calendario Semana 1 → `lib/growth/ideas.ts`** (ideas seed + carruseles + guiones + calendario 30 días).
- **Precios → `lib/types.ts` (PLAN_PRECIOS)**, reutilizados en carruseles/copies de venta.

> Regla operativa: `respondo-instagram-system/` sigue siendo la fuente del día a día de IG. Growth Studio es el **motor reutilizable** que convierte estrategia en piezas, dentro del centro de mando.
