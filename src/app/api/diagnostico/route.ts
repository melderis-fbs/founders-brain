import { type NextRequest } from 'next/server'
import { quienMira } from '@/lib/quien-mira'
import { guardarDiagnostico } from '@/lib/diagnosticos'
import { documentosDe, traerCliente } from '@/lib/clientes'
import { armarExpediente } from '@/lib/expediente'
import { bloquesDeLaFicha } from '@/lib/lectura'
import { listarSesiones } from '@/lib/sesiones'
import { diagnosticarEnVivo, explicarError, hayModelo, partirDiagnostico } from '@/lib/modelo'

/** El diagnóstico del caso. Sólo cuando alguien lo pide. */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(pedido: NextRequest) {
  const quien = await quienMira()
  if (!quien) return new Response('Hay que entrar primero.', { status: 401 })
  const usuario = quien.usuario
  if (!hayModelo()) {
    return new Response('Falta la clave de Anthropic (ANTHROPIC_API_KEY). Sin eso no se puede diagnosticar.', { status: 503 })
  }

  let cuerpo: { clienteId?: number }
  try { cuerpo = await pedido.json() } catch { return new Response('No se entendió el pedido.', { status: 400 }) }

  const clienteId = Number(cuerpo.clienteId)
  if (!Number.isInteger(clienteId)) return new Response('Falta el cliente.', { status: 400 })

  // Si no hay absolutamente nada cargado, la respuesta ya se sabe y no hace
  // falta pagarla: el modelo va a contestar «no hay datos» en trescientas
  // palabras y eso cuesta lo mismo que una respuesta útil.
  const cliente = await traerCliente(clienteId, quien.alcance)
  if (!cliente) return new Response('Ese cliente no existe.', { status: 404 })

  const [docs, ses] = await Promise.all([documentosDe(clienteId), listarSesiones(clienteId)])
  const ficha = bloquesDeLaFicha(cliente.valores, { documentos: docs.length, sesiones: ses.length })
  if (!ficha.valeLaPena) return new Response(ficha.queVaAPoder, { status: 400 })

  const expediente = await armarExpediente(clienteId, quien.alcance)
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
