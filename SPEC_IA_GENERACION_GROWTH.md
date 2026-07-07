# SPEC — Generación con IA externa (Gemini) en Growth Studio
**Fecha:** 6-jul-2026 · Estado: **✅ IMPLEMENTADO** (6-jul-2026). `lib/growth/aiGenerate.ts` + `app/api/growth/generate/route.ts` + toggle "Redactar con IA" en el Generador, con fallback automático a las plantillas. Requiere `GEMINI_API_KEY` en Vercel (ya presente).
Fuente de precios: página oficial `ai.google.dev/gemini-api/docs/pricing` (consultada jul-2026). Los precios de Google cambian seguido → verificar ahí antes de activar el tier pagado.

---

## 1. Objetivo
Que el Generador de Growth Studio, además de las plantillas deterministas actuales, pueda **redactar** carruseles, guiones y copies con un modelo (Gemini), usando el contexto real de Respondo (tono, reglas, datos-ancla, rubro, objeción). Las plantillas quedan **siempre** como respaldo.

## 2. Por qué es fácil aquí
El proyecto **ya tiene la integración**: `lib/gemini.ts` expone `gemini(prompt)` y `geminiJson<T>(prompt)`, con key `GEMINI_API_KEY`, modelo configurable por `GEMINI_MODEL` (default `gemini-2.5-flash`) y **fallback automático** a `gemini-2.5-flash` si el modelo principal responde 429/500/503 (cuota del tier gratis). No hay que integrar nada nuevo: solo escribir el prompt y un endpoint.

## 3. Arquitectura (mínima, aditiva)
1. **`lib/growth/aiGenerate.ts`** — construye el prompt "sistema" desde el seed (reglas de tono, prohibiciones, datos-ancla, la ficha del rubro de `industries.ts`, el pilar) + el input del usuario (tema, nivel de venta, formato), y llama a `geminiJson<CarouselDraft | VideoScript>()`.
2. **`app/api/growth/generate/route.ts`** — POST que recibe `{ tipo: "carrusel"|"guion", ...input }`, llama a `aiGenerate`, y **si falla** (sin key, timeout, JSON inválido) hace `catch` y devuelve el resultado de los generadores por plantilla actuales (`generarCarrusel`/`generarGuion`). Nunca rompe.
3. **`GeneratorClient.tsx`** — un toggle "✨ Redactar con IA" junto al botón Generar. Si está activo, llama al endpoint; si no, usa las plantillas locales (comportamiento actual). Muestra un aviso "Revisa antes de publicar".

## 4. Prompt (esqueleto)
Sistema (fijo, desde el seed): rol (copywriter de Respondo), tono (dolor y resultado, frases cortas, 2ª persona, 1–2 emojis), **prohibiciones** ("revolucionario/disruptivo/solución integral/vende 10x/reemplaza a tu equipo", inventar precios), datos-ancla (78% / 8x / 2–4h), precios finales, y el **formato JSON de salida** exacto (mismos campos que `CarouselDraft`/`VideoScript`).
Usuario: tema, pilar, rubro (con su ficha inyectada), nivel de venta, nº de slides / duración.
Salida: JSON estricto → `geminiJson` limpia los fences y parsea. Validación defensiva antes de mostrar.

## 5. Reglas anti-alucinación (obligatorias)
- El prompt prohíbe explícitamente inventar precios/números; los precios salen de `PLAN_PRECIOS`.
- Los datos-ancla se pasan como los únicos números permitidos y se marcan como "de mercado, no resultados de Respondo".
- Toda pieza generada entra como **borrador** y exige revisión humana antes de publicar (igual que hoy).
- Si el JSON no valida → fallback a plantilla.

## 6. Costo real (jul-2026, oficial)
**Gemini 2.5 Flash (el que ya usa el proyecto) y la familia Flash tienen TIER GRATIS** ("Free of charge" dentro de límites de requests por minuto/día). Para 2 personas generando decenas de piezas al día, el tier gratis **alcanza y cuesta $0**.

Si se pasa al tier pagado (para más límite y para que Google **no** use los prompts en entrenamiento):
| Modelo | Input /1M | Output /1M | Costo aprox. por pieza* |
|---|---|---|---|
| Gemini 3.1 Flash-Lite | $0.25 | $1.50 | ~$0.0018 |
| Gemini 3.5 Flash | $1.50 | $9.00 | ~$0.011 |
\* Estimación con ~2.500 tokens de entrada + ~800 de salida por carrusel/guion.

Traducido: con **$25** alcanzarían del orden de **~2.000 piezas** con 3.5 Flash o **~13.000** con Flash-Lite. Es prácticamente imposible que lo gasten. (Batch API da 50% off; caching abarata las reglas repetidas.)

## 7. Sobre los ~$25 de Google AI Studio
- **Google AI Studio (aistudio.google.com)** es lo correcto: es la interfaz/consola de la Gemini API. La key que genera es la misma `GEMINI_API_KEY` que ya usa RespondHQ.
- La facturación del tier pagado va por **Google Cloud Billing**. Si esos $25 son crédito de Cloud/Gemini asociado a tu cuenta, **sí aplican** a las llamadas pagadas de la API.
- Pero con el **tier gratis** probablemente **no gastes nada**: úsalo primero; el crédito queda de colchón por si algún día subes de volumen o quieres el tier pagado por privacidad.
- ⚠️ Verificar en tu consola de AI Studio / Cloud Billing qué es exactamente ese saldo (crédito promocional, prueba, etc.) y su fecha de expiración.

## 8. Variables de entorno (Vercel)
- `GEMINI_API_KEY` — ya existe (scoring/brief). La misma sirve.
- `GEMINI_MODEL` (opcional) — para elegir modelo (ej. `gemini-2.5-flash` gratis, o uno pagado). Default ya cae en `gemini-2.5-flash`.

## 9. Esfuerzo y riesgo
- **Esfuerzo:** bajo — 1 helper + 1 endpoint + 1 toggle. La integración Gemini y el fallback ya existen.
- **Riesgo:** bajo — todo va detrás de un toggle, con fallback a plantillas; no toca nada existente.
- **Cuándo:** cuando publicar contenido con variedad y velocidad sea el cuello de botella. Hoy no lo es.

## 10. Próximo paso (cuando se decida)
1. Confirmar que `GEMINI_API_KEY` está en Vercel y que el tier gratis basta (probar en AI Studio).
2. Implementar `aiGenerate.ts` + `/api/growth/generate` + toggle.
3. Probar con 3–4 rubros y afinar el prompt (1 iteración).
4. Dejar las plantillas como fallback permanente.

---

## 11. Cómo aprovechar los créditos de Google AI Studio
**Saldo (jul-2026):** CLP ~24.567 de crédito **prepago** de la API de Gemini (CLP 25.000 agregados el 4-jun). **No reembolsables. Vencen ~4-jun-2027.** Recarga automática desactivada (bien: no gastas de más). La `GEMINI_API_KEY` de esta cuenta ya está en Vercel.

**Realidad:** para texto, USD ~25 en Gemini es muchísimo. El riesgo no es gastarlos rápido, sino **sub-usarlos y que venzan**. El valor se realiza haciendo que el uso real de Respondo pase por esta key.

**Dónde rinden, de mayor a menor provecho:**
1. **Bot de la demo y primeros pilotos** — si el asistente de WhatsApp corre sobre Gemini (vía n8n con esta key), los créditos **pagan el costo de IA de operar el producto durante la validación**. Una conversación completa con modelos Flash cuesta ~CLP 5–10 → **~2.500–4.000 conversaciones** con el saldo. Es el uso que más acerca a vender.
2. **Scoring de prospectos + primer mensaje personalizado** (`lib/scoring.ts`, ya usa Gemini) — mejor priorización y primeros toques más finos.
3. **Brief diario/mensual** (ya usa Gemini) — costo casi nulo, valor operativo diario.
4. **Generación IA en Growth Studio** (este spec) — variedad de carruseles/guiones/copies. ~CLP 2–11 por pieza.
5. **Auto-borrador de propuestas de 1 página y respuestas a objeciones** desde el pipeline.

**Reglas para no perderlos:**
- Confirmar que la key en Vercel es la de esta cuenta de facturación (ya lo está) → scoring/brief ya descuentan de aquí.
- Cuando se arme el bot de demo/pilotos, apuntarlo a esta key (ahí está el volumen real).
- Usar **tier pagado** para conversaciones de clientes: con crédito, Google **no** entrena con esos datos y hay más límite.
- Poner **alerta de gasto**; mantener recarga automática apagada.
- Anotar el **vencimiento (jun-2027)** en Decisiones para revisarlo a tiempo.
