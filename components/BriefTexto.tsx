/**
 * El brief, pintado como documento en vez de como pantallazo de chat.
 *
 * POR QUÉ EXISTE — 26-ago-2026
 * Marcelo: "hasta los emojis son demasiado IA, típico texto que copias y
 * pegas del ChatGPT".
 *
 * Tenía razón, pero la causa no era el prompt: los emojis son los
 * ENCABEZADOS. El brief se escribe para WhatsApp, donde no hay títulos ni
 * negritas ni listas — el 🎯 y el 🔥 son literalmente lo único que separa una
 * sección de otra. Ahí cumplen una función.
 *
 * El error era mostrar ESE MISMO texto crudo dentro de un <pre> en la web,
 * donde sí hay tipografía. Un medio prestándole las muletas al otro.
 *
 * Así que acá no se cambia lo que se genera —el texto que sale por WhatsApp
 * queda intacto, con sus emojis— sino cómo se pinta en pantalla: se reconocen
 * las secciones, se les quita el emoji y se les da jerarquía de verdad.
 *
 * Si algún día el brief cambia de forma y esto no logra reconocer una
 * sección, no se rompe: la línea cae como párrafo y se lee igual. Degradar
 * bien importa más que acertar siempre.
 */

/** Emoji al principio de una línea, con sus modificadores y el espacio. */
const EMOJI_AL_INICIO =
  /^[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}\u{2190}-\u{21FF}\u{2600}-\u{27BF}]+\s*/u;

/**
 * Emoji EN CUALQUIER PARTE de la línea. El del encabezado no es el único:
 * el brief también mete marcas dentro del texto ("⚠️ gastos sobre MRR",
 * "⚠️ Errores bots"). En WhatsApp esa marca sirve; acá es redundante, porque
 * la frase que viene al lado dice exactamente lo mismo — y es justo el detalle
 * que hace que un texto se lea como pegado de un chat.
 */
const EMOJI_EN_CUALQUIER_PARTE =
  /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** Viñetas: "- ", "* ", "• ", "· ". */
const VINETA = /^\s*[-*•·]\s+/;
/** Numeradas: "1. ", "2) ". */
const NUMERADA = /^\s*\d{1,2}[.)]\s+/;

type Bloque =
  | { tipo: "titulo"; texto: string }
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; numerada: boolean; items: string[] };

/**
 * Una línea es encabezado si empieza con emoji, o si está en mayúsculas y es
 * corta. Lo segundo cubre el brief "modo básico" (el que se arma sin IA
 * cuando Gemini falla), que trae encabezados en mayúscula sin emoji.
 */
function esTitulo(cruda: string): boolean {
  const linea = cruda.trim();
  if (!linea) return false;
  if (EMOJI_AL_INICIO.test(linea)) return true;
  if (VINETA.test(cruda) || NUMERADA.test(cruda)) return false;
  if (linea.length > 46 || linea.endsWith(".")) return false;
  const letras = linea.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, "");
  if (letras.length < 4) return false;
  const mayus = letras.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "").length;
  return mayus / letras.length > 0.8;
}

function limpiar(linea: string): string {
  return linea
    .replace(EMOJI_AL_INICIO, "")
    .replace(EMOJI_EN_CUALQUIER_PARTE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function analizarBrief(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let lista: { numerada: boolean; items: string[] } | null = null;

  const cerrarLista = () => {
    if (lista && lista.items.length) bloques.push({ tipo: "lista", ...lista });
    lista = null;
  };

  for (const cruda of (texto ?? "").split("\n")) {
    const linea = cruda.trim();
    if (!linea) { cerrarLista(); continue; }

    if (esTitulo(cruda)) {
      cerrarLista();
      const t = limpiar(linea);
      if (t) bloques.push({ tipo: "titulo", texto: t });
      continue;
    }

    const numerada = NUMERADA.test(cruda);
    const vineta = VINETA.test(cruda);
    if (numerada || vineta) {
      // Una lista numerada y una con viñetas son listas distintas: si cambia
      // el tipo, se cierra la anterior en vez de mezclarlas.
      if (!lista || lista.numerada !== numerada) { cerrarLista(); lista = { numerada, items: [] }; }
      const item = limpiar(cruda.replace(numerada ? NUMERADA : VINETA, ""));
      if (item) lista.items.push(item);
      continue;
    }

    cerrarLista();
    const p = limpiar(linea);
    if (p) bloques.push({ tipo: "parrafo", texto: p });
  }
  cerrarLista();

  // Una sección sin nada debajo no es una sección: es un dato suelto. Pasa con
  // el brief de respaldo, que escribe "⏰ Seguimientos: 25" en una línea — se
  // veía como una etiqueta en mayúsculas con el vacío abajo. Se degrada a
  // párrafo, que es lo que de verdad es.
  return bloques.map((b, i) =>
    b.tipo === "titulo" && (!bloques[i + 1] || bloques[i + 1].tipo === "titulo")
      ? ({ tipo: "parrafo", texto: b.texto } as Bloque)
      : b,
  );
}

export default function BriefTexto({
  texto,
  compacto = false,
}: {
  texto: string;
  compacto?: boolean;
}) {
  const bloques = analizarBrief(texto);

  // Si no se reconoció ninguna sección, es un brief con una forma que esto no
  // entiende. Se muestra tal cual antes que mostrarlo mal.
  if (!bloques.some((b) => b.tipo === "titulo")) {
    return (
      <pre className={`whitespace-pre-wrap font-sans ${compacto ? "text-[12.5px] leading-relaxed" : "text-[15px] leading-8"} text-ink-soft`}>
        {texto}
      </pre>
    );
  }

  const cuerpo = compacto ? "text-[12.5px] leading-relaxed" : "text-[15px] leading-7";
  const sangria = compacto ? "ml-4" : "ml-5";

  return (
    <div className={`${cuerpo} text-ink-soft`}>
      {bloques.map((b, i) => {
        if (b.tipo === "titulo") {
          return (
            <div key={i} className={`lbl ${i === 0 ? "" : compacto ? "mt-3" : "mt-5"} mb-1.5`}>
              {b.texto}
            </div>
          );
        }
        if (b.tipo === "parrafo") {
          return <p key={i} className="mt-1.5">{b.texto}</p>;
        }
        const Etiqueta = b.numerada ? "ol" : "ul";
        return (
          <Etiqueta key={i} className={`${sangria} ${b.numerada ? "list-decimal" : "list-disc"} space-y-1 marker:text-ink-faint`}>
            {b.items.map((it, j) => <li key={j}>{it}</li>)}
          </Etiqueta>
        );
      })}
    </div>
  );
}
