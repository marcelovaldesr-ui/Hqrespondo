# Auditoría de RespondoHQ y hoja de ruta

**19 de agosto de 2026 · para Marcelo y José**
Contraste con lo que usan las plataformas líderes de prospección, aterrizado a un equipo de 3.

---

## Antes de la lista: tres cosas que cambian el enfoque

**1. El 70% del stack de esas plataformas resuelve un problema que ustedes no tienen.**
Outreach, Salesloft y Gong existen para **coordinar y auditar a 50 vendedores**: forecasting rollup, territorios, cuotas, coaching escalado, leaderboards. Con 3 socios eso se resuelve con una conversación de 10 minutos. Copiar ese playbook los haría más lentos, no mejores.

Hay un dato duro que lo respalda: Gartner mide que la **utilización del stack de martech cayó de 58% en 2020 a 33% en 2023**, mientras el gasto subía de US$15,3B a US$23,6B. El cuello de botella medible no es falta de funciones, es falta de uso.

**2. Su canal es WhatsApp, no email. Eso invalida media industria.**
Todo el stack de warm-up de dominios, rotación de buzones, inbox placement y spintax **no les aplica**. El equivalente en WhatsApp es más duro y más existencial: Meta exige opt-in explícito, y el incumplimiento degrada el *quality rating* del número hasta bloquearlo.

> **Ninguna plataforma extranjera les va a dar un panel de salud del número de WhatsApp. Y para ustedes eso es más crítico que cualquier feature de esta lista: es el canal que además venden.**

**3. Los benchmarks públicos de outbound son inservibles como vara.**
El reply rate "de la industria" va de **0,45%** (Belkins, 7,5M emails) a **8,3%** (Woodpecker, 20M+ emails). Un factor de 18, con incentivos opuestos. La única vara válida es su propia serie de tiempo.

> **Consecuencia de diseño: HQ debe estar construido para producir esa serie, no para compararse con nadie.**

Y un dato que sí les sirve, de Belkins sobre 175.000 llamadas: **las empresas de 0-10 empleados responden 0,72% y las de 10.000+ un 0,22%**; y **dueños/fundadores responden 0,57% contra 0,32% de un VP**. Su ICP y su decisor objetivo son estadísticamente los correctos.

---

## Auditoría, sección por sección

### 🟢 Centro de mando
**Bien:** las 3 prioridades del día, el ritmo de venta y "lo accionable" son buenas decisiones de producto. Mejor que el dashboard genérico de Pipedrive.

**Falla estructural:** todo son **totales acumulados**. No hay forma de responder *"de los 40 prospectos que entraron la semana del 3 de agosto, ¿dónde están hoy?"*. Los acumulados esconden degradación durante meses: si la conversión cayó a la mitad en julio, el total sigue subiendo y nadie se entera.

**Falta:** cohortes semanales · tiempo mediano por etapa · prospectos huérfanos (sin próximo paso agendado).

---

### 🟡 Llamadas del día
**Bien:** el flujo de una mano (un clic = resultado registrado) es exactamente lo correcto y es mejor que el de Close.

**El problema real no es de software:** desde el **17 de julio no se registra ningún resultado**. La pantalla está bien construida y lleva un mes sin usarse. Ninguna feature nueva arregla eso.

**Falta:**
- **Cadencia de 4-7 toques con espaciado de 3-5 días hábiles.** Es lo único del playbook gringo con evidencia sólida: Woodpecker mide **4,1% de respuesta sin follow-up contra 8,3% con 3-5 follow-ups**. Hoy HQ corta a los 4 intentos y no propone el siguiente toque.
- **Disposiciones cerradas**: hoy hay 6 resultados, pero falta separar *gatekeeper* de *no contestó*. Sin esa distinción no se puede calcular la tasa de conexión real ni saber si el problema es el número o el portero.
- **Cronómetro de velocidad de respuesta** cuando alguien contesta un WhatsApp.

---

### 🟡 Prospección
**Bien:** el scoring determinista con señales web es un activo real y es más honesto que el "scoring predictivo con ML" que venden las plataformas grandes — el paper académico más citado del tema reporta 98,4% de accuracy pero sus features más importantes son *proxies del resultado*, o sea fuga de datos, no predicción.

**El agujero:** **el scoring nunca se ha calibrado.** Tienen 472 prospectos puntuados y ninguna medición de si el score predice algo.

> **Esto es lo primero que yo construiría de toda la lista:** guardar el score al momento de la captura y graficar mensualmente **conversión a reunión por decil de score**. Si la curva sale plana, el scoring es un adorno y están perdiendo tiempo priorizando mal. Si sale monótona, tienen una ventaja real y medible. Es la diferencia entre tener un scoring y creer que lo tienen.

**Falta:** enriquecimiento en cascada estilo Clay (Places → sitio → Instagram → RUT → LLM), con costo y tasa de acierto registrados por paso.

---

### 🟡 Pipeline
**Bien:** 5 etapas, alertas de estancamiento, kit de venta a mano.

**Falta:** tiempo mediano en cada etapa (hoy solo alerta de "sin movimiento"), y la razón de pérdida como campo cerrado. Sin razón de pérdida estructurada no se puede aprender de los "no".

**No construir:** forecasting probabilístico. Con menos de ~50 deals por trimestre la varianza de la muestra se come cualquier modelo.

---

### 🔴 Clientes & Bots
**Es la sección más desactualizada.** Habla de workflows de n8n que están en desuso desde el 21 de julio.

**Falta lo crítico:** **panel de salud del número de WhatsApp** — quality rating, messaging tier, bloqueos, reportes, entrega por plantilla. Es su equivalente de "deliverability" y hoy no tienen visibilidad. Si Meta les baja el tier, se enteran cuando un cliente reclama.

---

### 🟢 Growth Studio
**Bien:** el contenido por pilares y las battlecards son un activo diferenciado.

**Ya corregido hoy:** los anclajes decían "desde $24.990". Ahora usan los precios vigentes y la battlecard de Vambe usa la comparación real (3.000 conversaciones por $269.990 contra ~$545.000 de su plan Advanced).

---

### 🟡 Finanzas
**Falta:** margen por cliente (hoy solo margen global), y proyección de cuándo se llega al punto de equilibrio con las tasas propias.

---

### 🟢 Brief · Roadmap · Decisiones
Correctos para su tamaño. La bitácora de decisiones es algo que casi ningún equipo chico tiene y vale mantenerla.

---

### 🆕 Objetivos del equipo — **entregado hoy**
Reemplaza el Excel del Drive sin cambiarles el ritual. Una decisión de diseño que quiero explicar:

**El indicador que se destaca NO es el % de cumplimiento, sino cuántos objetivos cayeron sin conversarse en la reunión.** Un objetivo que se cae y se habla es información; uno que se cae en silencio es el problema.

Y **no hay ranking entre socios, a propósito.** Hay evidencia experimental (LSE, 319 participantes, 1.239 observaciones) de que el feedback relativo entre pares **aumenta el esfuerzo del que va arriba y lo reduce en el que va abajo**, ampliando la brecha. Con 3 personas, un ranking garantiza que alguien sea siempre último. La comparación correcta es contra el promedio propio de 4 semanas.

---

## Hoja de ruta

### Fase 1 — Los cimientos (semanas 1-4)
Sin esto, todo dashboard nuevo es una consulta ad-hoc que miente distinto.

| # | Qué | Por qué |
|---|---|---|
| 1 | **Bitácora única de actividad** — tabla `actividades` (actor, contacto, canal, tipo, resultado, timestamp) | De ahí salen TODAS las métricas. Es lo que le permitió a Belkins publicar sus estudios y a ustedes hoy les falta |
| 2 | **Lista de supresión global + registro de oposición** | Quien dijo "no" por WhatsApp no debe recibir una llamada. Y es **requisito legal desde el 1-dic-2026** |
| 3 | **Disposiciones cerradas** en cada toque | Sin esto no hay tasa de conexión ni conversación→reunión |
| 4 | **Cohortes semanales en el Centro de mando** | La diferencia entre saber y creer que saben |
| 5 | **Recordatorios de reunión por WhatsApp (24 h y 1 h)** con reagendar en un clic | La mejor palanca por línea de código de toda la lista. Ya tienen la infraestructura |
| 6 | **Panel de salud del número de WhatsApp** | Riesgo existencial, y ninguna plataforma extranjera se los da |

### Fase 2 — Lo que multiplica (mes 2-3)

| # | Qué |
|---|---|
| 7 | **Calibración del scoring**: conversión a reunión por decil. O valida la feature o la mata |
| 8 | **Motor de cadencias semi-automático**: el sistema propone la tarea del día, el humano ejecuta. 4-7 toques, 3-5 días hábiles |
| 9 | **Clasificación de respuestas por intención** con LLM sobre el texto de WhatsApp |
| 10 | **Transcripción y resumen de llamadas** con extracción de objeciones. Avoma cobra US$19/usuario por esto; con Whisper les cuesta centavos |
| 11 | **Cascada de enriquecimiento** estilo Clay, versión Chile |

### Fase 3 — Después (mes 4+)

| # | Qué |
|---|---|
| 12 | **Reporte semanal por socio contra su propio promedio**, nunca contra los otros. Se enchufa directo a la sección de objetivos entregada hoy |
| 13 | **Planificación de capacidad inversa**: "para 5 clientes en septiembre necesitan X reuniones → Y agendadas → Z conversaciones", con **sus propias tasas** |
| 14 | **Señales locales**: local nuevo en Places, salto de reseñas, el dueño empieza a responder reseñas, vacante publicada |
| 15 | **Servidor MCP sobre HQ** para consultar sus datos conversando |

### Lo que NO hay que construir

Warm-up de dominios · A/B testing con significancia (para detectar 5%→7% de respuesta hacen falta **4.426 envíos**; no los generan en un trimestre) · scoring predictivo con ML · forecasting probabilístico · leaderboards entre socios · dialer predictivo · datos de intención de terceros · un Gong completo.

---

## Las 9 métricas que yo mediría

No 47. Estas:

1. Prospectos nuevos calificados por semana
2. Primeros contactos enviados por semana
3. **Toques promedio por prospecto antes de descartar** ← el que más se rompe en equipos chicos
4. Tasa de respuesta y tasa de respuesta **positiva**
5. Reuniones agendadas → celebradas = **tasa de asistencia**
6. Reunión → propuesta → cierre
7. Días medianos por etapa
8. **Prospectos huérfanos** (sin próximo paso agendado) ← higiene, no resultado
9. Todo lo anterior **por cohorte semanal de entrada**

Su métrica de eficiencia no debería ser "costo por reunión" sino **horas-socio por reunión celebrada**. Un equipo de 3 fundadores vendiendo directo tiene un costo por reunión estimado de US$50-150 contra US$300-800 de un equipo con SDR contratado. Esa es su ventaja estructural y conviene medirla.

---

## Lo urgente que no es una feature

**Nadie registra resultados de llamada desde el 17 de julio.** Toda esta hoja de ruta asume que los datos entran. Si el circuito de registro no se usa, la Fase 1 no mide nada y las Fases 2 y 3 se construyen sobre aire.

Antes de la primera línea de código de la Fase 1: decidir si van a registrar en HQ o no. Si están llamando y anotando en otro lado, hay que entender por qué y arreglar eso primero.

---

## Fuentes

[Salesloft — actualización de producto verano 2026](https://www.salesloft.com/innovation/feature-releases/summer-2026-product-update) ·
[Outreach — plataforma](https://www.outreach.ai/platform) ·
[Apollo — venta basada en señales](https://www.apollo.io/insights/signal-based-selling) ·
[Close — producto](https://www.close.com/product) ·
[Clay](https://www.clay.com/) · [Avoma](https://www.avoma.com/) · [Attio](https://attio.com/) ·
[Belkins — benchmarks de llamadas en frío (175.000 llamadas)](https://belkins.io/blog/cold-calling-benchmarks) ·
[Belkins — tasas de respuesta (7,5M emails)](https://belkins.io/blog/cold-email-response-rates) ·
[Woodpecker — estadísticas de cold email (20M+ emails)](https://woodpecker.co/blog/cold-email-statistics/) ·
[Gartner vía MarTech — utilización del stack](https://martech.org/marketers-are-only-using-one-third-of-their-stacks-capability/) ·
[Salesforce State of Sales 2026](https://www.salesforce.com/news/stories/state-of-sales-report-announcement-2026/) ·
[Frontiers in AI — scoring de leads con ML](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2025.1554325/full) ·
[LSE / Tsvetkova — el feedback relativo amplía la brecha](https://eprints.lse.ac.uk/115983/1/Tsvetkova_relative_feedback_increases_accepted.pdf) ·
[RevenueHero — benchmark de inasistencia](https://www.revenuehero.io/reports/no-show-benchmark-december-02-2024)

*No soy abogado: lo relativo a la Ley 21.719 hay que validarlo antes de comprometer presupuesto.*
