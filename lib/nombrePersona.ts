/**
 * ¿Esto que extraje es el nombre de una persona, o texto de la página?
 *
 * Nace de una corrida real sobre 124 prospectos: el lector de sitios devolvió
 * "Digital Toma de Hora", "Inicio Nosotros Servicios Agenda" y
 * "Manuel Barros Borgoño" —que es la calle donde queda el instituto, no su
 * dueño—. Guardar eso habría hecho que HQ preguntara por "don Inicio".
 *
 * La regla es simple y dura: si no parece una persona, no pasa. Prefiero
 * perder un nombre bueno que meter uno falso, porque un nombre falso se
 * descubre recién en la llamada, delante del cliente.
 */

/** Palabras de menú, botón y sección: nunca son nombres. */
const RUIDO_WEB = new Set(
  `INICIO NOSOTROS SERVICIOS SERVICIO CONTACTO CONTACTANOS AGENDA AGENDAR RESERVA RESERVAR HORA HORAS
   BLOG NOTICIAS MENU BUSCAR BUSCA TOMA DIGITAL ONLINE WEB SITIO PAGINA HOME ABOUT TEAM STAFF EQUIPO
   QUIENES SOMOS SOMOS AGENDATUHORA PEDIR SOLICITAR CONSULTA CONSULTAS TRATAMIENTOS TRATAMIENTO
   ESPECIALIDADES ESPECIALIDAD SUCURSALES SUCURSAL UBICACION HORARIO HORARIOS PRECIOS VALORES
   CONVENIOS CONVENIO PREGUNTAS FRECUENTES POLITICA PRIVACIDAD TERMINOS COOKIES ACEPTAR CERRAR
   SIGUENOS COMPARTIR LLAMAR ESCRIBIR ENVIAR MENSAJE FORMULARIO NEWSLETTER SUSCRIBETE VER MAS
   LEER CONOCE DESCUBRE BIENVENIDO BIENVENIDA GRACIAS NACE SOBRE
   SAN SANTA SANTO SANTOS FONASA ISAPRE ISAPRES CONSALUD BANMEDICA COLMENA CRUZ BLANCA VIDA TRES
   FORMAS FORMULARIOS PREVISION PARTICULAR PARTICULARES CONVENIO SEGURO SEGUROS
   ESCUELA MILITAR METRO ESTACION EDIFICIO TORRE MALL PLAZA PARQUE REGION PROVINCIA COMUNA
   PAGE CONTAMOS NUESTRO NUESTRA NUESTROS NUESTRAS CONTIGO SIEMPRE AQUI ATENCION CUIDADO
   EXPERIENCIA CALIDAD CONFIANZA COMPROMISO`.split(/\s+/),
);

/** Palabras de rubro. Un apellido no termina en -logía ni en -ología. */
const RUBRO = new Set(
  `MEDICO MEDICA MEDICOS MEDICAS CLINICA CLINICO CLINICAS DENTAL DENTALES ODONTOLOGIA ODONTOLOGICA
   ODONTOLOGICO ESTETICA ESTETICO KINESIOLOGIA KINESIOLOGICA GINECOLOGIA GINECOLOGICA RADIOLOGIA
   RADIOLOGICA RADIOLOGICO TRAUMATOLOGIA OFTALMOLOGIA OFTALMOLOGICA DERMATOLOGIA DERMATOLOGICA
   CARDIOLOGIA NEUROLOGIA PEDIATRIA PSIQUIATRIA PSICOLOGIA NUTRICION FONOAUDIOLOGIA IMAGENOLOGIA
   VETERINARIA VETERINARIO SALUD CENTRO CENTROS INSTITUTO LABORATORIO HOSPITAL POLICLINICO
   LIMITADA LTDA SPA EIRL SOCIEDAD COMPANIA ASOCIADOS INVERSIONES COMERCIAL PROFESIONAL
   PROFESIONALES INTEGRAL INTEGRALES GENERAL
   IMPORTADORA EXPORTADORA DISTRIBUIDORA PUBLICIDAD MARKETING CONSTRUCTORA INMOBILIARIA
   TRANSPORTES LOGISTICA CAPACITACION EDUCACION EDITORIAL PRODUCTORA AGRICOLA FORESTAL
   MINERA PESQUERA TURISMO HOTELERA GASTRONOMICA ALIMENTOS TEXTIL AUTOMOTRIZ`.split(/\s+/),
);

/** Títulos y cargos: acompañan al nombre pero no son parte de él. */
const TITULO_CARGO = new Set(
  `DR DRA DOCTOR DOCTORA CIRUJANO CIRUJANA DENTISTA ODONTOLOGO ODONTOLOGA KINESIOLOGO KINESIOLOGA
   MEDICO MEDICA NUTRICIONISTA PSICOLOGO PSICOLOGA FONOAUDIOLOGO FONOAUDIOLOGA MATRONA MATRON
   TECNOLOGO TECNOLOGA VETERINARIO VETERINARIA DIRECTOR DIRECTORA TECNICO TECNICA GERENTE
   ADMINISTRADOR ADMINISTRADORA JEFE JEFA SOCIO SOCIA DUENO DUENA FUNDADOR FUNDADORA
   ESPECIALISTA CLINICA CLINICO`.split(/\s+/),
);

/** Marcas de dirección: si el nombre viene de una calle, no es una persona. */
export const ES_DIRECCION =
  /\b(av|avda|avenida|calle|pasaje|psje|camino|ruta|carretera|n[°º]|#|piso|of(?:icina)?\.?|local|depto|km)\b/i;

const sinAcento = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/**
 * Un nombre chileno usable: entre 2 y 4 palabras, ninguna de ruido ni de
 * rubro, ninguna terminada en sufijo de especialidad.
 */
export function pareceNombreDePersona(nombre: string): boolean {
  const toks = sinAcento(nombre).split(/\s+/).filter(Boolean);
  if (toks.length < 2 || toks.length > 4) return false;
  for (const t of toks) {
    if (t.length < 3) return false;                       // iniciales sueltas
    if (!/^[A-ZÑ]+$/.test(t)) return false;               // números, símbolos
    if (RUIDO_WEB.has(t) || RUBRO.has(t)) return false;
    if (/(LOGIA|LOGICA|LOGICO|CION|CIONES|DAD|MENTE)$/.test(t)) return false;
  }
  return true;
}

/** Saca del final las palabras que se colaron ("Francisco Lama Limitada"). */
/** Formas legales truncadas en la fuente ("...Limitad", "...Compani"). */
const LEGAL_TRUNCA = /^(LIMITAD|SOCIEDA|COMPANI|COMPAÑI|RESPONSABILID|INDIVIDUA|ASOCIAD)/;

export function podarNombre(nombre: string): string {
  const toks = nombre.split(/\s+/).filter(Boolean);
  while (toks.length > 2) {
    const ultimo = sinAcento(toks[toks.length - 1]);
    if (RUBRO.has(ultimo) || RUIDO_WEB.has(ultimo) || TITULO_CARGO.has(ultimo) || LEGAL_TRUNCA.test(ultimo)) toks.pop();
    else break;
  }
  while (toks.length > 2) {
    const primero = sinAcento(toks[0]);
    if (RUBRO.has(primero) || RUIDO_WEB.has(primero) || TITULO_CARGO.has(primero)) toks.shift();
    else break;
  }
  return toks.join(" ");
}
