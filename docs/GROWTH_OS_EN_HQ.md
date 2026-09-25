# Growth OS dentro de RespondoHQ

**Qué es.** La sección «Growth OS» (`/growth-os`) muestra el Growth OS de Respondo e Impresora Color (estado de cada pieza,
bandeja del Owner, First 12, calendario, claims, aprendizajes) y guarda las decisiones del Owner. Es la misma interfaz del
artefacto de Claude, servida por el HQ.

**Qué NO es.** El motor del Growth OS (loops, skills, crítico, visual-qa, gate de marca, verificación de claims, renders)
NO corre aquí: sigue en la carpeta `respondo-growth-os` y lo opera Claude. El HQ no genera contenido ni publica nada.

## Piezas (todo aditivo, sin migraciones SQL)
| Archivo | Qué hace | Acceso |
|---|---|---|
| `app/growth-os/page.tsx` | página del HQ (iframe a la interfaz) | login del HQ |
| `app/api/growth-os/ping` · `state` · `app` · `files/[...path]` · `ledger` | interfaz, estado, imágenes (URL firmada 1 h), guardar decisiones | login del HQ |
| `app/api/growth-os-sync/manifest` · `sign` · `ledger` | los usa `tools/hq_sync.py` | header `x-growth-os-token` = `GROWTH_OS_SYNC_TOKEN` |
| `lib/growthOs/store.ts` | bucket privado `growth-os` en Supabase Storage (se crea solo) | servidor |
| `middleware.ts` | deja `/api/growth-os-sync/*` fuera del Basic Auth (validan su token adentro) | — |
| `components/navConfig.tsx` | «Growth OS» reemplaza a «Growth Studio» en el menú (la ruta `/growth` sigue existiendo) | — |

Bucket `growth-os`: `app/index.html` · `state/growth-state.json` · `state/manifest.json` · `files/**` (miniaturas y vistas JPG) · `ledger/*.json`.

## Variable de entorno nueva (Vercel → respondo-hq → Settings → Environment Variables)
`GROWTH_OS_SYNC_TOKEN` = el valor del archivo `respondo-growth-os/.secrets/hq_sync_token` (mínimo 24 caracteres).
Sin ella, las rutas de sync responden 401 y la página muestra «todavía no está sincronizado». No afecta nada más del HQ.

## Ciclo
1. Claude, al empezar una tanda: `python tools/hq_sync.py --pull-only` (en el PC) → trae decisiones del HQ → `apply_owner_decisions.py`.
2. Corre los loops como siempre.
3. Al cerrar: `python tools/hq_sync.py` → sube estado, interfaz e imágenes nuevas. Los cambios de interfaz no requieren redeploy.

## Seguridad
- Todo bajo el Basic Auth del HQ salvo las 3 rutas de sync, que exigen el token (comparación en tiempo constante).
- El token solo firma subidas a `app/`, `state/` y `files/`; jamás a `ledger/` (las decisiones solo nacen en la interfaz).
- Rutas validadas (sin `..`), decisiones validadas con las mismas reglas que el Growth OS local, bucket privado.
