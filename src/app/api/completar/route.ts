import { type NextRequest } from 'next/server'
import { quienMira } from '@/lib/quien-mira'
import { traerCliente } from '@/lib/clientes'
import { armarExpediente } from '@/lib/expediente'
import { ETIQUETA_DOCUMENTO, type TipoDocumento } from '@/lib/campos'
import { documentosDe } from '@/lib/clientes'
import { camposQueBuscar, LECTURA } from '@/lib/lectura-de-documentos'
import { guardarResumen } from '@/lib/documentos'
import { explicarError, extraerFichaEnVivo, hayModelo, MODELO, partirPropuestas, sacarResumen } from '@/lib/modelo'
import { guardarPropuestas } from '@/lib/propuestas'

/**
 * Completar la ficha desde los documentos.
 *
 * Sólo propone los campos vacíos —la lista de campos que faltan se arma acá y
 * se le pasa al modelo, así no tiene ni la oportunidad de tocar lo que ya está—
 * y nada se aplica: todo queda como borrador para confirmar de a uno.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(pedido: NextRequest) {
  const quien = await quienMira()
  if (!quien) return new Response('Hay que entrar primero.', { status: 401 })
  const usuario = quien.usuario
  if (!hayModelo()) {
    return new Response('Falta la clave de Anthropic (ANTHROPIC_API_KEY). Sin eso no se puede completar la ficha.', { status: 503 })
  }

  let cuerpo: { clienteId?: number; documentoId?: number }
  try { cuerpo = await pedido.json() } catch { return new Response('No se entendió el pedido.', { status: 400 }) }

  const clienteId = Number(cuerpo.clienteId)
  if (!Number.isInteger(clienteId)) return new Response('Falta el cliente.', { status: 400 })

  const cliente = await traerCliente(clienteId, quien.alcance)
  if (!cliente) return new Response('Ese cliente no existe.', { status: 404 })
  if (cliente.faltan.length === 0) {
    return new Response('A este cliente no le falta ningún dato: no hay nada que completar.', { status: 400 })
  }

  // Se lee un documento a la vez. Cada tipo se lee distinto —un contrato no
  // dice lo mismo que una llamada de venta, y sobre todo no lo dice con la
  // misma confianza—, así que primero hay que saber cuál es.
  const documentoId = cuerpo.documentoId === undefined ? undefined : Number(cuerpo.documentoId)
  const documentos = await documentosDe(clienteId)
  if (documentos.length === 0) {
    return new Response(
      'Este cliente no tiene documentos cargados. Primero entran los documentos —pegados o subidos— y después esto propone la ficha.',
      { status: 400 },
    )
  }

  const elegido = documentoId === undefined ? null : documentos.find((d) => d.id === documentoId) ?? null
  if (documentoId !== undefined && !elegido) {
    return new Response('Ese documento no es de este cliente.', { status: 404 })
  }

  const tipo = (elegido?.tipo ?? 'otro') as TipoDocumento
  const lectura = elegido ? LECTURA[tipo] ?? LECTURA.otro : undefined

  // De lo que falta, sólo lo que este documento puede tener. Pedirle el valor
  // del programa a un onboarding es pedirle algo que no tiene: lo va a buscar
  // igual y, si se esfuerza, lo encuentra donde no está.
  const aBuscar = elegido ? camposQueBuscar(tipo, cliente.faltan) : [...cliente.faltan]
  if (aBuscar.length === 0) {
    return new Response(
      `De ${ETIQUETA_DOCUMENTO[tipo] ?? tipo} sale otra clase de datos, y los que puede dar ya están cargados. Probá con otro documento.`,
      { status: 400 },
    )
  }

  const expediente = await armarExpediente(clienteId, quien.alcance, documentoId)
  if (!expediente) return new Response('Ese cliente no existe.', { status: 404 })
  if (expediente.incluidos.length === 0) {
    return new Response(
      elegido ? 'De ese documento no se pudo leer texto.' : 'Este cliente no tiene documentos cargados.',
      { status: 400 },
    )
  }

  const permitidas = new Set(aBuscar.map((c) => c.clave))
  const codificador = new TextEncoder()

  const flujo = new ReadableStream<Uint8Array>({
    async start(control) {
      let seguirEscribiendo = true
      const escribir = (texto: string) => {
        if (!seguirEscribiendo) return
        try { control.enqueue(codificador.encode(texto)) } catch { seguirEscribiendo = false }
      }

      let completo = ''
      try {
        escribir(
          elegido
            ? `Leyendo ${ETIQUETA_DOCUMENTO[tipo] ?? tipo} «${elegido.titulo}», buscando los ${aBuscar.length} datos que este documento puede dar…\n\n`
            : `Leyendo ${expediente.incluidos.length} documento(s), buscando ${aBuscar.length} datos que faltan…\n\n`,
        )
        for await (const pedazo of extraerFichaEnVivo(expediente.texto, aBuscar, {
          clienteId, usuarioId: usuario.id, para: 'ficha', pregunta: null,
        }, lectura)) {
          completo += pedazo
          escribir(pedazo)
        }

        // El resumen se guarda aunque no haya salido ninguna propuesta: es lo
        // que evita volver a leer este documento la próxima vez.
        const resumen = sacarResumen(completo)
        if (elegido && resumen) {
          await guardarResumen({ documentoId: elegido.id, clienteId, resumen, modelo: MODELO })
        }

        const { propuestas, descartadas } = partirPropuestas(completo, permitidas)
        const guardado = await guardarPropuestas({ clienteId, crudas: propuestas, documentoId: elegido?.id ?? null })

        const sobraron = [...descartadas, ...guardado.descartadas]
        escribir('\n\n---\n')
        if (resumen && elegido) escribir('\nEl resumen de este documento quedó guardado: el diagnóstico lo va a usar sin volver a leerlo.')
        escribir(
          guardado.guardadas > 0
            ? `${guardado.guardadas} dato(s) para confirmar. Están más abajo, de a uno: el que confirmás entra a la ficha con la frase de donde salió.`
            : 'No salió ningún dato nuevo de los documentos. Lo que está arriba es lo que leyó; si ahí ves un dato que te sirve, cargalo a mano en la pestaña que corresponda.',
        )
        if (sobraron.length > 0) escribir(`\nNo entraron: ${sobraron.join(' · ')}.`)
      } catch (error) {
        escribir(`\n\n[No se pudo completar. ${explicarError(error)}]`)
      } finally {
        try { control.close() } catch { /* el navegador ya se fue */ }
      }
    },
  })

  return new Response(flujo, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}
