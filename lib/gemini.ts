const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function gemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Falta GEMINI_API_KEY");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Llama a Gemini esperando JSON; limpia fences ```json y parsea. */
export async function geminiJson<T>(prompt: string): Promise<T> {
  const text = await gemini(prompt);
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as T;
}
