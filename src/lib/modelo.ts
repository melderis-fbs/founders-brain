import Anthropic from '@anthropic-ai/sdk'
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

Te dan el expediente entero de un cliente: la ficha, la comparación con lo que tendría que estar hecho, y los documentos. Devolvé exactamente este formato, sin nada antes ni después:

## Dónde se corta
Una sola línea: el primer eslabón de la cadena que no está. No el último problema, el primero: lo que viene después no se le puede exigir hasta que eso esté.

## Por qué
Dos o tres líneas, cada afirmación con la frase del expediente o del documento que la sostiene, entre comillas. Si lo que sostiene la afirmación es un campo NO CARGADO o un hito SIN DATOS, decilo así.

## ¿Es el cliente o somos nosotros?
Una línea, y por qué. Tres respuestas posibles y ninguna más: «es el cliente», «somos nosotros», «no se puede saber con lo que hay cargado». No la adornes: si el expediente está vacío, la respuesta honesta es la tercera, y muchas veces la falta de datos es nuestra.

## Qué hacer
Tres acciones como máximo. Ni una más de tres. Cada una tiene que poder empezarse esta semana y decir quién la hace. Si con lo cargado no alcanza para recomendar nada, escribí una sola acción: cargar el dato que falta, nombrándolo.

## Qué falta cargar
Los datos que, si estuvieran, cambiarían el diagnóstico. Nombrados uno por uno. Si no falta nada importante, escribí «Nada que cambie este diagnóstico.»`

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
