# ROADMAP INTERNO — RESPONDO HQ
Pendientes después de la iteración del 6 de julio de 2026.

## Urgente (antes de seguir usando el panel)
1. **Commit + push desde tu máquina** (no desde sesiones sandbox — ver nota OneDrive en MEJORAS_IMPLEMENTADAS). Verificar `npm run build` local y el deploy de Vercel.
2. **Ejecutar migración 008** en Supabase (SQL Editor → pegar `supabase/migrations/008_eventos_comerciales.sql` → Run).
3. Configurar en Vercel: `NEXT_PUBLIC_DEMO_LINK` (link wa.me de la demo pública) y verificar que `HQ_USER/HQ_PASSWORD` estén seteados (sin ellos el panel queda abierto).
4. Revisar en el pipeline los **deals creados con precios viejos** y actualizar sus valores a la estructura final si siguen activos.

## Esta semana (sprint al vie 10-jul, antes de salir a vender el lunes 13)
- Cargar en Roadmap las tareas de la Semana 1 del ROADMAP_COMERCIAL_30_DIAS (ajustes web, lista de 100 prospectos, demo verificada, propuesta ensayada).
- Registrar en Decisiones: "Rige estructura final de precios (jul-2026)" y "Piloto Fundador reemplaza piloto gratis".
- Registrar los gastos reales del mes en Finanzas (para que el punto de equilibrio diga la verdad).
- Probar el flujo completo con datos reales: buscar rubro → contactar 2–3 → follow-up → pipeline → propuesta copiada.

## Próximos 30 días
- **Migración 009 (opcional):** `decisiones.impacto/estado/proxima_revision`, `deals.responsable/motivo_perdida`, `prospects.responsable` + UI mínima. Solo si con 2 socios de verdad hace falta el campo responsable.
- Botón "Convertir en cliente" desde deal etapa Cliente (pre-llenar nombre/rubro/plan/mensualidad) para eliminar el paso manual doble.
- Vista cards para prospección en móvil (la tabla funciona pero es incómoda con el pulgar).
- Conectar n8n real al primer cliente: eventos comerciales (lead_captured, quote_generated) y probar alertas.
- Histórico simple de objetivos (foto de cierre de mes en una tabla) si quieren medir tendencia.

## Más adelante
- **Growth Studio** (no implementado a propósito): generación de contenido IG/posts desde el panel. Base sugerida: nueva ruta `/growth` + tabla `contenidos` + reuso de `lib/gemini.ts`; los insumos ya están en `respondo-instagram-system/` y `estrategia-comercial/INSTAGRAM_RESPONDO.md`. No antes de tener 2–3 clientes.
- Auth real (Supabase Auth o NextAuth) si el equipo crece más allá de 2 — Basic Auth es suficiente hoy.
- Rate-limit y firma HMAC en hooks cuando haya >5 clientes reportando.
- Panel/reporte para clientes (el add-on vendible "Panel de Oportunidades") — reutilizar `generarReporteMensual` como base.
- Publicación automática en redes: descartada por ahora (decisión).

## Deuda técnica menor
- `tsconfig.tsbuildinfo` en el repo (agregar a .gitignore).
- `clients.updated_at` inexistente.
- Sin tests automatizados (aceptable a esta escala; priorizar smoke test manual del flujo de venta).
- Carpeta en OneDrive: evaluar mover el repo fuera de OneDrive o marcar "Siempre mantener en este dispositivo" para evitar locks de git y archivos cloud-only.
