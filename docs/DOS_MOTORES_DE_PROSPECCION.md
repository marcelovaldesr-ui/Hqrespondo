# Los dos motores de prospección de HQ

Desde ago-2026 HQ trabaja con **dos listas distintas**, no con una. No es una
mejora de la lista actual: son dos juegos con reglas propias.

| | **Llamadas del día** (`/llamadas`) | **Leads Foco** (`/foco`) |
|---|---|---|
| De dónde sale | Google Maps | SII + LinkedIn + prensa |
| Unidad | el NEGOCIO | la PERSONA |
| Teléfono | el del local | el de la empresa, para pedir por alguien con nombre |
| Quién contesta | quien esté en el mesón | recepción, y se pide por el decisor |
| Tamaño típico | micro-pyme, 1-10 personas | 20-150 trabajadores |
| Volumen | alto, se marca en serie | bajo, cada llamada se prepara |
| Guion | directo al dueño | hay que pasar el filtro |

## Por qué existe el segundo

Las dos reuniones agendadas —RS-SHOP/KTM y Aleta— salieron de un perfil de
empresa que la lista de Google Maps **nunca** habría traído. Ese perfil es el
que alimenta Leads Foco.

## Cómo se trabaja `/foco`

1. **Cola de hoy**: por defecto solo aparece lo que toca marcar ahora. Un lead
   agendado para el viernes no ensucia la lista de hoy.
2. **Orden**: primero los que tienen teléfono **y** persona identificada
   (columna `contactabilidad`), después los menos tocados, después los más
   grandes. Un lead sin número no encabeza la cola por ser una empresa grande.
3. **Ficha a la derecha**: empresa, persona, cargo, teléfono/WhatsApp/LinkedIn
   y —lo importante— **por qué llamarlos**, con la fuente. Eso es el gancho de
   apertura, no un dato de adorno.
4. **Registrar resultado**: 15 disposiciones cerradas. Cada una decide sola el
   estado, si vuelve a la cola y en cuántos días, si suma intento y si el
   número se manda a supresión. Todo queda además en la bitácora
   (`actividades`), que es de donde salen las métricas.
5. `Quedó en el portero` se cuenta **aparte** de `No contesta`. Llegar al
   filtro no es conectar; mezclarlos infla la tasa de conexión.
6. **`Éxito` crea el deal solo**: la reunión aparece en el Pipeline en la
   columna "Reunión agendada", con el contacto y la nota de la llamada. Si ya
   existía un deal con ese nombre, no se duplica.
7. **`Número equivocado` saca el teléfono de la ficha** (queda respaldado en
   la nota). Antes el lead seguía encabezando la cola con un número que ya se
   sabía malo.
8. **Regla TGP — 3 sin contestar y sale solo**: a la tercera llamada seguida
   que nadie contesta, el lead se retira de la base con el motivo en la nota.
   Cualquier respuesta —portero incluido— reinicia el contador: un portero
   prueba que el número funciona; lo que se retira es el número muerto. La
   ficha muestra el conteo (1/3, 2/3) y el botón avisa cuando la próxima es la
   última. En Llamadas del día la regla equivalente ya existía: 4 intentos sin
   contacto y el prospecto deja de aparecer.
9. **La supresión es global entre los dos motores**: si alguien pidió no ser
   contactado en Llamadas del día, acá el número aparece bloqueado en rojo.
   El lead no se esconde —correo y LinkedIn siguen abiertos— pero no se marca.

## Encaje: ¿le sirve Respondo, o solo se le puede llamar?

Tener el teléfono del gerente general no basta. Un estudio jurídico grande
cumple todo lo formal —decisor, número, capacidad de pago— y es imposible de
atender: cada consulta es distinta y nadie contrata un abogado por WhatsApp.
Lo que descarta es **el rubro y la forma de operar**, no el tamaño.

Cada lead se clasifica al importar en `alto · medio · sin evaluar · bajo · no
encaja`, con el motivo escrito. El criterio sale de las dos preguntas del
checklist ICP que se pueden responder **antes** de llamar:

- ¿cotiza o agenda seguido, con preguntas repetidas?
- ¿su mundo es el WhatsApp y el teléfono, o la licitación y la propuesta técnica?

Las otras tres del checklist (volumen real, software que ya usa, capacidad de
pago) solo se saben hablando: por eso esto ordena la cola, no reemplaza la
calificación.

**Encaja alto**: salud ambulatoria y laboratorios · alojamiento y turismo ·
repuestos y servicio automotriz *(es el perfil de KTM, una de las dos reuniones
conseguidas)* · educación · veterinarias · estética y gimnasios · corretaje.

**No encaja**: servicios jurídicos · consultoría y auditoría · todo lo que se
vende por licitación o proyecto · industria pesada · holdings e inversiones ·
outsourcing por contrato.

**Se puede corregir a mano** desde la ficha, y la corrección queda marcada:
reimportar el archivo no la pisa. La regla acierta en el grueso y se equivoca en
los bordes; quien llamó ayer sabe más que la tabla.

Por defecto la pantalla muestra solo `alto`, `medio` y `sin evaluar`. Lo que no
encaja no se borra —queda para no volver a levantarlo por error— pero sale de la
vista.

## Marcador por persona (en /metricas)

"Amaro hizo 100 llamadas, contestaron 30, agendó 3." El marcador vive arriba
de Métricas propias, con una fila por cada uno de los 4 (Marcelo, José, Tomás
y Amaro) y ventana de 7/30/90 días. Sale entero de la bitácora — los dos
motores escriben ahí — así que nunca puede discrepar del embudo.

Para que funcione, cada uno elige su nombre una vez en el selector
**"¿Quién llama?"** (está en Llamadas del día y en el modal de Leads Foco); el
navegador lo recuerda y las dos pantallas comparten la elección. Las llamadas
registradas antes de este selector quedan como "sin persona": cuentan en el
embudo, no en el marcador.

## Importar una tanda

`/foco` → **Importar CSV** → pegar el archivo con encabezados.

- Se reconocen los nombres de la Lista B (`nombre_fantasia`, `decisor_nombre`,
  `decisor_cargo`, `telefono_publico`, `senal_dolor`…) y los genéricos
  (`empresa`, `contacto`, `cargo`, `telefono`).
- **Reimportar el mismo archivo no duplica**: actualiza los datos de contacto y
  conserva intentos, resultado, recordatorio y notas.
- El separador se detecta del encabezado. (El archivo de Lista B trae punto y
  coma dentro de campos de texto: aceptar `;` como separador corría las
  columnas en 71 de 100 filas sin dar ningún error.)

## Estado de la primera tanda (`docs/Lista_B_100_leads.csv`)

100 empresas de 20-150 trabajadores, ordenadas por señal de dolor.

- **70** traen teléfono
- **37** traen decisor con nombre y cargo
- **31** traen las dos cosas → son las **llamables**
- **29** de esas 31 además **encajan** (alto o medio) → es el trabajo real

El corte por encaje de las 100: 47 alto · 49 medio · 2 sin evaluar · 2 no
encajan. Entre los 31 llamables: 18 alto, 11 medio, 1 sin evaluar y 1
descartado (un estudio jurídico de 147 personas, con gerente general y
teléfono directo: el caso exacto de un lead perfecto en el papel e imposible
en la práctica). Ojo con los 11 medios: ahí están los mayoristas y los clubes,
donde el encaje se confirma o se muere en la primera llamada.

Las otras 69 sirven para investigar (tienen web, LinkedIn de empresa y la señal
documentada), pero hoy no se pueden marcar. Subir ese 25 es el trabajo que
sigue, y hay que hacerlo en ese orden: **primero filtrar por encaje, después
buscar la persona**. Enriquecer un estudio jurídico o una empresa de montaje
industrial es gastar créditos de Apollo en un lead que igual se va a descartar.

## La cantera: `docs/Cantera_tanda2_150.csv`

La tanda 2 ya está pre-armada: **150 empresas con encaje alto por rubro**,
sacadas del universo SII de 41.507 empresas de 20-150 trabajadores, excluyendo
las 100 de la Lista B y filtrando marcas globales que el SII registra con giros
engañosos (AWS Chile figura como "enseñanza"). Composición: 25 colegios, 25
restaurantes/banquetería, 25 hoteles y alojamiento, 15 clínicas/consultas, 12
talleres automotrices, 10 salud, 9+8 educación otros/superior, 8 automotoras,
5 corretaje y el resto repuestos y veterinarias. Diversificada a propósito: máx
25 por rubro para no apostar la tanda entera a un solo guion.

Detrás quedan **~7.300 candidatas más con encaje alto** en el mismo universo.
La cantera no se agota este año.

### El flujo por lead (el mismo que produjo la Lista B)

1. La tanda se importa tal cual a Leads Foco (los encabezados ya calzan) y las
   filas caen en la cola **Por investigar**.
2. Investigar de escritorio: web y LinkedIn de empresa → confirmar el encaje
   real (la columna `encaje_probable` viene solo del rubro SII, la
   investigación la confirma o la baja) → documentar la **señal de dolor**
   mirando cómo atienden hoy.
3. Buscar la persona: LinkedIn, prensa, registros públicos.
4. Con teléfono + persona, el lead pasa solo a la cola de llamada.

**El orden importa**: investigar antes de enriquecer. Buscar el LinkedIn del
gerente de una empresa que no encaja es quemar créditos en un lead que igual
se va a descartar.

---

## Qué se trajo del Drive (ago-2026)

| Carpeta del Drive | Veredicto | Dónde vive ahora |
|---|---|---|
| TAREAS | migrado | Objetivos del equipo |
| LEADS CHILE / PERÚ | migrado | Leads Foco (importar CSV) |
| AGENDAMIENTO | migrado | Pipeline → botón **Reunión** |
| SECUENCIAS | migrado | Leads Foco → **Secuencia de correos** |
| ESTADO CLIENTES | ya existía | Clientes & Bots |
| MATERIAL VENTAS | **se queda en Drive** | PDFs que se mandan al cliente |
| MATERIAL REUNIONES | **se queda en Drive** | material por reunión, es adjunto |
| BANDEJAS | vacía | — |

### Por qué el material se queda en Drive
El brochure y las guías son PDFs que se le mandan al cliente: Drive los versiona
y los comparte bien, HQ no. Meterlos acá sería copiar un archivo binario a un
lugar peor. Lo que sí falta —y es la próxima mejora barata— es tener el **link**
a mano en la ficha del lead, para no ir a buscarlo.

### Agendamiento: por qué era el más urgente
La guía describe cuatro recordatorios cronometrados (al agendar, el día antes
~15:00, 45 min antes, 3 min antes). Un doc no le recuerda a nadie: hay que
acordarse de abrirlo, y el día que a alguien se le pasa es el día que el
prospecto no llega. Ahora los textos salen con el nombre, la fecha en español y
la hora ya puestos, y el link pegado donde corresponde. Si la reunión es a las
9:00 o 9:30, avisa que el de 45 minutos se salta — igual que el doc.

### Secuencias: se corrigió algo del original
El doc está escrito para clínicas ("atención de pacientes", "evaluaciones y
tratamientos"). Servía cuando la lista era de clínicas; con la lista actual
—colegios, hoteles, repuestos, talleres— ese texto le habla al negocio
equivocado. Ahora el cuerpo se adapta al rubro del lead y los merge tags se
rellenan solos: se acabó el "Hola {{first_name}}" enviado de verdad.

---

## El encaje, corregido con la investigación propia (ago-2026)

Al leer `ICP_RESPONDO.md` (jul-2026) e `Investigacion_Nichos_Chile.md` (jun-2026)
del Drive, las reglas de encaje quedaron desalineadas con la investigación del
propio equipo. Se corrigieron cinco cosas:

| Rubro | Antes | Ahora | Por qué |
|---|---|---|---|
| Ferretería / distribuidora | medio | **alto** | Es el ICP 1, el primero en el orden de ataque |
| Restaurantes | alto | **medio** | Build y soporte los más pesados: "no es para un solo fundador que está partiendo" |
| Estética / gimnasios | alto | **medio** | Incumbente muy alto (AgendaPro); exige +25 consultas/día |
| Taller mecánico | alto | **medio** | Rubro ya softwarizado (MasterCar, TallerHub, Ayrto) |
| Venta de repuestos | alto | **alto** | Se separó del taller: es distribuidora que cotiza (ICP 1), no taller |

### El filtro que faltaba: software incumbente
El criterio #2 de la investigación es *"si tienen AgendaPro / Reservo /
Dentalink andando, perdiste"* — es lo que hizo caer al nicho dental. Ahora es un
descarte automático: si la señal menciona AgendaPro, Reservo, Dentalink,
MasterCar, TallerHub, Bujía, DoliOne, Appli-Car, Ayrto, Kiteprop o Tokko, el
lead pasa a "no encaja".

**Caso real que estaba mal clasificado:** Labocenter figuraba en encaje alto y
en la cola de llamada, y su propia ficha decía *"agenda dental en dominio
externo (softwaredentalink)"*. Ya tenía la conversación resuelta.

### Los dos ICP top NO viven en Leads Foco
Dato duro del universo SII de 20-150 trabajadores:

- **Ferreterías: 0.** El ICP 1 son ferreterías de 3-20 empleados — están en el
  motor de Google Maps, no acá.
- **Corretaje: 397**, pero el ICP pide *"corredoras de 1-5 personas, no las
  grandes con TI"*. Las de 20-150 son justamente las que hay que evitar.

**Conclusión: cada motor tiene su ICP.**
- `/llamadas` (Google Maps, micro-pymes) → ICP 1 ferreterías y ICP 2 corredoras
  chicas y cabañas: los dos mejores del ranking.
- `/foco` (20-150 trabajadores, decisor) → ICP 3 clínicas sin software,
  alojamiento mediano, colegios y distribuidoras de repuestos.

Buscar corredoras en Foco es buscarlas donde no están.

### Ojo con los precios de los documentos del Drive
`ICP_RESPONDO.md` dice Inicial $79.000 + $290.000 de setup y Crecimiento
$149.000 + $490.000. Eso es de julio: los precios vigentes están en
`lib/types.ts` (inicial $149.990, crecimiento $269.990, empresa $449.990, setup
$0). **No se copió ningún precio de esos documentos a HQ** — solo el criterio de
nichos, que no caducó.


---

## Lectura directa del Drive operativo (19-ago-2026)

Con el conector apuntando a la cuenta correcta (`respon-do.com`) se leyeron los
documentos completos. Tres correcciones a lo que se había hecho "a ojo" desde
un video:

### 1. Las secuencias son SEIS, no una
El doc SECUENCIA tiene copy escrito para clínicas dentales, clínicas estéticas,
gimnasios, automotoras, inmobiliarias y centros boutique — 18 correos con
referencias de clientes reales y métricas por vertical. La versión que había en
HQ era copy **redactado por mí** a partir de lo que se alcanzaba a leer en el
video: sonaba bien y decía cosas que no eran ciertas. Se reemplazó por el texto
del equipo.

**Regla nueva:** si el rubro del lead no tiene secuencia escrita, HQ **no
inventa** una. Avisa y sugiere llamar. Mandar copy de otro rubro significaría
citar clientes que no aplican.

### 2. El encaje se corrigió otra vez, ahora con la realidad
En la revisión anterior se bajó estética y gimnasios a "medio", confiando en la
investigación de nichos de junio, que los marcaba en rojo por incumbente. Pero
el doc de secuencias de agosto muestra **+20 gimnasios y centros boutique y +12
clínicas estéticas como clientes**. La investigación de junio era una hipótesis;
las secuencias de agosto son la tracción. Volvieron a "alto".

Y el descarte por software incumbente bajó de "no encaja" a "medio": el ICP pide
descartar solo si el software **además** tiene el WhatsApp atendido. La propia
secuencia de gimnasios se vende diciendo *"sin cambiar las herramientas que el
centro ya utiliza"*.

### 3. Faltaba la prueba de concepto (migración 024)
`estado_clientes_respon-do.xlsx` lleva tres columnas que HQ no tenía: **Inicio
demo, Término demo, Resultado demo**. Es la POC de dos semanas que prometen los
18 correos — el centro del pitch y la etapa donde el prospecto decide.

Ahora se registra al editar un deal: se pone la fecha de inicio, el término se
calcula solo (+14 días) y la tarjeta avisa en ámbar cuando quedan 3 días y en
rojo cuando ya venció. Sin eso, una demo que empezó el 13 de agosto se apagaba
sola el 27 y nadie se enteraba.

**El tracker del Drive calza exacto con el Pipeline:** "REUNIÓN AGENDADA" y
"PROPUESTA ENVIADA" son las etapas que ya existen. Las dos empresas del archivo
—ALETA (propuesta enviada) y RS Shop (reunión agendada, Gaspar Escalona, Jefe
Post Venta)— pueden cargarse tal cual.

---

## Sincronizado con el Respondo de hoy (ago-2026)

HQ se escribió cuando Respondo era "un chatbot que contesta WhatsApp". Dejó de
serlo. Auditado contra el brochure y la **Guía interna de prospección
(ago-2026)**, que declara reemplazar versiones anteriores.

### Lo que faltaba del producto
- **Los cuatro asistentes**: Tino (ventas y atención), Beto (seguimiento y
  reactivación), Vera (postventa), **Isabel** (memoria interna — que es un
  producto que se vende como upsell del plan Empresa, no solo la asistente que
  vive en HQ).
- **La plataforma**: bandeja, agenda y reservas, embudo de oportunidades,
  métricas e informe semanal de los lunes.
- **Instagram Direct** como canal, con su límite real: no deja reabrir después
  de 24 h, por eso Beto trabaja hoy solo por WhatsApp.
- **Casos reales**: OdontoAndrauss −38% inasistencia · Qanttum 34% reactivados
  · Propiver +45% visitas.
- **La frase de categoría**: no se dice "es un chatbot para WhatsApp" (te
  comparan con un bot de $15.000), se dice **"es el turno de atención que hoy
  no tienes"**.

### El plan que faltaba
La tabla de la guía tiene **cuatro** planes; HQ tenía tres. Faltaba
**Tino solo — $120.000/mes, 800 conversaciones, excedente $90**. Sin él no se
podía cotizar al negocio chico, ni usar el argumento que más mueve al Inicial:
*Tino solo + 2 adicionales = $160.000, contra $149.990 del Inicial.*

### Los rubros: ahora se entra a más, y a otros ya no
Con agenda propia, Instagram y los tres asistentes, el mapa cambió:

**Entran** (no estaban en las reglas): canchas de pádel y fútbol · servicios
técnicos a domicilio (gasfíter, electricista, cerrajero) · mayoristas y
distribuidoras · barberías y salones.

**Salen**: ferreterías con catálogo enorme y variable · restaurantes con
pedidos · constructoras · **la consulta psicológica individual** (ver abajo:
sale el profesional solo, NO el centro).

> Ojo con las ferreterías: dos turnos atrás las subí a "alto" citando el doc
> ICP de julio, que las ponía como ICP 1. La guía de agosto —que reemplaza
> versiones anteriores— las manda a "dónde se pierde el tiempo", por la misma
> razón por la que el asistente no cotiza en imprentas: precio que depende de
> medidas y materiales. **Gana el documento más nuevo.**

### Las tres señales que ordenan la lista
La guía (§09) define tres señales de "dolor visible desde afuera" que suben un
prospecto al principio de la lista. Estaban en el documento y no existían en el
código. Ahora promueven el encaje **y** aparecen en la ficha con la frase de
apertura ya escrita:

1. Reseñas de Google quejándose de que no contestan.
2. Su contacto es formulario o correo, no un WhatsApp visible.
3. En Instagram preguntan precio y quedan sin respuesta.

### Pendiente para el equipo, no para el código
**El brochure tiene precios distintos a la guía.** El brochure dice Esencial
$120.000 / Crecimiento $220.000 / Empresa desde $400.000; la guía dice Tino solo
$120.000 / Inicial $149.990 / Crecimiento $269.990 / Empresa $449.990 — y aclara
que ella es la única versión válida. HQ quedó con **la de la guía**. Conviene
corregir el brochure antes de que alguien cotice $220.000 lo que vale $269.990.


---

## Salud mental: el tamaño decide, no el rubro

La guía interna pone "psicólogos y consulta clínica" en «dónde se pierde el
tiempo», y la primera versión de las reglas lo tomó literal: descarte total. Era
demasiado grueso, y el dato lo demuestra.

**En el universo de Leads Foco (20-150 trabajadores) no existen psicólogos
solos.** Las 19 empresas de salud mental que hay tienen una mediana de **38
trabajadores**: Centro de Atención Médico Psiquiátrica Integral (116), Corp.
para el Desarrollo de la Salud Mental Familiar (96), Servicio de Apoyo Integral
en Salud Mental (47), Instituto de Neuropsiquiatría (36)… Descartarlas a todas
era perder 19 centros reales por una línea escrita pensando en otra cosa.

**Qué separa un caso del otro:**

| | Psicólogo solo | Centro de salud mental |
|---|---|---|
| Consultas/día | 6–8 pacientes | recepción atendiendo todo el día |
| Agenda | una | por profesional |
| Quién contesta | el mismo profesional, entre sesiones | recepción, saturada |
| Inasistencia | la absorbe él | cuesta horas de box vacío |
| Encaje | **bajo** — por volumen, no por rubro | **alto** |

La línea de la guía apunta al primero: 6 a 8 pacientes al día no llegan a las
15 consultas diarias que pide el ICP, y ahí la conversación *es* la atención. El
segundo es exactamente **"clínicas y centros médicos sin software de agenda"**,
que la misma guía pone en los rubros donde mejor funciona.

**El límite clínico no se mueve:** el asistente nunca da indicación ni evalúa un
caso. Automatiza la hora, el valor, la previsión y el recordatorio — que es
justo lo que produjo el −38% de inasistencia en OdontoAndrauss. La terapia
nunca.

### Lo que esto arregló de fondo
Las reglas de encaje **no conocían el tamaño de la empresa**. Trataban igual a
un psicólogo solo y a un centro de 96 personas. Ahora una regla puede exigir un
mínimo de trabajadores y tener una variante para los chicos. Si el dato falta,
se asume el nivel principal: descartar por un dato que no tenemos es peor que
revisarlo en la llamada.

**Sugerencia para la guía:** cambiar "psicólogos y consulta clínica" por
"consulta individual de cualquier especialidad, por volumen" — el criterio real
es el volumen, y así no se pierde el centro.
