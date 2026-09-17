# Frentes estratégicos V1

## Alcance y operación

Módulo nativo `/frentes`, acceso desde navegación y bloque del Command Center. Actualización manual: fase, siguiente hito, próxima acción, bloqueo, acción del owner, salud, prioridad y fecha objetivo. Los hitos son una lista ordenada; el progreso se deriva sólo de hitos completados. Se puede crear, cerrar y reabrir conservando historial. Las referencias aceptan URL, path o identificador; sólo HTTP(S) se convierte en enlace navegable.

Estado y salud son independientes. Activos excluye BACKLOG/CERRADO. Stale alerta cuando han transcurrido más de siete días completos desde una actualización, sin mutar el estado. Los cerrados quedan en sección colapsada.

## Migración manual requerida

Ejecutar **únicamente** `supabase/migrations/044_strategic_fronts.sql` en el SQL Editor del Supabase de HQ. No fue ejecutada en producción por el agente. Contiene DDL y seed idempotente en una transacción. Ejecutarla dos veces no duplica ni sobrescribe actualizaciones. La consulta final debe mostrar tres frentes activos y seis cerrados en la primera inicialización.

`roadmap_items` representa tareas con estado libre. No se reutiliza para no mezclar tareas con iniciativas estratégicas ni cambiar su contrato. Se agrega una sola tabla `hq_fronts`, un agregado JSONB por frente con hitos ordenados, referencias e historial. Guardar todo el agregado en una escritura con compare-and-swap por `updated_at` evita perder actualizaciones concurrentes. Un conflicto responde 409. El historial preserva autor autenticado, fecha, nota y snapshot anterior, sin confiar en historial/fechas suministrados por el cliente.

RLS deny-all para anon/authenticated; service_role sólo en servidor. Las rutas conservan Basic Auth de HQ y validan otra vez en el handler. POST rechaza Origin distinto. No hay DELETE, acceso público ni fallback de datos ficticios. Ante falta de tabla/conexión aparece un aviso visible y no se muestran conteos de cero.

## Seed y evidencia

- Ads Live V1: EN_DESARROLLO, P0, salud BLOQUEADO. Informe local `respondo-portal/docs/ADS_LIVE_V1_REPORT.md`: Meta Read validado, publicación rechazada por permisos y Google pendiente de OAuth. Sólo Meta Read aparece completado; implementación de un publicador no equivale a prueba live. Próxima acción: resolver permisos y repetir campaña PAUSED.
- Prospección por correo / Outbound: VALIDACION, P0, ATENCION. `docs/INFORME_FINAL_OUTBOUND_V1.md`, secciones J/K: configuración externa y canario técnico pendientes de confirmar. No se presume warm-up comercial iniciado. Ese documento local pertenece a trabajo previo sin commit y se conserva fuera del despliegue; su referencia se muestra como path informativo.
- Commerce & Booking V1: DISCOVERY, P1. Alcance e hito de aprobación según misión del owner; sin inventar avance ni exigir adjuntos no confirmados.
- Cerrados: Web Comercial V2, Industrias V2, Revenue OS V1, HQ Visual V2, Personalización V1 y Onboarding P0, por instrucción expresa. La fecha del seed representa registro/archivo, no una fecha histórica de terminación verificada.

## QA reproducible

El proyecto base no tiene script lint ni dependencias ESLint. Para herramientas locales de QA (sin cambiar package.json/lock):

```powershell
npm install --no-save --package-lock=false eslint@8.57.1 eslint-config-next@14.2.35 embedded-postgres@18.4.0-beta.17 tsx
npx eslint --config tests/frentes/eslint.json app/frentes app/api/frentes lib/frentes components/Fronts.tsx components/CommandCenterV2.tsx components/navConfig.tsx tests/frentes/fronts.test.ts tests/frentes/api.test.ts
npx tsx --test tests/frentes/fronts.test.ts tests/frentes/api.test.ts tests/frentes/postgres.test.mjs tests/revenue/*.test.ts
npx tsc --noEmit
npm run build
```

PostgreSQL usa exclusivamente instancia local descartable en puerto 54341; jamás lee URLs de producción. Verifica migración dos veces, permisos, persistencia del ciclo completo y rechazo de actualización sobre versión antigua. Test API usa transporte Supabase simulado: autenticación, origen, validaciones, creación, actualización e interferencia concurrente.

Resultados: 10 pruebas de Frentes PASS; 71 pruebas Revenue PASS. Suite existente completa del workspace (incluido Outbound local) PASS. TypeScript y build PASS en checkout aislado sin cambios previos de Outbound/Growth. Lint de archivos del cambio PASS.

Lint global exploratorio con next/core-web-vitals: 32 errores preexistentes `react/no-unescaped-entities` en ProspectTable, SalesPlaybookView y growth/GeneratorClient; una advertencia de dependencias de hook en LeadsFoco. No se modifican por estar fuera del alcance. El build base omite lint por configuración existente; se ejecutó lint explícito del cambio. No se declara QA global completamente verde.

## Verificación de producción tras SQL

1. Abrir `/frentes` autenticado: tres activos, seis cerrados, dos owner actions según seed.
2. Command Center: bloque con tres activos y enlace Ver todos; no mezclar con deals.
3. Editar una iniciativa, agregar nota y guardar; recargar y verificar persistencia.
4. Validar hito, cierre/reapertura y trazabilidad en una iniciativa de prueba creada manualmente; no reabrir los seis históricos.
5. Antes de ejecutar SQL es esperable `/api/frentes` 503 con aviso de migración; no equivale a smoke funcional completo.
