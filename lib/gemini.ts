const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODELO_RESPALDO = "gemini-2.5-flash";

async function llamarModelo(
  model: string,
  prompt: string,
  tools?: unknown[],
): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Falta GEMINI_API_KEY");
  return fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      ...(tools && tools.length > 0 ? { tools } : {}),
    }),
  });
}

/**
 * Llama a Gemini con el modelo configurado (GEMINI_MODEL). Si Google
 * responde 429/500/503 (cuota o alta demanda, frecuente en modelos nuevos
 * del tier gratis), reintenta con gemini-2.5-flash SIN tools — mejor una
 * respuesta del modelo estable que caer al fallback sin IA.
 */
export async function gemini(
  prompt: string,
  tools?: unknown[],
): Promise<string> {
  const principal = process.env.GEMINI_MODEL || MODELO_RESPALDO;

  let res = await llamarModelo(principal, prompt, tools);

  if (!res.ok && [429, 500, 503].includes(res.status) && principal !== MODELO_RESPALDO) {
    res = await llamarModelo(MODELO_RESPALDO, prompt, undefined);
  }

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Llama a Gemini esperando JSON; limpia fences ```json y parsea. */
export async function geminiJson<T>(prompt: string, tools?: unknown[]): Promise<T> {
  const text = await gemini(prompt, tools);
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as T;
}
