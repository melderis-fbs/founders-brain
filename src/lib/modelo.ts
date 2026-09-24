import Anthropic from '@anthropic-ai/sdk'
import type { Campo } from './campos'
import type { LecturaDeTipo } from './lectura-de-documentos'
import { escribirDevolviendo } from './db'

/**
 * Hablar con el modelo.
 *
 * Tres cosas que valen para todo lo que pase por acá:
 *
 *  - **Nunca corre solo.** Esto se llama desde un botón, jamás al abrir una
 *    pantalla. Cada llamada cuesta plata.
 *  - **Lo que no está cargado no se inventa** (reglas 5 y 6): se dice que falta.
 *  - **Queda registrada, con lo que costó.** El otro lado de «nada corre solo
 *    si cuesta dinero» es poder mirar el número, no intuirlo.
 */

export const MODELO = 'claude-opus-5'

/** Precios por millón de tokens, para poder decir cuánto salió cada pregunta. */
const PRECIO = { entrada: 5, salida: 25, cacheEscrito: 6.25, cacheLeido: 0.5 }

let cliente: Anthropic | null = null

export function hayModelo(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function anthropic(): Anthropic {
  if (!cliente) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Falta ANTHROPIC_API_KEY. Sin esa clave, lo que usa el modelo no funciona; el resto de la aplicación sí.')
    }
    // Una clave que no está asignada a un workspace obliga a mandar el
    // workspace en un encabezado. Se soportan los dos casos: si la clave ya
    // está asignada, esta variable no hace falta.
    const workspace = process.env.ANTHROPIC_WORKSPACE_ID
    cliente = new Anthropic(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {})
  }
  return cliente
}

/**
 * Los errores de la API, en castellano y con el arreglo al lado.
 *
 * El mensaje crudo llega en inglés y a veces con media explicación. Que se lea
 * mal es la diferencia entre arreglarlo en un minuto y abrir un ticket.
 */
export function explicarError(error: unknown): string {
  const e = error as { status?: number; error?: { error?: { message?: string; type?: string } }; message?: string }
  const dice = e?.error?.error?.message ?? e?.message ?? String(error)

  if (/not scoped to a workspace/i.test(dice)) {
    return 'La clave de Anthropic no está asignada a ningún workspace. Dos arreglos: crear la clave desde adentro de un workspace en console.anthropic.com, o cargar ANTHROPIC_WORKSPACE_ID con el id del workspace.'
  }
  if (e?.status === 401) {
    return 'La clave de Anthropic no es válida o fue revocada. Generá una nueva en console.anthropic.com y cargala en ANTHROPIC_API_KEY.'
  }
  if (/credit balance|billing/i.test(dice)) {
    return 'La cuenta de Anthropic no tiene crédito. Cargá saldo en console.anthropic.com → Billing.'
  }
  if (e?.status === 429) {
    return 'Se llegó al límite de pedidos por minuto de la cuenta. Esperá un momento y volvé a preguntar.'
  }
  if (e?.status === 529 || e?.status === 503) {
    return 'El modelo está sobrecargado en este momento. Volvé a preguntar en un rato.'
  }
  if (e?.status === 400) return `El pedido al modelo no era válido: ${dice}`
  return dice
}

/**
 * Las reglas del método, que no cambian nunca.
 *
 * Va primero y se cachea: es el mismo texto para todos los clientes y todas las
 * preguntas, así que después de la primera vez se paga a una décima parte.
 */
export const REGLAS = `Sos el asistente interno de FOUNDERS, una consultora de negocios. Te van a dar el expediente de un cliente y una pregunta de su consultora.

CÓMO CONTESTÁS

1. Sin cita textual no afirmás nada sobre el cliente. Si algo sale de un documento, transcribí la frase entre comillas y decí de qué documento salió.
2. Lo que no está en el expediente, no está. No deduzcas, no estimes, no completes con lo que suele pasar. Si el dato no está cargado, la respuesta es «eso no está cargado» y, si viene al caso, dónde se carga.
3. Un campo que dice NO CARGADO no significa cero ni significa que no pasó: significa que nadie lo cargó. No concluyas «no vendió» de un campo vacío.
4. Un hito que dice SIN DATOS no se puede evaluar. Decilo así, no lo cuentes como incumplido.
5. Corto. Tres a cinco puntos como máximo, y una sola línea por punto cuando se pueda. Si te piden acciones, tres como máximo.
6. Si la pregunta no se puede contestar con lo que hay, decilo en la primera línea y después decí qué habría que cargar para poder contestarla.

CÓMO ESCRIBÍS

Como habla el equipo, en español rioplatense. Nada de «índice de avance», «score», «semáforo», «triage», «eslabón roto», «atribución», «KPI», «entidad» ni «expediente» como palabra técnica. Decí «va 4 semanas atrasado», «dónde se corta», «los números de la semana», «información del cliente». Nunca un número sin su unidad ni contra qué se compara.

No inventes puntajes. Si ponés un número, cada parte tiene que poder explicarse en una frase.`

export type Turno = { role: 'user' | 'assistant'; content: string }

export type Registro = {
  clienteId: number | null
  usuarioId: number | null
  para: string
  pregunta?: string | null
}

/**
 * Pregunta con respuesta en vivo: el texto va llegando mientras se genera.
 *
 * Es streaming a propósito, no por lucimiento: una función de Vercel se corta
 * al minuto, y una respuesta que se va escribiendo mantiene viva la conexión
 * además de que se lee antes.
 */
export async function* preguntarEnVivo(
  expediente: string,
  turnos: readonly Turno[],
  registro: Registro,
): AsyncGenerator<string, void, unknown> {
  const arranque = Date.now()

  // El expediente va en el primer mensaje y se cachea: dentro de una misma
  // conversación no cambia, así que la segunda pregunta ya no lo vuelve a pagar.
  const mensajes: Anthropic.MessageParam[] = turnos.map((t, i) =>
    i === 0 && t.role === 'user'
      ? {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: expediente, cache_control: { type: 'ephemeral' as const } },
            { type: 'text' as const, text: t.content },
          ],
        }
      : { role: t.role, content: t.content },
  )

  const stream = anthropic().messages.stream({
    model: MODELO,
    max_tokens: 4000,
    system: [{ type: 'text', text: REGLAS, cache_control: { type: 'ephemeral' } }],
    messages: mensajes,
  })

  try {
    for await (const evento of stream) {
      if (evento.type === 'content_block_delta' && evento.delta.type === 'text_delta') {
        yield evento.delta.text
      }
    }
    const final = await stream.finalMessage()
    await anotarLlamada(registro, final.usage, Date.now() - arranque, null)
  } catch (error) {
    await anotarLlamada(registro, null, Date.now() - arranque, error instanceof Error ? error.message : String(error))
    throw error
  }
}

async function anotarLlamada(
  registro: Registro,
  uso: Anthropic.Usage | null,
  ms: number,
  error: string | null,
): Promise<void> {
  const entrada = uso?.input_tokens ?? 0
  const salida = uso?.output_tokens ?? 0
  const cacheEscrito = uso?.cache_creation_input_tokens ?? 0
  const cacheLeido = uso?.cache_read_input_tokens ?? 0
  const costo =
    (entrada * PRECIO.entrada + salida * PRECIO.salida +
     cacheEscrito * PRECIO.cacheEscrito + cacheLeido * PRECIO.cacheLeido) / 1_000_000

  // Que falle el registro no puede tirar abajo la respuesta que ya se entregó.
  try {
    await escribirDevolviendo(
      `insert into llamadas_modelo
         (cliente_id, usuario_id, para, modelo, pregunta, tokens_entrada, tokens_salida,
          tokens_cache_leido, tokens_cache_escrito, costo_usd, ms, error)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
      [registro.clienteId, registro.usuarioId, registro.para, MODELO, registro.pregunta ?? null,
       entrada, salida, cacheLeido, cacheEscrito, costo, ms, error],
    )
  } catch {
    // queda sin registrar; no se le arruina la pantalla a nadie por eso
  }
}

// ── Analizar una sesión ─────────────────────────────────────────────────────

export const REGLAS_SESION = `${REGLAS}

AHORA ESTÁS ANALIZANDO UNA SESIÓN 1:1

Te dan el expediente del cliente y la transcripción de una sesión. Devolvé exactamente este formato, sin nada antes ni después:

## Qué pasó
Una sola línea, la que va a leerse en la lista de sesiones.

## Puntos
- De tres a cinco puntos. Ni uno más de cinco.
- Cada uno con la frase de la transcripción que lo sostiene, entre comillas.

## Compromisos
- Lo que el cliente se comprometió a hacer, con fecha si la dijo.
- Si no se acordó ninguno, escribí una sola línea: «No se acordó ningún compromiso.»`

export type Analisis = { texto: string; quePaso: string | null; puntos: string[]; compromisos: string[] }

export async function* analizarSesionEnVivo(
  expediente: string,
  transcripcion: string,
  registro: Registro,
): AsyncGenerator<string, void, unknown> {
  const arranque = Date.now()

  const stream = anthropic().messages.stream({
    model: MODELO,
    max_tokens: 4000,
    system: [{ type: 'text', text: REGLAS_SESION, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: expediente, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `## Transcripción de la sesión\n\n${transcripcion}` },
      ],
    }],
  })

  try {
    for await (const evento of stream) {
      if (evento.type === 'content_block_delta' && evento.delta.type === 'text_delta') yield evento.delta.text
    }
    const final = await stream.finalMessage()
    await anotarLlamada(registro, final.usage, Date.now() - arranque, null)
  } catch (error) {
    await anotarLlamada(registro, null, Date.now() - arranque, error instanceof Error ? error.message : String(error))
    throw error
  }
}

/**
 * Partir la respuesta en sus tres pedazos.
 *
 * Tolerante a propósito: si el modelo cambia una mayúscula o se saltea un
 * encabezado, se guarda igual el texto completo y lo que se haya podido
 * separar. Perder el análisis entero por un título mal escrito sería peor.
 */
export function partirAnalisis(texto: string): Analisis {
  const seccion = (titulo: string): string[] => {
    const re = new RegExp(`^#{1,3}\\s*${titulo}\\s*$`, 'im')
    const desde = texto.search(re)
    if (desde < 0) return []
    const resto = texto.slice(desde).split('\n').slice(1)
    const lineas: string[] = []
    for (const linea of resto) {
      if (/^#{1,3}\s/.test(linea)) break
      const limpia = linea.replace(/^\s*[-*•]\s*/, '').trim()
      if (limpia !== '') lineas.push(limpia)
    }
    return lineas
  }

  const quePaso = seccion('Qué pasó')[0] ?? null
  const puntos = seccion('Puntos').slice(0, 5)   // ni uno más de cinco
  const compromisos = seccion('Compromisos')
  return { texto, quePaso, puntos, compromisos }
}

// ── El diagnóstico del caso ─────────────────────────────────────────────────

export const REGLAS_DIAGNOSTICO = `${REGLAS}

AHORA ESTÁS HACIENDO EL DIAGNÓSTICO DE UN CASO

QUÉ TENÉS ADELANTE

El expediente entero de un cliente, en este orden:

- LA BANDERA, si hay una levantada. Es lo único que no se calcula: lo escribió
  una persona que habló con el cliente. Si contradice a los números, la bandera
  tiene razón y los números están viejos.
- LA FICHA, con «NO CARGADO» donde falta el dato.
- LA LECTURA HECHA CON ARITMÉTICA. Eso ya está calculado y es correcto: no lo
  recalcules ni lo discutas. Partí de ahí.
- EL PROGRAMA: las cuatro fases, qué se trabaja en cada una y qué hitos clave
  están marcados. «SIN MARCAR» quiere decir que nadie lo marcó, NO que no haya
  pasado: los marca la consultora a mano.
- LA COMPARACIÓN de lo que tendría que estar hecho contra lo que está.
- LOS DOCUMENTOS, la mayoría por su resumen.
- LAS SESIONES con lo que salió de cada una.
- LO QUE NO SE SOSTIENE: campos que se reescribieron varias veces.
- LAS NOTAS de la consultora y los CAMBIOS DE CONSULTORA.

TRES COSAS QUE SE CONFUNDEN Y NO SON LO MISMO

1. «NO CARGADO» y «SIN DATOS» y «SIN MARCAR» no significan que algo no pasó.
   Significan que nadie lo escribió. De un campo vacío no se concluye nada.
2. Que el cliente haya pasado por una etapa del programa no quiere decir que el
   hito esté cerrado. Vio «Tu Oferta en Una Página» y puede no tener la oferta.
   Esa diferencia es material: decila cuando la veas.
3. Un cliente que cambió de consultora arranca de nuevo cada vez. Si hay
   cambios de mano, los atrasos de esas semanas pueden no ser del cliente.

CÓMO DEVOLVÉS

Exactamente este formato, sin nada antes ni después:

## Dónde se corta
Una sola línea: lo primero de la cadena que no está. No el último problema, el
primero: lo que viene después no se le puede exigir hasta que eso esté.

## Por qué
Dos o tres líneas. Cada afirmación con la frase del expediente que la sostiene,
entre comillas. Si lo que la sostiene es un campo NO CARGADO, un hito SIN DATOS
o un hito SIN MARCAR, decilo con esas palabras.

## ¿Es el cliente o somos nosotros?
Una línea, y por qué. Tres respuestas posibles y ninguna más: «es el cliente»,
«somos nosotros», «no se puede saber con lo que hay cargado». No la adornes: si
el expediente está vacío la respuesta honesta es la tercera, y muchas veces la
falta de datos es nuestra. Si el cliente cambió de manos, tenelo en cuenta.

## Qué hacer
Tres acciones como máximo. Ni una más de tres. Cada una tiene que poder
empezarse esta semana y decir quién la hace. Si con lo cargado no alcanza para
recomendar nada, escribí una sola acción: cargar el dato que falta, nombrándolo.

## Qué falta cargar
Los datos que, si estuvieran, cambiarían el diagnóstico. Uno por uno. Si no
falta nada importante, escribí «Nada que cambie este diagnóstico.»`

export async function* diagnosticarEnVivo(
  expediente: string,
  registro: Registro,
): AsyncGenerator<string, void, unknown> {
  const arranque = Date.now()

  const stream = anthropic().messages.stream({
    model: MODELO,
    max_tokens: 4000,
    system: [{ type: 'text', text: REGLAS_DIAGNOSTICO, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: expediente, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: 'Hacé el diagnóstico de este caso.' },
      ],
    }],
  })

  try {
    for await (const evento of stream) {
      if (evento.type === 'content_block_delta' && evento.delta.type === 'text_delta') yield evento.delta.text
    }
    const final = await stream.finalMessage()
    await anotarLlamada(registro, final.usage, Date.now() - arranque, null)
  } catch (error) {
    await anotarLlamada(registro, null, Date.now() - arranque, error instanceof Error ? error.message : String(error))
    throw error
  }
}

export type Diagnostico = {
  texto: string
  dondeSeCorta: string | null
  deQuienEs: string | null
  acciones: string[]
  faltaCargar: string[]
}

/** Igual de tolerante que el de las sesiones: nunca se pierde el texto. */
export function partirDiagnostico(texto: string): Diagnostico {
  const seccion = (titulo: string): string[] => {
    const re = new RegExp(`^#{1,3}\\s*${titulo}\\s*$`, 'im')
    const desde = texto.search(re)
    if (desde < 0) return []
    const lineas: string[] = []
    for (const linea of texto.slice(desde).split('\n').slice(1)) {
      if (/^#{1,3}\s/.test(linea)) break
      const limpia = linea.replace(/^\s*[-*•]\s*/, '').trim()
      if (limpia !== '') lineas.push(limpia)
    }
    return lineas
  }

  return {
    texto,
    dondeSeCorta: seccion('Dónde se corta')[0] ?? null,
    deQuienEs: seccion('¿Es el cliente o somos nosotros\\?')[0] ?? null,
    acciones: seccion('Qué hacer').slice(0, 3),   // ni una más de tres
    faltaCargar: seccion('Qué falta cargar'),
  }
}

// ── Completar la ficha desde los documentos ─────────────────────────────────

/**
 * El prompt de extracción se arma con los campos que FALTAN, no con todos.
 *
 * Dos razones: no tiene sentido pedirle que lea lo que ya está, y sobre todo
 * así no puede proponer nada sobre un campo que ya tiene valor. La regla 9 no
 * queda confiada a que el modelo se porte bien: no le damos la oportunidad.
 */
export function reglasDeFicha(camposQueFaltan: readonly Campo[], documento?: LecturaDeTipo): string {
  const lista = camposQueFaltan
    .map((c) => `- ${c.clave} — ${c.etiqueta}${c.ayuda ? ` (${c.ayuda})` : ''} → ${comoSeEscribe(c)}`)
    .join('\n')

  return `${REGLAS}

AHORA ESTÁS COMPLETANDO UNA FICHA A PARTIR DE LOS DOCUMENTOS

Te dan el expediente de un cliente. Buscá en los DOCUMENTOS los datos que faltan y proponelos.${documento ? `

QUÉ DOCUMENTO ESTÁS LEYENDO

${documento.queEs}

CUIDADO CON ESTO, QUE ES LO QUE SE CONFUNDE EN ESTE TIPO DE DOCUMENTO

${documento.cuidado}` : ''}

LOS ÚNICOS CAMPOS QUE PODÉS PROPONER SON ESTOS:

${lista}

Cualquier otro campo ya tiene valor cargado. No lo toques, no lo menciones, no lo propongas.

CÓMO DEVOLVÉS

Primero un resumen del documento, así:

### resumen
Tres a cinco renglones: qué es este documento, qué dice de este cliente que sirva para
entender su caso, y qué quedó sin contestar. Sin adjetivos y sin conclusiones tuyas: lo
que el documento dice. Esto se guarda y se vuelve a leer cada vez que alguien mira este
cliente, así que tiene que servirle a alguien que no leyó el documento.

Y después un bloque por campo que encontraste, exactamente así:

### clave_del_campo
valor: el dato, solo, sin explicación
cita: «la frase textual del documento, copiada tal cual»

REGLAS QUE NO TIENEN EXCEPCIÓN

1. Sin cita no hay propuesta. Si no podés copiar una frase del documento que lo diga, ese campo no va.
2. Lo que no está en el documento, no está. Nada de deducir, estimar, redondear ni completar con lo que suele pasar. Si el documento dice «factura más o menos dos palos», no propongas 2000000: no lo dice.
3. La cita se copia literal del documento, no se parafrasea. Si la tenés que arreglar para que se entienda, no la uses.
3 bis. El valor tiene que estar sostenido POR ESA CITA, no por otro pedazo del documento. Si para justificarlo necesitás una segunda frase, entonces o ponés las dos frases en la cita, o dejás en el valor solamente lo que dice la primera. Un valor que dice más que su cita es un dato inventado con apariencia de citado.
4. Si no encontrás ningún dato para completar, el resumen va igual: el resumen es de lo que el documento dice, no de lo que llenó.
5. El valor va en la forma que pide la flecha de cada campo. Si es un número, va el número solo: «6», no «6 años» ni «seis». La explicación queda en la cita, que es donde tiene que estar.
6. Si el documento contradice lo que ya está cargado —otro rubro, otros números—, proponé igual lo que dice el documento y avisá al final, en una línea: «Ojo: el documento habla de X y la ficha dice Y». No te guardes las propuestas por eso. La que decide es la consultora: si no proponés nada, le sacás la decisión y encima no se entera de la contradicción.
7. Mejor proponer tres datos sólidos que doce dudosos: cada uno va a ser confirmado por una persona, y una propuesta floja le hace perder tiempo.`
}

/**
 * CRUZAR LOS TRES DOCUMENTOS DE UNA VEZ
 *
 * Leer de a uno significa apretar tres veces, esperar tres veces y revisar tres
 * tandas de propuestas donde el mismo campo aparece dos o tres veces con
 * valores distintos. Eso no es más información: es más trabajo.
 *
 * Leídos juntos, el modelo puede resolver el conflicto él —tiene la tabla de
 * quién le gana a quién— y proponer UNA sola cosa por campo. Lo que no puede
 * hacer es esconder el conflicto: lo que resolvió va en una sección aparte,
 * porque una contradicción entre el onboarding y el match de marca casi siempre
 * es el programa funcionando, y eso vale más que el dato.
 */
export function reglasDelCruce(camposQueFaltan: readonly Campo[], tiposPresentes: readonly string[]): string {
  const lista = camposQueFaltan
    .map((c) => `- ${c.clave} — ${c.etiqueta}${c.ayuda ? ` (${c.ayuda})` : ''} → ${comoSeEscribe(c)}`)
    .join('\n')

  const cuales = tiposPresentes.map((t) => `- ${t}`).join('\n')

  return `${REGLAS}

AHORA ESTÁS CRUZANDO VARIOS DOCUMENTOS DE UN MISMO CLIENTE

En el expediente hay estos documentos:

${cuales}

Leelos TODOS, cruzalos entre sí y contra lo que ya está cargado en la ficha, y
proponé UNA sola cosa por campo.

LA FICHA ACTUAL ESTÁ EN EL EXPEDIENTE

Arriba de los documentos, bajo el título «## La ficha», está todo lo que HOY
tiene cargado este cliente, campo por campo. Leela antes de proponer nada.

Los que dicen NO CARGADO están vacíos. **Vacío no es cero**: quiere decir que
nadie lo escribió, no que el cliente no lo tenga. Son los únicos que podés
proponer.

Los que tienen un valor ya están cargados. No los propongas. Pero leelos igual,
porque los necesitás para dos cosas:

- **Para no contradecir sin darte cuenta.** Si la ficha dice que el ticket es
  1.800.000 y proponés una facturación de 900.000 por mes con dos ventas, los
  números no cierran. Decilo.
- **Para encontrar lo que está MAL cargado.** Si la ficha dice «Rubro: software
  a medida» y los tres documentos hablan de un estudio de arquitectura, eso es
  un error que lleva meses ahí y nadie lo vio. No lo propongas —está cargado, y
  lo que escribió una persona no se pisa solo— pero ponelo en las
  contradicciones con las dos citas. La consultora lo corrige a mano en un
  minuto; lo que no puede es enterarse si vos no se lo decís.

EL ONBOARDING SE USA ENTERO

Cada pregunta del formulario tiene al menos un campo donde va. Si terminás y hay
una respuesta del onboarding que no usaste en ningún campo, algo hiciste mal:
revisala y ubicala, o como último recurso mandala a notas_cliente.

LOS TRES DOCUMENTOS NO VALEN LO MISMO

No los trates como un solo texto. Cada uno fue escrito en otro momento, por otra
persona y con otra intención, y eso cambia cuánto le podés creer a cada dato.

**Formulario de onboarding.** Lo contestó el cliente sobre sí mismo al entrar.
Es la MEJOR fuente para todo lo que describe quién es y cómo está hoy: sus datos,
su negocio, cómo trabaja, cómo vende, qué probó, sus números, sus frustraciones,
sus miedos y lo que espera del programa.

Para cliente ideal, problema y oferta, el onboarding es el PUNTO DE PARTIDA, no
la versión final: todavía no los trabajó. Por eso esas respuestas van a los
campos que terminan en «_inicial» y NUNCA a los campos trabajados. La distancia
entre el inicial y el trabajado es el programa funcionando.

**Match de marca.** Es trabajo hecho ADENTRO del programa, en la etapa 3. Es la
ÚNICA fuente de los campos trabajados: cliente ideal, problema, deseo, promesa
(la PAI), mecanismo, pilares, diferencial, oferta y mensaje. Si el match no está,
esos campos quedan SIN PROPONER: no los completes con el onboarding.

El documento tiene dos partes que valen distinto:
- Bloques 1 a 5 y Parte 2: los escribió el cliente con su consultora. Confianza alta.
- «Chequeo final con tu IA» y todo lo que viene después: es lo que le devolvió la
  IA. Se usa, pero siempre con confianza media y con la línea «sugerido en el
  chequeo con IA», salvo que el texto muestre que el cliente lo eligió.

Si hay varias versiones de la promesa o de los pilares, gana la marcada como
final, validada o recomendada; si no hay ninguna marcada, gana la última. Las
otras van a contradicciones.

Lo que quedó como plantilla sin llenar («[frase]», «Tu respuesta:», casilleros
vacíos) NO es dato: se saltea.

**Llamada de venta.** Es la mejor fuente para el dolor con las palabras del
cliente, para sus objeciones y para lo que se le prometió en lo comercial. Es la
peor fuente para los números de su negocio: en una venta se redondea según
convenga. Sus números sólo se proponen si el onboarding no los tiene, y siempre
con confianza media.

Lo comercial de la llamada es lo que se HABLÓ, no lo firmado: va a los campos que
terminan en «prometido» o «mencionada». Lo firmado sale del contrato y no lo
cargás vos.

Cuando dos documentos dicen cosas distintas sobre el mismo campo, gana el que
corresponde por esta tabla. Pero la diferencia se informa igual: es información,
no ruido.

LOS ÚNICOS CAMPOS QUE PODÉS PROPONER SON ESTOS:

${lista}

Cualquier otro campo ya tiene valor cargado. No lo propongas. Si un documento lo
contradice, eso va en las contradicciones, no en las propuestas.

CÓMO DEVOLVÉS

Tres secciones, en este orden.

Primero, un bloque por campo que encontraste, exactamente así:

### clave_del_campo
valor: el dato, solo, sin explicación
documento: de cuál de los documentos salió
cita: «la frase textual, copiada tal cual»
confianza: alta o media

Poné media cuando la cita sostiene el valor pero con alguna interpretación de tu
parte, y decí cuál en una línea abajo. Si sacaste la cita de una pregunta
distinta a la esperada, decilo en esa misma línea.

Después:

### contradicciones
Un renglón por campo donde dos fuentes dicen cosas distintas. Cuatro clases
valen, y las cuatro importan: documento contra documento; documento contra un
valor YA CARGADO en la ficha, que es la que nadie mira nunca; un campo inicial
contra su campo trabajado, donde se ve cuánto cambió el cliente; y lo que se
dijo en la venta contra lo que figura del contrato. Así:
«campo — el onboarding dice X («cita») y el match de marca dice Y («cita»). Vale
Y porque el match de marca es posterior.»
Si no hay ninguna, escribí «no hay».
No promedies, no elijas en silencio y no la escondas.

Y al final:

### sin proponer
Un renglón por campo que quedó vacío, con su motivo. Los motivos posibles son:
- no está en ningún documento;
- el formulario de este cliente no hacía esa pregunta: los formularios viejos no
  tienen las preguntas de números, años, equipo, horas ni registro;
- el campo es trabajado y todavía no hay match de marca;
- los documentos dicen cosas distintas y no hay cómo elegir;
- la cita no alcanzaba.
Es lo que le dice a la consultora qué le queda por cargar a mano.

REGLAS QUE NO TIENEN EXCEPCIÓN

1. Sin cita no hay propuesta. Si no podés copiar una frase de un documento que lo diga, ese campo no va.
2. Lo que no está en los documentos, no está. Nada de deducir, estimar, redondear ni completar con lo que suele pasar.
3. La cita se copia literal, no se parafrasea. Si la tenés que arreglar para que se entienda, no la uses.
3 bis. El valor tiene que estar sostenido POR ESA CITA, no por otro pedazo del documento. Un valor que dice más que su cita es un dato inventado con apariencia de citado.
4. Un campo, una propuesta. Si lo encontraste en dos documentos, elegís el que gana por la tabla y el otro va a contradicciones.
5. El valor va en la forma que pide la flecha de cada campo. Si es un número, va el número solo: «6», no «6 años».
6. Separá lo que TIENE de lo que QUIERE. «Facturo 1.800.000 y quiero llegar a 5.400.000» son dos campos distintos. No los mezcles ni los promedies. Lo mismo con el texto: «facturar 5000 USD por mes y tener una oferta clara» es meta_mensual = 5000 y objetivo_meses = «una oferta clara».
7. Vacío no es cero. Si no está, se deja sin proponer. Nada de 0, «no aplica» ni «no especificado». La excepción es cuando el cliente lo declara: «trabajo solo» es equipo = 0, y un «No» a una pregunta de sí o no es un valor. Eso se propone.
8. Se lee por CONTENIDO, no por título de pregunta. Los clientes contestan seguido en la pregunta equivocada: en «miedos y creencias limitantes» cuentan qué les funcionó, o contestan dos preguntas en una. La cita va al campo que corresponde por lo que dice, y aclarás de qué pregunta la sacaste.
9. Una respuesta puede alimentar VARIOS campos. «Ofrezco mentorías de 12 hs a 1800 USD. Los clientes vienen por referidos» alimenta como_entrega, precio_actual, moneda y origen_clientes, cada uno con su pedazo de cita.
10. Números. «5 millones» es 5000000. «1.800» es 1800. Si dice «más o menos», «unos» o «alrededor de», proponé el número con confianza media. Si da un rango o valores de distintos meses, no promedies: va a facturacion_historica como texto. Si hay dos antigüedades posibles («hace 20 años empecé con X, hace 8 con esto»), antiguedad_negocio es la de lo que vende HOY y la otra va en historia_negocio.
11. Datos personales. No cargues religión, salud, orientación, situación familiar ni ningún dato íntimo como valor de un campo, aunque el cliente lo cuente. Si ese dato le condiciona el trabajo, cargá la restricción recortando la cita a la parte que habla del trabajo: de «siendo padre soltero… me impone un ritmo logístico en la semana que me frustra», la cita es «me impone un ritmo logístico en la semana que me frustra». Si pide que su negocio refleje ciertos valores, cargá en el campo valores lo que pide para su negocio, en sus palabras, sin etiquetar su creencia.
12. Respuestas que no contestan. Si la respuesta es una escala suelta («del 1 al 10 un 7») o no responde lo que se preguntó, usá el resto del texto si sirve; si no, sin proponer con motivo «la cita no alcanzaba».
13. Los errores de tipeo del cliente se copian como están en la cita.
14. Mejor tres datos sólidos que doce dudosos: cada uno lo va a confirmar una persona a mano.`
}

/**
 * Decirle en qué forma esperamos el valor.
 *
 * Sin esto propone «6 años» para un campo que es un número y la propuesta se
 * descarta en la validación: el dato estaba bien leído y se perdía por la forma.
 */
function comoSeEscribe(campo: Campo): string {
  switch (campo.tipo) {
    case 'numero': return 'el número solo, sin unidad ni texto (1800000)'
    case 'entero': return 'un número entero solo (2)'
    case 'fecha': return 'la fecha en dd/mm/aaaa'
    case 'booleano': return 'sí o no'
    case 'opcion': return `una de estas, tal cual: ${(campo.opciones ?? []).join(', ')}`
    case 'texto_largo': return 'una o dos frases'
    default: return 'texto corto'
  }
}

export async function* extraerFichaEnVivo(
  expediente: string,
  camposQueFaltan: readonly Campo[],
  registro: Registro,
  documento?: LecturaDeTipo,
): AsyncGenerator<string, void, unknown> {
  const arranque = Date.now()

  const stream = anthropic().messages.stream({
    model: MODELO,
    max_tokens: 4000,
    system: [{ type: 'text', text: reglasDeFicha(camposQueFaltan, documento) }],
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: expediente, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: 'Completá lo que puedas de los campos que faltan.' },
      ],
    }],
  })

  try {
    for await (const evento of stream) {
      if (evento.type === 'content_block_delta' && evento.delta.type === 'text_delta') yield evento.delta.text
    }
    const final = await stream.finalMessage()
    await anotarLlamada(registro, final.usage, Date.now() - arranque, null)
  } catch (error) {
    await anotarLlamada(registro, null, Date.now() - arranque, error instanceof Error ? error.message : String(error))
    throw error
  }
}

export async function* cruzarDocumentosEnVivo(
  expediente: string,
  camposQueFaltan: readonly Campo[],
  tiposPresentes: readonly string[],
  registro: Registro,
): AsyncGenerator<string, void, unknown> {
  const arranque = Date.now()

  const stream = anthropic().messages.stream({
    model: MODELO,
    max_tokens: 6000,
    system: [{ type: 'text', text: reglasDelCruce(camposQueFaltan, tiposPresentes) }],
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: expediente, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: 'Cruzá los documentos y completá lo que puedas.' },
      ],
    }],
  })

  try {
    for await (const evento of stream) {
      if (evento.type === 'content_block_delta' && evento.delta.type === 'text_delta') yield evento.delta.text
    }
    const final = await stream.finalMessage()
    await anotarLlamada(registro, final.usage, Date.now() - arranque, null)
  } catch (error) {
    await anotarLlamada(registro, null, Date.now() - arranque, error instanceof Error ? error.message : String(error))
    throw error
  }
}

export type PropuestaCruda = { campo: string; valor: string; cita: string | null; documento?: string }

/**
 * El resumen del documento, que se guarda para no volver a leerlo.
 *
 * Leer un documento cuesta plata. Leerlo otra vez para el diagnóstico, y otra
 * para preparar la sesión, cuesta tres veces lo mismo por la misma
 * información. El resumen se hace una vez y de ahí en adelante es lo que
 * viaja.
 */
export function sacarResumen(texto: string): string | null {
  return sacarSeccion(texto, 'resumen')
}

/**
 * Los títulos que NO son campos: abren una sección y cierran el campo anterior.
 *
 * Sin esto, «### contradicciones» se lee como si fuera un campo llamado
 * «contradicciones», se descarta por no existir, y todo lo que viene abajo
 * —que es justo lo que hay que leer— se pega al campo de arriba.
 */
const SECCIONES = new Set(['resumen', 'contradicciones', 'sin proponer', 'sin_proponer', 'propuestas'])

/**
 * Una sección con nombre, o null si no vino o vino vacía.
 *
 * «no hay» cuenta como vacía: es la forma de decir que no encontró nada, y
 * mostrarlo como si fuera contenido es ruido.
 */
export function sacarSeccion(texto: string, nombre: string): string | null {
  const buscado = nombre.trim().toLowerCase()
  const bloques = texto.split(/^#{1,4}\s+/m).slice(1)

  for (const bloque of bloques) {
    const renglones = bloque.split('\n')
    const titulo = (renglones[0] ?? '').trim().toLowerCase().replace(/[:*]/g, '').trim()
    if (titulo !== buscado && titulo.replace(/_/g, ' ') !== buscado) continue

    const cuerpo = renglones.slice(1).join('\n').trim()
    if (cuerpo === '' || /^(no hay|ninguna|ninguno|-)\.?$/i.test(cuerpo)) return null
    return cuerpo
  }
  return null
}

/**
 * Partir lo que devolvió, y tirar lo que no sirve.
 *
 * No se confía en que el modelo acierte el formato exacto: a veces escribe
 * «### que_vende», a veces «**que_vende**» y a veces «campo: que_vende». Las
 * tres se leen igual. Lo que no se afloja es la validación: se descarta un
 * campo que no existe, un campo que no estaba faltando, o una propuesta sin
 * cita. Es la regla 5 aplicada de este lado —sin cita textual no se afirma
 * nada sobre un cliente— y no alcanza con pedírselo al modelo.
 */
export function partirPropuestas(
  texto: string,
  clavesPermitidas: ReadonlySet<string>,
): { propuestas: PropuestaCruda[]; descartadas: string[] } {
  const propuestas: PropuestaCruda[] = []
  const descartadas: string[] = []

  for (const bloque of partirEnBloques(texto, clavesPermitidas)) {
    const valor = leerRenglon(bloque.cuerpo, 'valor')
    const cita = leerRenglon(bloque.cuerpo, 'cita')

    if (!clavesPermitidas.has(bloque.campo)) { descartadas.push(`${bloque.campo}: no es un campo que estuviera faltando`); continue }
    if (valor === '') { descartadas.push(`${bloque.campo}: vino sin valor`); continue }
    if (cita === '') { descartadas.push(`${bloque.campo}: vino sin cita, así que no entra`); continue }

    const documento = leerRenglon(bloque.cuerpo, 'documento')
    propuestas.push({ campo: bloque.campo, valor, cita, ...(documento ? { documento } : {}) })
  }

  return { propuestas, descartadas }
}

/**
 * Encontrar dónde empieza cada campo.
 *
 * Un renglón abre un campo si, sacándole la decoración de markdown, queda una
 * sola palabra en minúscula: «### que_vende», «**que_vende**», «- que_vende:»,
 * «campo: que_vende». Para no confundir una palabra suelta del texto con un
 * campo, sólo se toma en serio si venía marcada (con # o con **), si es uno de
 * los campos que faltaban, o si tiene forma de clave (con guión bajo).
 */
function partirEnBloques(
  texto: string,
  clavesPermitidas: ReadonlySet<string>,
): { campo: string; cuerpo: string }[] {
  const bloques: { campo: string; cuerpo: string }[] = []
  let actual: { campo: string; cuerpo: string[] } | null = null

  for (const renglon of texto.split('\n')) {
    if (esTituloDeSeccion(renglon)) {
      if (actual) bloques.push({ campo: actual.campo, cuerpo: actual.cuerpo.join('\n') })
      actual = null
      continue
    }
    const campo = leerEncabezado(renglon, clavesPermitidas)
    if (campo) {
      if (actual) bloques.push({ campo: actual.campo, cuerpo: actual.cuerpo.join('\n') })
      actual = { campo, cuerpo: [] }
    } else if (actual) {
      actual.cuerpo.push(renglon)
    }
  }
  if (actual) bloques.push({ campo: actual.campo, cuerpo: actual.cuerpo.join('\n') })

  return bloques
}

function esTituloDeSeccion(renglon: string): boolean {
  const crudo = renglon.trim()
  if (!/^#{1,6}\s/.test(crudo) && !/^\*\*.+\*\*:?$/.test(crudo)) return false
  const limpio = crudo.replace(/^#{1,6}\s*/, '').replace(/[*`:]/g, '').trim().toLowerCase()
  return SECCIONES.has(limpio)
}

function leerEncabezado(renglon: string, clavesPermitidas: ReadonlySet<string>): string | null {
  const crudo = renglon.trim()
  if (crudo === '') return null

  const marcado = /^#{1,6}\s/.test(crudo) || /^\*\*.+\*\*:?$/.test(crudo)
  const limpio = crudo
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/[*`_]{1,2}$/, '')
    .replace(/^[*`]{1,2}/, '')
    .replace(/\s*:\s*$/, '')
    .replace(/^campo\s*:\s*/i, '')
    .trim()

  if (!/^[a-z][a-z0-9_]*$/.test(limpio)) return null
  if (marcado || clavesPermitidas.has(limpio) || limpio.includes('_')) return limpio
  return null
}

/**
 * Leer «valor:» o «cita:», aunque la frase siga en el renglón de abajo.
 *
 * Una cita larga puede venir cortada en varias líneas. Se junta todo hasta el
 * renglón en blanco o hasta que arranca otra etiqueta, y recién ahí se le
 * sacan las comillas de los extremos.
 */
function leerRenglon(cuerpo: string, etiqueta: 'valor' | 'cita' | 'documento'): string {
  const renglones = cuerpo.split('\n')
  const desde = renglones.findIndex((r) => new RegExp(`^\\s*[-*]?\\s*\\*{0,2}${etiqueta}\\*{0,2}\\s*:`, 'i').test(r))
  if (desde === -1) return ''

  const juntadas = [renglones[desde]!.replace(new RegExp(`^\\s*[-*]?\\s*\\*{0,2}${etiqueta}\\*{0,2}\\s*:\\s*`, 'i'), '')]
  for (const siguiente of renglones.slice(desde + 1)) {
    if (siguiente.trim() === '') break
    if (/^\s*[-*]?\s*\*{0,2}(valor|cita|campo|documento)\*{0,2}\s*:/i.test(siguiente)) break
    juntadas.push(siguiente.trim())
  }

  return juntadas.join(' ').trim().replace(/^[«"\u2018\u201c']+|[»"\u2019\u201d']+$/g, '').trim()
}
