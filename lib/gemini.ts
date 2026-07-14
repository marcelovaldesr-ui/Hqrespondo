const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODELO_RESPALDO = "gemini-2.5-flash";

async function llamarModelo(
  model: string,
  prompt: string,
  tools?: unknown[],
  generationConfig?: Record<string, unknown>,
): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Falta GEMINI_API_KEY");
  return fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(tools && tools.length > 0 ? { tools } : {}),
      ...(generationConfig ? { generationConfig } : {}),
    }),
  });
}

/**
 * Llama a Gemini con el modelo configurado (GEMINI_MODEL). Si Google
 * responde 429/500/503 (cuota o alta demanda, frecuente en modelos nuevos
 * del tier gratis), reintenta con gemini-2.5-flash SIN tools — mejor una
 * respuesta del modelo estable que caer al fallback sin IA.
 *
 * `generationConfig` es opcional (temperature, maxOutputTokens, thinkingConfig…).
 * Los callers que no lo pasan (scoring, brief) se comportan igual que antes.
 */
export async function gemini(
  prompt: string,
  tools?: unknown[],
  generationConfig?: Record<string, unknown>,
): Promise<string> {
  const principal = process.env.GEMINI_MODEL || MODELO_RESPALDO;

  let res = await llamarModelo(principal, prompt, tools, generationConfig);

  if (!res.ok && [429, 500, 503].includes(res.status) && principal !== MODELO_RESPALDO) {
    res = await llamarModelo(MODELO_RESPALDO, prompt, undefined, generationConfig);
  }

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Extrae el primer bloque JSON (objeto {} o arreglo []) de un texto con posible ruido alrededor. */
function extraerJson(text: string): string {
  const clean = text.replace(/```json|```/g, "").trim();
  const iObj = clean.indexOf("{");
  const iArr = clean.indexOf("[");
  let start = -1;
  let cierre = "}";
  if (iArr >= 0 && (iObj < 0 || iArr < iObj)) {
    start = iArr;
    cierre = "]";
  } else if (iObj >= 0) {
    start = iObj;
    cierre = "}";
  }
  const end = clean.lastIndexOf(cierre);
  return start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
}

/** Llama a Gemini esperando JSON; limpia fences ```json, extrae el objeto y parsea. */
export async function geminiJson<T>(
  prompt: string,
  tools?: unknown[],
  generationConfig?: Record<string, unknown>,
): Promise<T> {
  const text = await gemini(prompt, tools, generationConfig);
  return JSON.parse(extraerJson(text)) as T;
}

export interface FuenteWeb {
  url: string;
  titulo?: string;
}

/**
 * Igual que geminiJson, pero además devuelve las FUENTES reales que Gemini
 * citó gracias al tool de grounding (ej. google_search). Úsala quien necesite
 * poder JUSTIFICAR un dato (no solo generarlo) — ej. lib/contactoAI.ts, donde
 * un dato sin fuente verificable no debe tratarse como confiable.
 *
 * Si el modelo no usó grounding (o no citó nada), `fuentes` viene vacío: eso
 * es una señal válida de "no hay respaldo", no un error.
 */
export async function geminiJsonConFuentes<T>(
  prompt: string,
  tools?: unknown[],
  generationConfig?: Record<string, unknown>,
): Promise<{ data: T; fuentes: FuenteWeb[] }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Falta GEMINI_API_KEY");
  const principal = process.env.GEMINI_MODEL || MODELO_RESPALDO;

  let res = await llamarModelo(principal, prompt, tools, generationConfig);
  if (!res.ok && [429, 500, 503].includes(res.status) && principal !== MODELO_RESPALDO) {
    // OJO: el reintento sin `tools` pierde el grounding — si pasa, el caller
    // debe interpretar fuentes=[] como "no se pudo verificar", no como dato limpio.
    res = await llamarModelo(MODELO_RESPALDO, prompt, undefined, generationConfig);
  }
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }

  const body = await res.json();
  const candidato = body?.candidates?.[0];
  const text: string = candidato?.content?.parts?.[0]?.text ?? "";

  const chunks: any[] = candidato?.groundingMetadata?.groundingChunks ?? [];
  const fuentes: FuenteWeb[] = [];
  for (const c of chunks) {
    const url = c?.web?.uri;
    if (typeof url === "string" && url.length > 0) {
      fuentes.push({ url, titulo: c?.web?.title });
    }
  }

  return { data: JSON.parse(extraerJson(text)) as T, fuentes };
}
