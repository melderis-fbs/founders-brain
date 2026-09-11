import { type NextRequest } from 'next/server'
import { usuarioActual } from '@/lib/auth'
import { traerCliente } from '@/lib/clientes'
import { armarExpediente } from '@/lib/expediente'
import { explicarError, extraerFichaEnVivo, hayModelo, partirPropuestas } from '@/lib/modelo'
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
  const usuario = await usuarioActual()
  if (!usuario) return new Response('Hay que entrar primero.', { status: 401 })
  if (!hayModelo()) {
    return new Response('Falta la clave de Anthropic (ANTHROPIC_API_KEY). Sin eso no se puede completar la ficha.', { status: 503 })
  }

  let cuerpo: { clienteId?: number }
  try { cuerpo = await pedido.json() } catch { return new Response('No se entendió el pedido.', { status: 400 }) }

  const clienteId = Number(cuerpo.clienteId)
  if (!Number.isInteger(clienteId)) return new Response('Falta el cliente.', { status: 400 })

  const cliente = await traerCliente(clienteId)
  if (!cliente) return new Response('Ese cliente no existe.', { status: 404 })
  if (cliente.faltan.length === 0) {
    return new Response('A este cliente no le falta ningún dato: no hay nada que completar.', { status: 400 })
  }

  const expediente = await armarExpediente(clienteId)
  if (!expediente) return new Response('Ese cliente no existe.', { status: 404 })
  if (expediente.incluidos.length === 0) {
    return new Response(
      'Este cliente no tiene documentos cargados. Primero entran los documentos —pegados o subidos— y después esto propone la ficha.',
      { status: 400 },
    )
  }

  const permitidas = new Set(cliente.faltan.map((c) => c.clave))
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
        escribir(`Leyendo ${expediente.incluidos.length} documento(s), buscando ${cliente.faltan.length} datos que faltan…\n\n`)
        for await (const pedazo of extraerFichaEnVivo(expediente.texto, cliente.faltan, {
          clienteId, usuarioId: usuario.id, para: 'ficha', pregunta: null,
        })) {
          completo += pedazo
          escribir(pedazo)
        }

        const { propuestas, descartadas } = partirPropuestas(completo, permitidas)
        const guardado = await guardarPropuestas({ clienteId, crudas: propuestas })

        const sobraron = [...descartadas, ...guardado.descartadas]
        escribir('\n\n---\n')
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
