import { type NextRequest } from 'next/server'
import { usuarioActual } from '@/lib/auth'
import { guardarDiagnostico } from '@/lib/diagnosticos'
import { armarExpediente } from '@/lib/expediente'
import { diagnosticarEnVivo, explicarError, hayModelo, partirDiagnostico } from '@/lib/modelo'

/** El diagnóstico del caso. Sólo cuando alguien lo pide. */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(pedido: NextRequest) {
  const usuario = await usuarioActual()
  if (!usuario) return new Response('Hay que entrar primero.', { status: 401 })
  if (!hayModelo()) {
    return new Response('Falta la clave de Anthropic (ANTHROPIC_API_KEY). Sin eso no se puede diagnosticar.', { status: 503 })
  }

  let cuerpo: { clienteId?: number }
  try { cuerpo = await pedido.json() } catch { return new Response('No se entendió el pedido.', { status: 400 }) }

  const clienteId = Number(cuerpo.clienteId)
  if (!Number.isInteger(clienteId)) return new Response('Falta el cliente.', { status: 400 })

  const expediente = await armarExpediente(clienteId)
  if (!expediente) return new Response('Ese cliente no existe.', { status: 404 })

  const codificador = new TextEncoder()
  const flujo = new ReadableStream<Uint8Array>({
    async start(control) {
      // Si el navegador se va, se deja de escribir pero el diagnóstico se
      // guarda igual: la llamada ya se pagó.
      let seguirEscribiendo = true
      const escribir = (texto: string) => {
        if (!seguirEscribiendo) return
        try { control.enqueue(codificador.encode(texto)) } catch { seguirEscribiendo = false }
      }

      let completo = ''
      try {
        for await (const pedazo of diagnosticarEnVivo(expediente.texto, {
          clienteId, usuarioId: usuario.id, para: 'diagnostico', pregunta: null,
        })) {
          completo += pedazo
          escribir(pedazo)
        }
        await guardarDiagnostico({ clienteId, usuarioId: usuario.id, partido: partirDiagnostico(completo) })
      } catch (error) {
        escribir(`\n\n[No se pudo diagnosticar. ${explicarError(error)}]`)
      } finally {
        try { control.close() } catch { /* el navegador ya se fue */ }
      }
    },
  })

  return new Response(flujo, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}
