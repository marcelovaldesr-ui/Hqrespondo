/**
 * Protocolo de agendamiento — viene de la "GUÍA DE AGENDAMIENTO" del Drive.
 *
 * POR QUÉ VIVE ACÁ Y NO EN UN DOC
 * El documento describe una cadena de recordatorios cronometrada (al agendar,
 * el día antes, 45 minutos antes, 3 minutos antes). Un doc en Drive no le
 * recuerda a nadie: hay que acordarse de abrirlo, y justo el día que a alguien
 * se le pasa es el día que el prospecto no llega. Acá los recordatorios se
 * calculan con la fecha real de la reunión, el texto sale con el nombre y la
 * hora puestos, y se copia con un clic.
 *
 * Conseguir una reunión cuesta decenas de llamadas. El no-show es la forma más
 * cara de perderla.
 */

/** Cómo salió la reunión. Cambia el protocolo, no solo el texto. */
export const VIAS = ["tibio", "frio"] as const;
export type Via = (typeof VIAS)[number];

export const VIA_LABEL: Record<Via, string> = {
  tibio: "Mail · llamada tibia · WhatsApp tibio",
  frio: "WhatsApp frío · llamada en frío",
};

/** Los pasos que se hacen UNA vez, apenas se agenda. */
export const PASOS: Record<Via, string[]> = {
  tibio: [
    "Revisar la disponibilidad del ejecutivo que tomará la reunión.",
    "En la bandeja llegará la invitación: ponerle la etiqueta SÍ y marcar SÍ en la participación.",
    "Contestar al prospecto EN EL HILO de la conversación, confirmando día y hora acordados.",
    "Programar TODOS los recordatorios al tiro, no después.",
  ],
  frio: [
    "Tener a mano las reglas de agendamiento y la disponibilidad del ejecutivo.",
    "BAJAR LA REUNIÓN AL MAIL: todo va con respaldo por correo, aunque haya salido por teléfono o WhatsApp.",
    "Mandar un correo nuevo al prospecto con el asunto «Reunión [Empresa] - [Nombre]», confirmando día y hora.",
    "Dejar la conversación en recibidos, con la etiqueta SÍ.",
    "Programar TODOS los recordatorios al tiro, no después.",
  ],
};

export interface Recordatorio {
  clave: string;
  cuando: string;
  /** Minutos ANTES de la reunión. 0 = apenas se agenda (no depende de la hora). */
  minutosAntes: number | null;
  texto: string;
  /** Si el mensaje debe llevar el link de la reunión pegado. */
  llevaLink: boolean;
  /** Nota operativa que el doc marcaba en mayúsculas. */
  ojo?: string;
}

export interface DatosReunion {
  nombre: string;
  fecha?: string | null;
  hora?: string | null;
  link?: string | null;
  via: Via;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "jueves 21 de agosto" a partir de un YYYY-MM-DD. Sin fecha, deja el molde. */
function fechaLarga(iso?: string | null): string {
  if (!iso) return "DÍA - FECHA";
  // Se parte el string en vez de usar new Date(iso): el constructor interpreta
  // "2026-08-21" como UTC y en Chile (UTC-4) eso retrocede al día anterior.
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return "DÍA - FECHA";
  const dt = new Date(a, m - 1, d);
  const mes = dt.toLocaleDateString("es-CL", { month: "long" });
  return `${DIAS[dt.getDay()]} ${d} de ${mes}`;
}

/**
 * Los 4 recordatorios con el texto ya armado.
 *
 * El de 45 minutos trae la advertencia del doc: si la reunión es a las 9:00 o
 * 9:30, ese se salta (llegaría antes de las 9 de la mañana).
 */
export function recordatorios(d: DatosReunion): Recordatorio[] {
  const nombre = d.nombre?.trim() || "NOMBRE";
  const cuandoFecha = fechaLarga(d.fecha);
  const hora = d.hora?.trim() || "HORA";
  const link = d.link?.trim() || "-- PEGAR EL LINK DE LA REUNIÓN --";
  const temprano = /^0?9:[0-3]/.test(d.hora ?? "");

  return [
    {
      clave: "al_agendar",
      cuando: "Apenas se agenda",
      minutosAntes: 0,
      llevaLink: false,
      texto:
        `${nombre},\n\n` +
        `Tal como fue conversado${d.via === "frio" ? " por teléfono / WhatsApp" : ""}, la reunión quedó fijada para el ${cuandoFecha} a las ${hora}.\n\n` +
        `A tu correo llegó la convocatoria de Google Meet, para que aceptes la invitación y de esta forma contemos con tu participación ese día en la reunión.\n\n` +
        `Nos vemos.\nSaludos.`,
    },
    {
      clave: "dia_antes",
      cuando: "El día antes, ~15:00",
      minutosAntes: null,
      llevaLink: false,
      texto:
        `Buenas tardes ${nombre}.\n\n` +
        `Te recuerdo que mañana a las ${hora} tenemos fijada nuestra reunión.\n\nTe esperamos.`,
    },
    {
      clave: "45_min",
      cuando: "45 minutos antes",
      minutosAntes: 45,
      llevaLink: true,
      ojo: temprano
        ? "Esta reunión es temprano (9:00–9:30): según la guía, este recordatorio SE SALTA."
        : undefined,
      texto:
        `Buenos días/tardes ${nombre},\n\n` +
        `En 45 minutos más nos conectamos a la reunión. Te dejo el link de acceso para que puedas ingresar a las ${hora}:\n\n${link}`,
    },
    {
      clave: "3_min",
      cuando: "3 minutos antes",
      minutosAntes: 3,
      llevaLink: true,
      ojo: "El más importante de los cuatro: es el que rescata al que se distrajo.",
      texto: `¿Está todo listo para comenzar?\n\nYa puedes conectarte:\n\n${link}`,
    },
  ];
}

/** Asunto del correo de respaldo (obligatorio en las reuniones en frío). */
export function asuntoRespaldo(empresa: string, nombre: string): string {
  return `Reunión ${empresa || "[Empresa]"}${nombre ? ` - ${nombre}` : ""}`;
}
