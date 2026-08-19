# Plan: llegar al dueño, no a la secretaria

**RespondoHQ — rediseño del listado de llamadas**
14 de agosto de 2026 · para Marcelo y José
Segmento objetivo: micro-pyme chilena de 1 a 15 personas · Presupuesto de datos: hasta US$100/mes

---

## Resumen en una página

**El problema no es que el listado esté mal armado. Es que solo tiene una fuente, y esa fuente es por definición el número de la recepción.** Todos los teléfonos que llamas salen del campo que Google Maps publica en la ficha del negocio. La maquinaria de decisores que ya construimos —cargo, seniority, Apollo, Lusha— existe en el repositorio pero **está desconectada del listado y dos de las tres API keys ni siquiera están configuradas**.

**La solución no es comprar datos.** Apollo y Lusha se alimentan de LinkedIn y dominios corporativos; el centro de nutrición de Puerto Varas no está ahí y no va a estar. Pagarlos sería gastar el 60% del presupuesto en cobertura que no existe para nuestro ICP.

**La solución es conseguir el NOMBRE del dueño, y en Chile hay cuatro fuentes públicas gratuitas que nadie en el mercado está usando bien.** La más potente: el 62% de las EIRL llevan el apellido del dueño en su propia razón social, y ese dataset se baja gratis de datos.gob.cl.

**Pero apareció algo que obliga a repensar el canal completo, y es lo más importante de este documento:**

> Desde el 13 de agosto de 2025, SUBTEL obliga a que las llamadas comerciales de prospección a no-clientes salgan con **prefijo 809**. Y según Cadem, **el 79% de los chilenos no contesta llamadas con prefijo 600 u 809**. Truecaller ubica a Chile como el **segundo país del mundo con más spam telefónico**: el 70% de las llamadas desde números desconocidos son spam.

O sea: o estamos fuera de norma (multa de 5 a 5.000 UTM), o cumplimos y 4 de cada 5 no contestan. **La llamada dejó de ser un canal de cierre y tiene que convertirse en una máquina de capturar permiso para escribir por WhatsApp.**

---

## 1. Diagnóstico: qué hace hoy el código

### 1.1 Una sola fuente, y es la equivocada

La ruta completa del número que marcas:

```
lib/places.ts:59          nationalPhoneNumber de Google Places
      ↓
prospects.telefono
      ↓
lib/llamadas.ts:48        SELECT ... telefono ...
      ↓
app/api/prospects/csv-llamadas/route.ts:97    telefonoLimpio(p.telefono)
```

`nationalPhoneNumber` es el número que el negocio publica en su ficha de Google Maps. En una empresa con recepción, ese número **es** la recepción. No hay cascada, no hay alternativa, no hay fallback.

### 1.2 Lo que ya existe y no se usa

| Qué | Dónde | Estado |
|---|---|---|
| Tabla `contactos_decision` con `nombre`, `cargo`, `telefono`, `linkedin_url` | escrita en 6 puntos de `contactos/route.ts` | **`lib/llamadas.ts` nunca la consulta. Cero joins.** |
| `contacto_nombre` y `contacto_celular` | se traen en el `SELECT` de `llamadas.ts:48` | **el CSV los tiene en memoria y no los imprime** |
| `TITULOS_APOLLO` — el mejor diccionario de cargos del repo (`ceo`, `owner`, `founder`, `gerente general`) | `apolloAPI.ts:28-41` | **ningún código en producción lo llama** |
| `revelarContactoApollo` / `revelarContactoLusha` — lo único capaz de producir un móvil personal | `apolloAPI.ts:124`, `lushaAPI.ts:206` | **exportadas sin consumidor** |
| Ranking por rol (`/owner\|ceo\|founder\|director\|gerente\|manager/i`) | `prospeccion/enriquecedor.ts:163-169` | **la única heurística de decisor del repo; su rama está muerta porque falta `SERPER_API_KEY`** |
| `seniority` que devuelve Lusha | `lushaAPI.ts:76` | **se tipa y se descarta** |

### 1.3 Tres fallas silenciosas

1. **`APOLLO_API_KEY` y `LUSHA_API_KEY` no existen** en `.env.local` ni en `.env.example`. La fuente por defecto es `"todas"`, que llama a Lusha, que lanza, y `contactoCombinado.ts:107` se traga el error con un `.catch(() => ...)`. **Creemos que consultamos tres proveedores y consultamos uno.**
2. **`SERPER_API_KEY` tampoco está configurada.** `serper()` retorna `[]` sin error (`enriquecedor.ts:101`) y toda la rama de búsqueda de nombres está muerta.
3. **El score no mide nada relacionado con quién contesta.** `calcularScore` (`scoring.ts:45-147`) mide grado de automatización del negocio —fit de producto—, no acceso al decisor. El único ítem cercano, `esCelular()`, vale 10 puntos sobre 100 y no ordena nada.

---

## 2. El giro: el nombre vale más que el teléfono

En una micro-pyme, pedir *"¿me pasas con el encargado?"* es una auto-delación: solo un desconocido que vende ignora el nombre. Pedir *"¿está Rodrigo?"* es indistinguible de un cliente, un proveedor o el contador.

No existe un experimento controlado que aísle esta variable, pero el consenso de la industria es unánime y el mecanismo es evidente. Lo que **sí** está medido:

- **Conmutador: 3-5% de conexión. Marcado directo: 8-15%.** (2-3x)
- Ratio de marcados por conexión: **móvil 10:1, central 59:1, fijo de escritorio 73:1.**
- **Nunca abrir con "¿te pillo en mal momento?"**: 0,9% de éxito contra 1,5% de no decir nada — es 40% *peor* que nada. Abrir con *"¿cómo has estado?"* da 10,01%. (Gong, 90.380 llamadas reales.)
- **La calidad del número domina sobre la insistencia**: sobre números buenos, 8 intentos acumulan 42% de contacto; sobre números malos, 2,4%. (ConnectRate, 1,2M de llamadas.)

Ese último dato es el de mayor ROI de todo el informe: **invertir en verificar números rinde más que insistir**.

---

## 3. Las cuatro fuentes chilenas gratis

Ninguna herramienta gringa las conoce. Todas verificadas contra la fuente en vivo.

### 3.1 ⭐ Registro de Empresas y Sociedades — datos.gob.cl — **US$0**

https://datos.gob.cl/dataset/registro-de-empresas-y-sociedades

14 CSV, **1.590.980 constituciones** desde 2013 hasta junio 2026. Columnas: `RUT, Razón Social, Fecha, Comuna Tributaria, Región, Código de sociedad, Tipo de actuación, Capital, Comuna Social`.

**El hallazgo que cambia el juego:** analizando el archivo 2024 (165.258 empresas),

- **el 62,3% de las EIRL llevan un apellido chileno en su razón social.** Una EIRL es, por definición legal, **una sola persona natural**. Ese apellido *es* el dueño. Ejemplo real del archivo: `Venta de prendas Martín Gutiérrez E.I.R.L.`
- **el 17,3% del total** lleva apellido. Ejemplos: `Larenas Carrasco Marcelo Alejandro SpA` (nombre completo), `Consultoría y bienestar Rebolledo Rodríguez Limitada` (los dos socios).
- Capital mediano: **CLP $2.000.000**. Confirma que la masa son micro-empresas: exactamente nuestro ICP.

Con un diccionario decente de apellidos chilenos, la tasa de extracción sube bastante por sobre ese 62%. **Esto es nombre de dueño, gratis, a escala, sin llamar a ninguna API.**

Límite honesto: no cubre empresas anteriores a 2013 constituidas por escritura notarial, ni personas naturales con giro.

### 3.2 ⭐ NIC Chile WHOIS — **US$0, sin captcha**

`https://www.nic.cl/registry/Whois.do?d=EMPRESA.cl`

Devuelve el campo **`Titular`** en texto plano, respuesta en menos de un segundo, HTML trivial de parsear. Verificado: `nutricionintegral.cl → Titular: Cristian Carrillo`.

Para micro-pymes el titular es **muy frecuentemente la persona natural dueña, con nombre y apellido**. Y ya tenemos el dominio: Places nos da `websiteUri`.

Es la mejor relación esfuerzo/resultado de todo el plan. Se implementa en una tarde.

### 3.3 Nómina de Personas Jurídicas del SII — **US$0**

https://www.sii.cl/sobre_el_sii/nominapersonasjuridicas.html

Cuatro nóminas `.txt`, actualizadas a agosto 2026. La cuarta trae **ventas, número de trabajadores, rubro, tipo de contribuyente y capital propio**.

**Esto nos da el filtro "1 a 15 trabajadores" con dato oficial del SII**, infinitamente más fiable que estimar por reseñas de Google. Hoy no filtramos por tamaño en absoluto.

No trae representantes legales.

### 3.4 API de Mercado Público — **US$0, API real**

https://www.chilecompra.cl/api/ · ticket gratis por formulario, 10.000 requests/día

El objeto `Proveedor` de una orden de compra devuelve:

```json
{"Nombre":"JUBISA ANGÉLICA", "RutSucursal":"76.606.682-8",
 "NombreContacto":"JUBISA ANGÉLICA MONTECINO ROJAS",
 "CargoContacto":"...", "FonoContacto":"", "MailContacto":""}
```

**Nombre completo de la persona, cargo, teléfono y mail.** En micro-pymes el `NombreContacto` es casi siempre el dueño. Solo cubre a quienes venden al Estado —bien para imprentas y distribuidoras, mal para centros de nutrición— pero es gratis y es una API de verdad.

### 3.5 Descartadas, con razón

| Fuente | Por qué no |
|---|---|
| **Apollo** (US$59-149/mes) | Se alimenta de LinkedIn + dominios corporativos. Cobertura del Cono Sur descrita como "thin" por todas las fuentes independientes. Techo de 10-20% de móviles de decisor en segmento local/oficios. **Hueco estructural justo donde está nuestro ICP.** |
| **Lusha** (US$22-70/mes) | Peor que Apollo: es una extensión de LinkedIn. Si el prospecto no tiene LinkedIn, Lusha es literalmente cero. Cero evidencia de cobertura chilena. Plan gratis = 4 teléfonos al mes. |
| **SII consulta de terceros** | Verificado leyendo el bundle JS de la app: devuelve razón social, giros y timbrajes. **No entrega representante legal ni socios.** |
| **Diario Oficial** | El extracto sí publica nombres de socios, pero **no hay buscador por razón social** (solo navegación por calendario) y el sitio bloquea scraping con F5. Inútil para prospección dirigida. |
| **Bases compradas** (~CLP $90.000) | Únicas que prometen `representante legal`, pero sin reseñas independientes, toleran 20% de bounce, y bajo Ley 21.719 **la carga de acreditar el origen lícito recae en nosotros, no en el vendedor**. Solo tras validar una muestra de 100 filas. |

---

## 4. ⚠️ Lo que obliga a repensar el canal

Esta sección no la pediste y es la más importante del documento.

### 4.1 El teléfono en Chile está quemado

- **SUBTEL, obligatorio desde el 13-ago-2025:** las llamadas comerciales de **prospección a no-clientes deben salir con prefijo 809**. El 600 quedó restringido en junio 2026 exclusivamente a soporte de servicios ya contratados. Multa de **5 a 5.000 UTM**.
- **Cadem (enero 2026): el 79% de los chilenos no contesta llamadas con prefijo 600 u 809.** De los que contestan, solo el 25% escucha la oferta; 18% bloquea el número.
- **Truecaller (2026): Chile es el segundo país del mundo con más spam telefónico.** El 70% de las llamadas de números desconocidos son spam, contra 51% seis meses antes.

**Pregunta directa que hay que responder esta semana: ¿desde qué número estamos llamando hoy?** Si es un móvil normal o un fijo, estamos fuera de norma. Si nos ponemos en norma, perdemos 4 de cada 5 contestaciones. No hay salida limpia: hay que rediseñar para que la llamada valga más por conversación.

### 4.2 WhatsApp en frío no es una opción, y el riesgo es nuestro producto

Política de Meta, literal: solo puedes contactar por WhatsApp si **(a)** la persona te dio su número **y (b)** te dio permiso explícito. Son copulativas. Que el número esté publicado en Instagram o en la vitrina **no cumple (a)**.

El castigo no es una multa: es que Meta baje nuestro *quality tier*, limite el envío, y eventualmente **suspenda el número**. Vendemos asistentes de WhatsApp. **Prospectar en frío por WhatsApp nos expone a perder el canal que es nuestro producto.**

### 4.3 Ley 21.719 — 1 de diciembre de 2026, en 3,5 meses

- Hoy rige la Ley 19.628, cuyo artículo 4 **permite** tratar datos de fuentes públicas para comercialización directa sin consentimiento. **Hoy estamos bien.**
- Desde el 1-dic-2026, "fuente de acceso público" **deja de ser base de licitud autónoma**. Habrá que invocar **interés legítimo** con un test de balanceo **documentado por escrito y previo** al tratamiento.
- **No existe exención B2B.** La ley no distingue dato profesional de dato personal. Y nuestro ICP son EIRL y personas naturales con giro: el RUT, el nombre y el celular del negocio **son datos personales de una persona natural**.
- Multas hasta 20.000 UTM. Las pymes tienen un año de gracia solo con amonestaciones.
- ⚠️ Hay discusión activa sobre postergar la vigencia (el Consejo Directivo de la Agencia sigue sin nombrarse). **Al 11-08-2026 la fecha legal sigue siendo el 1-dic-2026.** Revisar mensualmente.

### 4.4 La conclusión de diseño

> **La llamada no es el canal de cierre. Es el mecanismo para capturar opt-in.**

El cierre estándar del guion pasa a ser: obtener **consentimiento verbal explícito** para enviar información por WhatsApp, y registrarlo con fecha, hora y ejecutivo. Eso resuelve tres problemas de una vez:

1. Cumple la política de Meta y protege nuestro número.
2. Nos da base de licitud sólida bajo la Ley 21.719.
3. Mueve al prospecto al único canal que la gente sí abre (89,7% de penetración en Chile).

**Esto exige un cambio en el CSV y en la base: una columna de resultado "aceptó recibir info por WhatsApp" y un campo `optin_whatsapp` con timestamp.** Es un cambio chico con valor legal y comercial desproporcionado.

---

## 5. Arquitectura propuesta

```
CAPA 1 — UNIVERSO Y TAMAÑO                                    US$0
  RES (datos.gob.cl)     → RUT, razón social, comuna, capital, tipo societario
  Nómina PJ del SII      → N° trabajadores, ventas, rubro
  ⇒ filtro real de 1-15 personas (hoy no existe)
  ⇒ EIRL + apellido en razón social = DUEÑO YA IDENTIFICADO, gratis

CAPA 2 — FICHA Y TELÉFONO                              ~US$20-40/mes
  Places API Text Search (Enterprise)
  FieldMask: displayName, formattedAddress, nationalPhoneNumber,
             websiteUri, businessStatus, primaryType,
             pureServiceAreaBusiness, rating, userRatingCount
  ⇒ ~US$1,75 por 1.000 fichas (20 lugares por llamada)
  ⇒ +US$0,25/mil si activamos Atmosphere para leer nombres propios
     en el texto de las reseñas ("me atendió don Sergio")

CAPA 3 — NOMBRE DEL DUEÑO                              US$50 prepago
  NIC Chile WHOIS sobre websiteUri     → Titular          US$0
  API Mercado Público por RUT          → NombreContacto   US$0
  Serper: site:instagram.com "<negocio>" <comuna>
          site:linkedin.com/in "<negocio>"
  Scraping propio de la página "Nosotros" del sitio

CAPA 4 — PRIORIZACIÓN Y GUION                                 US$0
  Score de acceso al decisor (nuevo, separado del score de fit)
  Segmentación celular / fijo → dos guiones distintos
  Captura de opt-in de WhatsApp

TOTAL RECURRENTE: US$30-60/mes. Sobran US$40-70 del presupuesto.
```

**Nota sobre Google Places:** el crédito gratis de US$200/mes **ya no existe** — se eliminó el 1 de marzo de 2025 y se reemplazó por cupos gratuitos por SKU (Text Search Pro 5.000/mes, Enterprise 1.000/mes, acumulables entre SKUs). Igual sale barato porque cada Text Search devuelve hasta 20 fichas.

**Nota sobre términos de Google:** cachear indefinidamente el dump de Places va contra sus Service Terms (§15.3; lat/long máximo 30 días, §14.3). La arquitectura defendible es guardar `place_id` + nuestros datos derivados y refrescar bajo demanda, no persistir el volcado crudo.

---

## 6. Cambios concretos en RespondoHQ

### Fase 1 — Cerrar lo que ya está construido (1 día, US$0)

| # | Archivo | Cambio |
|---|---|---|
| 1 | `lib/llamadas.ts:48` + query | Join a `contactos_decision`; traer `nombre`, `cargo`, `telefono` del decisor |
| 2 | `csv-llamadas/route.ts:72-77` | Nuevas columnas: **`Preguntar por`**, **`Cargo`**, **`Tipo de número`**, **`Aceptó WhatsApp ✍`** |
| 3 | `csv-llamadas/route.ts:97` | Imprimir el teléfono del decisor si existe; si no, `contacto_celular`; si no, `telefono`. Hoy imprime siempre el último |
| 4 | `lib/llamadas.ts:96-98` | Reordenar: decisor identificado > celular > score. Hoy solo score |
| 5 | `.env.local` | Agregar **`SERPER_API_KEY`** (US$50 / 50.000 consultas, duran 6 meses) → revive `enriquecedor.ts` |
| 6 | `.env.example` | Documentar `SERPER_API_KEY`; **borrar** las referencias a Apollo y Lusha para que nadie vuelva a creer que están activas |
| 7 | `contactoCombinado.ts:107` | Que el `.catch` **registre** el proveedor caído en vez de tragárselo |

**Solo el punto 3 ya cambia el listado**, porque `contacto_celular` está poblado en parte de los registros y hoy se ignora.

### Fase 2 — Las fuentes chilenas (3-4 días, US$0)

| # | Qué | Dónde |
|---|---|---|
| 8 | Migración: `prospects.contacto_cargo`, `prospects.tipo_telefono` (`celular\|fijo`), `prospects.optin_whatsapp` (timestamptz), `prospects.fuente_decisor` | nueva migración SQL |
| 9 | `lib/fuentes/nicWhois.ts` — consulta WHOIS de NIC Chile sobre el dominio de `websiteUri`, extrae `Titular` | nuevo |
| 10 | `lib/fuentes/mercadoPublico.ts` — API de ChileCompra por RUT → `NombreContacto` + `CargoContacto` | nuevo |
| 11 | `lib/fuentes/resChile.ts` — carga del CSV del RES + extractor de apellidos sobre `Razón Social`, con diccionario de apellidos chilenos. Marcar EIRL como confianza alta | nuevo |
| 12 | `lib/scoring.ts` — **nuevo `scoreAccesoDecisor()` separado del score de fit**. No mezclar: uno mide si nos van a comprar, el otro si vamos a poder hablar con quien decide | `scoring.ts` |

### Fase 3 — Guion y medición (1 día)

| # | Qué |
|---|---|
| 13 | Dos guiones en el CSV según `tipo_telefono`: **celular** → directo al opener; **fijo** → técnica de nombre de pila |
| 14 | Columna "Aceptó WhatsApp" y registro de `optin_whatsapp` en `/api/prospects/llamada` |
| 15 | Panel `/llamadas`: tasa de contacto con decisor, por fuente del nombre y por tipo de número |

---

## 7. El guion, corregido con los datos

**Si el número es CELULAR** (probablemente el dueño, sin filtro que pasar):

> — Hola, ¿hablo con [Nombre]?
> — Hola [Nombre], ¿cómo has estado? *(no "¿te pillo en mal momento?" — eso baja la conversión 40%)*
> — Te llamo de Respondo, somos de Valparaíso. Vi que [señal concreta del negocio]. …

**Si el número es FIJO** (hay filtro):

> — Hola, ¿está [solo el nombre de pila]?
>
> Sin apellido, sin explicar quién eres, cerrando con la pregunta. El reflejo del portero es transferir, no interrogar. Si preguntan de parte de quién: *"De Marcelo, de Respondo"* — nombre propio, tono de quien ya habló antes. **Nunca vender al portero**: no tiene autoridad de compra y transmite la objeción ya envenenada.

**Cierre estándar de toda llamada que avanza:**

> — ¿Te parece si te mando por WhatsApp un resumen de dos líneas y un ejemplo de cómo quedaría para [su rubro]?

Ese "sí" es el activo. Se registra con fecha, hora y quién llamó.

**Cadencia:** 8 intentos en 14 días (2 el día 1 a horas distintas, 2 en días 2-3, 2 en días 5-7, 2 en días 10-14). Después del día 14 la curva se aplana: cortar o cambiar de canal. Hoy `llamadas.ts` corta en 4 intentos.

**Horario:** los estudios que existen son de oficinas gringas y recomiendan martes a jueves 10-11 y 16-17. Para micro-pyme chilena de atención a público **eso probablemente esté invertido** — el dueño está en el mesón justo en esas horas. Mi apuesta a priori es **martes a jueves 15:00-17:00**, pero no hay dato publicado: **hay que testearlo con celdas de 200 marcados**. Lo que sí está sustentado es evitar lunes en la mañana y viernes en la tarde.

---

## 8. Métricas — cómo sabremos si funcionó

Hoy no medimos ninguna de estas. Sin ellas, el rediseño es fe.

| Métrica | Definición | Base actual |
|---|---|---|
| **% con decisor identificado** | filas del CSV con `Preguntar por` no vacío | ~0% |
| **Tasa de contacto con decisor** | llamadas donde hablamos con quien decide / llamadas conectadas | desconocida |
| **Tasa de opt-in WhatsApp** | "sí, mándame" / llamadas conectadas | no existe |
| **Reuniones por 100 llamadas** | la única que importa de verdad | desconocida |
| **Contacto por tipo de número** | celular vs fijo | no se distingue |
| **Contacto por fuente del nombre** | RES / WHOIS / Mercado Público / Serper / manual | no aplica |

La última es la que dice dónde invertir después.

---

## 9. Antes de gastar un peso, verificar

1. **¿Desde qué número estamos llamando?** Si no es 809, estamos fuera de norma desde agosto 2025. Es lo primero.
2. **Hit rate real de las fuentes gratis.** Tomar 50 prospectos actuales y correr a mano: WHOIS, RES, Mercado Público. Si el NIC WHOIS resuelve más del 30%, la Fase 2 se paga sola.
3. **Si con ClaveÚnica propia se puede sacar el Certificado de Estatuto Actualizado de una empresa ajena** en el RES (trae socios y administrador, y es gratis). La ley dice que el registro es público; nadie lo ha probado. **10 minutos con la ClaveÚnica de cualquiera de nosotros.**
4. **Apollo plan gratuito**: 20 búsquedas manuales de empresas chilenas de nuestro ICP. Si el acierto es menor a 20% —mi predicción— queda cerrado el tema para siempre.
5. **Estado de la Ley 21.719.** Revisar mensualmente si postergan el 1 de diciembre.
6. **Abogado**, antes de diciembre: test de interés legítimo documentado, y si el prefijo 809 tiene o no excepción B2B (no logré resolverlo en fuentes).

---

## 10. Qué recomiendo hacer primero

**Esta semana, sin código:** los puntos 1 y 2 de la sección 9. El del prefijo 809 es un riesgo abierto hoy; el hit rate decide todo lo demás.

**Después, Fase 1 completa.** Es un día de trabajo, cuesta cero, y solo con imprimir el contacto que ya tenemos guardado el listado mejora sin fuentes nuevas.

**Fase 2 solo si el hit rate de la sección 9.2 lo justifica.** Si el WHOIS y el RES resuelven poco en nuestro ICP real, hay que replantear antes de construir.

**Lo que NO recomiendo:** pagar Apollo o Lusha. La evidencia es consistente en que su cobertura del Cono Sur es débil, y su modelo de datos tiene un hueco estructural exactamente donde está nuestro cliente.

---

## Fuentes

**Fuentes de datos chilenas**
[RES — datos.gob.cl](https://datos.gob.cl/dataset/registro-de-empresas-y-sociedades) ·
[Registro de Empresas y Sociedades](https://www.registrodeempresasysociedades.cl/) ·
[Nómina Personas Jurídicas SII](https://www.sii.cl/sobre_el_sii/nominapersonasjuridicas.html) ·
[NIC Chile WHOIS](https://www.nic.cl/registry/Whois.do) ·
[API Mercado Público](https://www.chilecompra.cl/api/) ·
[Boletín Concursal](https://www.boletinconcursal.cl/boletin/procedimientos) ·
[Diario Oficial — Sociedades](https://www.diariooficial.interior.gob.cl/sociedades-web/)

**Marco regulatorio**
[SUBTEL — prefijos 600 y 809](https://www.subtel.gob.cl/desde-este-miercoles-las-llamadas-comerciales-y-masivas-deberan-llevar-los-prefijos-600-y-809-para-su-identificacion/) ·
[Ajuste Res. Ex. 1319/2026](https://www.biobiochile.cl/noticias/economia/consumidor/2026/06/04/gobierno-informa-ajuste-ligado-a-prefijos-600-y-809-y-que-llamadas-estatales-tendran-numero-especial.shtml) ·
[Informe BCN — Ley 21.719](https://obtienearchivo.bcn.cl/obtienearchivo?id=repositorio%2F10221%2F37137%2F1%2FInforme_12_25_Ley_Datos_Personales_rev.pdf) ·
[Ley 19.628 (texto)](https://www.dipres.gob.cl/598/articles-51683_Otrasleyes_ley19628.pdf) ·
[Interés legítimo y test de balanceo](https://confidata.cl/blog/interes-legitimo-ley-21719-test-balanceo-ejemplos-limites) ·
[WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/)

**Datos de mercado y de ventas**
[Cadem — 79% no contesta 600/809](https://www.chicureohoy.cl/actualidad/cadem-5c-79-de-los-chilenos-no-contesta-llamadas-con-prefijos-600-y-809/) ·
[Truecaller — Chile 2° en spam telefónico](https://www.emol.com/noticias/Economia/2026/05/13/1199902/chile-llamadas-spam-segundo-pais.html) ·
[Gong — 90.380 llamadas, aperturas](https://www.gong.io/blog/cold-call-opening-lines) ·
[ConnectRate — regla de los 8 intentos](https://connectrate.ai/blog/eight-attempts-reach-prospect-myth) ·
[Direct dials vs móviles](https://prospeo.io/s/direct-dials-vs-mobile-numbers) ·
[Gatekeeper](https://prospeo.io/s/cold-calling-gatekeeper)

**Precios y capacidades**
[Google Maps Platform — precios](https://developers.google.com/maps/billing-and-pricing/pricing) ·
[Fin del crédito de US$200](https://developers.google.com/maps/billing-and-pricing/march-2025) ·
[Place Details (New) — campos por tier](https://developers.google.com/maps/documentation/places/web-service/place-details) ·
[Maps Service Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) ·
[Serper.dev](https://serper.dev/) ·
[Apollo — Organization Search](https://docs.apollo.io/reference/organization-search) ·
[Cobertura B2B en Latinoamérica](https://syncgtm.com/blog/best-b2b-database-latin-america)

*Nota: no soy abogado. Los puntos de la sección 4.3 y 9.6 requieren validación con abogado chileno antes de comprometer presupuesto.*
