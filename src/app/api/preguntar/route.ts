import { type NextRequest } from 'next/server'
import { quienMira } from '@/lib/quien-mira'
import { armarExpediente } from '@/lib/expediente'
import { explicarError, hayModelo, preguntarEnVivo, type Turno } from '@/lib/modelo'

/**
 * Preguntar sobre un cliente.
 *
 * Corre sólo cuando alguien aprieta Enviar. La respuesta va llegando de a
 * pedazos: se lee antes, y además una función de Vercel se corta al minuto.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(pedido: NextRequest) {
  const quien = await quienMira()
  if (!quien) return new Response('Hay que entrar primero.', { status: 401 })
  const usuario = quien.usuario

  if (!hayModelo()) {
    return new Response(
      'Falta la clave de Anthropic (ANTHROPIC_API_KEY). Sin eso no se puede preguntar; el resto de la aplicación anda igual.',
      { status: 503 },
    )
  }

  let cuerpo: { clienteId?: number; turnos?: Turno[] }
  try {
    cuerpo = await pedido.json()
  } catch {
    return new Response('No se entendió el pedido.', { status: 400 })
  }

  const clienteId = Number(cuerpo.clienteId)
  const turnos = (cuerpo.turnos ?? []).filter((t) => t && typeof t.content === 'string' && t.content.trim() !== '')
  if (!Number.isInteger(clienteId) || turnos.length === 0) {
    return new Response('Falta el cliente o la pregunta.', { status: 400 })
  }

  const expediente = await armarExpediente(clienteId, quien.alcance)
  if (!expediente) return new Response('Ese cliente no existe.', { status: 404 })

  const ultima = turnos[turnos.length - 1]
  const codificador = new TextEncoder()

  const flujo = new ReadableStream<Uint8Array>({
    async start(control) {
      // Si el navegador se va —cierra la pestaña, cambia de pantalla— escribir
      // en el flujo revienta. Eso NO puede abortar lo que sigue: la llamada ya
      // se pagó, y el resultado tiene que quedar guardado igual.
      let seguirEscribiendo = true
      const escribir = (texto: string) => {
        if (!seguirEscribiendo) return
        try { control.enqueue(codificador.encode(texto)) } catch { seguirEscribiendo = false }
      }

      try {
        for await (const pedazo of preguntarEnVivo(expediente.texto, turnos, {
          clienteId,
          usuarioId: usuario.id,
          para: 'preguntar',
          pregunta: ultima.content.slice(0, 500),
        })) {
          escribir(pedazo)
        }
        if (expediente.omitidos.length > 0) {
          escribir(
            `\n\n---\nNo entraron por tamaño, así que esto no los tuvo en cuenta: ${expediente.omitidos.join(', ')}.`,
          )
        }
      } catch (error) {
        escribir(`\n\n[No se pudo contestar. ${explicarError(error)}]`)
      } finally {
        try { control.close() } catch { /* ya estaba cerrado porque el navegador se fue */ }
      }
    },
  })

  return new Response(flujo, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}
