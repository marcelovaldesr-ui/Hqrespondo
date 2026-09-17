# INFORME DE TRANSFORMACIÓN VISUAL — RESPONDO HQ VISUAL SYSTEM V2
**Fecha:** 16 de Septiembre de 2026
**Sistema:** Respondo HQ (Revenue Command Center Interno)
**Alcance:** Frontend, Sistema de Diseño, Componentes UI, Tokens CSS/Tailwind
**Restricción Cumplida:** 0 cambios en Backend, Migraciones SQL, Stores o Lógica de Negocio.

---

## 1. RESUMEN EJECUTIVO

Respondo HQ ha sido transformado visual y ergonómicamente de un estilo anterior "Libreta / Editorial" (fondos cálidos `#F5F2EB`, serif `Newsreader`) a un **Revenue Command Center B2B SaaS de clase mundial**, inspirado en los estándares de interfaces de alta densidad operativa como **Linear, Stripe Dashboard, Vercel Dashboard e Intercom**.

HQ no es una landing page ni una demo para clientes finales: es la cabina de pilotaje comercial y operacional desde donde Marcelo y el equipo de Respondo toman decisiones en segundos, gestionan prospectos, conducen llamadas con battlecards tácticas y controlan la salud del pipeline financiero.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ RESPONDO HQ V2 — ARQUITECTURA VISUAL                                       │
├───────────────────────┬────────────────────────────────────────────────────┤
│ Dark Navy Sidebar     │ Light Workspace Canvas (#F8FAFC)                   │
│ #0B1220               │                                                    │
│ 4 Grupos de Navegación│ ┌────────────────────────────────────────────────┐ │
│ ⌘K Quick Access       │ │ Bandeja de Prioridades de Hoy (Alta Urgencia)   │ │
│ Live System Status    │ ├────────────────────────────────────────────────┤ │
│                       │ │ Stripe-style Metric KPI Cards                  │ │
│                       │ ├────────────────────────────────────────────────┤ │
│                       │ │ Segmented View Control (Revenue OS / Ops)      │ │
│                       │ ├───────────────────────┬────────────────────────┤ │
│                       │ │ Linear-density Panels │ Realtime Activity Feed │ │
│                       │ └───────────────────────┴────────────────────────┘ │
└───────────────────────┴────────────────────────────────────────────────────┘
```

---

## 2. SISTEMA DE DISEÑO V2 (TOKENS & FUNDACIONES)

### 2.1. Paleta de Color Operacional

| Token | Valor Hex | Rol Semántico |
|---|---|---|
| `bg` | `#F8FAFC` (Slate 50) | Lienzo base del espacio de trabajo |
| `surface` | `#FFFFFF` | Superficies de tarjetas, paneles y modales |
| `surface-1` | `#0B1220` (Navy Oscuro) | Fondo principal de la barra lateral izquierda |
| `surface-2` | `#FFFFFF` | Superficies secundarias compatibles |
| `surface-3` | `#F1F5F9` (Slate 100) | Fondos de controles segmentados, badges y barras |
| `surface-4` | `#E2E8F0` (Slate 200) | Fondos de contraste y separadores |
| `line` | `rgba(15, 23, 42, 0.08)` | Bordes estándar y divisores de alta nitidez |
| `line2` | `rgba(15, 23, 42, 0.16)` | Bordes de hover y elementos interactivos |
| `brand` | `#4F46E5` (Indigo 600) | Acento primario de marca Respondo |
| `brand.dark` | `#4338CA` (Indigo 700) | Estados hover de botones primarios |
| `accent` | `#00C2CB` (Tech Cyan) | Acentos secundarios e indicadores de soporte |
| `ink` | `#0F172A` (Slate 900) | Texto principal de alto contraste y legibilidad |
| `ink-soft` | `#334155` (Slate 700) | Texto de lectura y subtítulos |
| `ink-dim` | `#64748B` (Slate 500) | Etiquetas secundarias, metadatos y tooltips |
| `ink-mut` | `#475569` (Slate 600) | Placeholder, timestamps y divisores sutiles |
| `ink-faint` | `#94A3B8` (Slate 400) | Elementos inactivos o desactivados |
| `ok` | `#10B981` (Emerald 500) | Estados positivos, deals ganados, salud óptima |
| `warn` | `#F59E0B` (Amber 500) | Advertencias, revisiones pendientes, riesgo medio |
| `danger` | `#EF4444` (Rose 500) | Tratos estancados, fail-closed, acuerdos perdidos |

### 2.2. Tipografía y Microtipografía

1. **Fuente Sans (`Inter`)**: Reemplaza totalmente a la tipografía serif anterior (`Newsreader`). Se aplica en la raíz mediante `--fuente-sans` y `--fuente-display`, asegurando legibilidad quirúrgica en fuentes de 10px a 18px.
2. **Fuente Monospace (`IBM Plex Mono`)**: Asignada a `--fuente-mono`. Se utiliza en combinación con la propiedad OpenType `tnum` (tabular numbers) para que los montos financieros en UF/CLP, conteos regresivos de 14 días y UUIDs queden matemáticamente alineados en columnas y tablas sin saltos visuales.

### 2.3. Elevación y Sombras
- `shadow-2xs`: `0 1px 2px rgba(15, 23, 42, 0.04)` (para tarjetas de pipeline y elementos de lista).
- `shadow-xs`: `0 1px 2px rgba(15, 23, 42, 0.05)` (para botones e inputs interactivos).
- `shadow-card`: `0 1px 3px rgba(0, 0, 0, 0.04)` (para paneles métricos).
- `shadow-pop`: Sombra profunda con backdrop blur para modales de inserción rápida (≤2 min) y drawers.

---

## 3. COMPONENTES Y MÓDULOS ACTUALIZADOS

### 3.1. Shell Global y Navegación (`Sidebar.tsx`, `navConfig.tsx`, `app/layout.tsx`)
- **Barra Lateral Dark Navy (`#0B1220`)**:
  - Reorganizada en 4 categorías profesionales claras:
    1. **Operación**: Centro de Mando, Pipeline Comercial, Reuniones, Pilotos 14 Días, Propuestas.
    2. **Crecimiento**: Motor Outbound, Prospección, Leads Foco, Briefs, Growth Hub.
    3. **Inteligencia**: Sales Playbook & Enablement, Grabaciones Isabel, Calificación ICP.
    4. **Gestión**: Clientes Activos, Finanzas & Cobranza, Decisiones & Roadmap.
  - Indicador visual activo con píldora blanca, texto blanco nítido y acento índigo.
  - Atajo rápido `⌘K` para paleta de comandos.
  - Monitor inferior con reloj local en tiempo real y estado `Revenue OS V2 · Activo`.

### 3.2. Centro de Mando (`components/CommandCenterV2.tsx`)
- **Bandeja de Prioridades de Hoy**: Posicionada en la parte superior del canvas, destaca de inmediato acciones vencidas o que requieren ejecución en la jornada con badges de urgencia.
- **KPI Cards Estilo Stripe**: Métricas de Pipeline Activo, Acciones de Hoy, Pilotos de 14 Días, Propuestas Abiertas y Tratos Estancados con indicadores de variación y bordes precisos.
- **Segmented Control Switcher**: Alternador fluido entre la vista "Revenue OS" (foco de ventas y deals) y "Operación Global" (clientes, bot events, errores y cadencias).
- **Feed Operativo en Tiempo Real**: Lista compacta de eventos del bot con badges de estado y scrollbars ultra-delgadas.

### 3.3. Pipeline Comercial (`components/PipelineV2.tsx`)
- **Tablero Kanban Estilo Linear**: Columnas por etapa con cabeceras compactas que exhiben conteo de tratos y suma monetaria en UF/CLP.
- **Tarjetas de Trato**: Exhiben fit score, priority score, días en etapa, próxima acción y badge visual rojo si el trato está estancado (`stalled`).
- **Modo Tabla de Alta Densidad**: Vista alternativa de hoja de cálculo para escaneo masivo de oportunidades.
- **Drawer Lateral de Detalle**: Apertura deslizable desde la derecha para consultar y editar el trato sin perder el contexto visual del tablero.

### 3.4. Módulo de Reuniones (`components/MeetingsModule.tsx`)
- **Segmented Control**: Filtro inmediato entre Todas, Discovery y Demostración.
- **Tarjetas de Reunión**: Visualización clara del tipo de reunión, fecha/hora, prospecto y calificación de interés (estrellas).
- **Modal de Captura Rápida (≤2 min)**: Formulario optimizado para registrar minutas inmediatamente tras colgar la llamada con selector de deals.

### 3.5. Tablero de Pilotos de 14 Días (`components/PilotsDashboard.tsx`)
- **Jerarquización Radical**: Separación nítida entre pilotos activos que demandan seguimiento diario y pilotos históricos concluidos.
- **Reunión de Decisión Día 14**: Destaque visual en amber/indigo del hito definitivo de cierre comercial y conteo regresivo de días restantes.
- **Criterios de Éxito**: Desglose de métricas acordadas para medir la conversión del piloto a cliente de pago.

### 3.6. Rastreador de Propuestas (`components/ProposalsTracker.tsx`)
- **Control Financiero**: Métricas de MRR en juego, fecha de envío, fecha de revisión y fecha fatal de decisión.
- **Alerta Anti-Ghosting ("Síndrome Aleta")**: Banner preventivo para propuestas con más de 7 días sin respuesta del tomador de decisión.

### 3.7. Sales Playbook & Battlecards (`components/SalesPlaybookView.tsx`)
- **Buscador Táctico Instantáneo**: Campo de búsqueda en vivo que filtra argumentos, competidores y objeciones en milisegundos durante llamadas telefónicas.
- **Botones de Copiado Rápido (1-Click)**: Permite copiar scripts sugeridos al portapapeles con confirmación visual interactiva.
- **Pestañas Segmentadas**: Acceso directo a Pitches, Manejo de Objeciones, Fichas de Competidores y Estructura de Discovery en 5 fases.

### 3.8. Manejo Visible de Errores (`components/RevenueErrorState.tsx`)
- **Fail-Closed Transparente**: Componente de diseño pulido para alertar sobre inconsistencias de base de datos o migraciones pendientes, con instrucciones técnicas claras para el operador.

---

## 4. VERIFICACIÓN Y ASEGURAMIENTO DE CALIDAD

Se ejecutaron los tres niveles de verificación técnica obligatorios:

```bash
# 1. Typecheck estricto de TypeScript
npx tsc --noEmit
# Resultado: EXIT 0 (0 errores de tipos)

# 2. Batería completa de pruebas unitarias
npm run test:unit
# Resultado: 117 tests pasados, 0 fallos, 21 suites evaluadas

# 3. Compilación de producción Next.js
npm run build
# Resultado: EXIT 0 (Build exitoso, páginas estáticas y dinámicas optimizadas)
```

### Tabla de Integridad del Repositorio

| Área | Estado | Observación |
|---|---|---|
| `supabase/migrations/**` | **INTACTO** | No se modificó ningún archivo SQL ni RPC |
| `lib/revenue/store.ts` | **INTACTO** | Contratos de persistencia inalterados |
| `lib/revenue/validation.ts` | **INTACTO** | Validaciones y anti-mass-assignment inalterados |
| `lib/revenue/scoring.ts` | **INTACTO** | Lógica de fit score y regla fit<40 => 0 inalterada |
| `app/actions/revenue.ts` | **INTACTO** | Server actions y transacciones inalteradas |
| `respondo-portal` | **INTACTO** | Proyecto cliente completamente aislado |
| Git Status | **LIMPIO** | Sin commits, pushes ni deploys automáticos |

---

## 5. CONCLUSIÓN

Respondo HQ cuenta ahora con un **Visual System V2 coherente, denso, rápido y profesional**, listo para operar comercialmente a máxima velocidad sin sacrificar la robustez transaccional validada por el Gate Codex.
