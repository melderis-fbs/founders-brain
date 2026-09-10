import { type NextRequest } from 'next/server'
import { usuarioActual } from '@/lib/auth'
import { armarExpediente } from '@/lib/expediente'
import { analizarSesionEnVivo, explicarError, hayModelo, partirAnalisis } from '@/lib/modelo'
import { guardarAnalisis, traerSesion } from '@/lib/sesiones'

/**
 * Analizar una sesión. Sólo cuando alguien aprieta Analizar.
 *
 * El texto va llegando mientras se genera, y recién al final se guarda partido
 * en sus pedazos. Si se corta a la mitad no queda un análisis trunco guardado
 * como si estuviera completo.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(pedido: NextRequest) {
  const usuario = await usuarioActual()
  if (!usuario) return new Response('Hay que entrar primero.', { status: 401 })
  if (!hayModelo()) {
    return new Response('Falta la clave de Anthropic (ANTHROPIC_API_KEY). Sin eso no se puede analizar.', { status: 503 })
  }

  let cuerpo: { clienteId?: number; sesionId?: number }
  try { cuerpo = await pedido.json() } catch { return new Response('No se entendió el pedido.', { status: 400 }) }

  const clienteId = Number(cuerpo.clienteId)
  const sesionId = Number(cuerpo.sesionId)
  if (!Number.isInteger(clienteId) || !Number.isInteger(sesionId)) {
    return new Response('Falta el cliente o la sesión.', { status: 400 })
  }

  const sesion = await traerSesion(sesionId, clienteId)
  if (!sesion) return new Response('Esa sesión no es de este cliente.', { status: 404 })
  if (!sesion.transcripcion || sesion.transcripcion.trim().length < 50) {
    return new Response('Esta sesión no tiene transcripción cargada. Pegala primero.', { status: 400 })
  }

  const expediente = await armarExpediente(clienteId)
  if (!expediente) return new Response('Ese cliente no existe.', { status: 404 })

  const codificador = new TextEncoder()
  const flujo = new ReadableStream<Uint8Array>({
    async start(control) {
      let completo = ''
      try {
        for await (const pedazo of analizarSesionEnVivo(expediente.texto, sesion.transcripcion!, {
          clienteId, usuarioId: usuario.id, para: 'sesion', pregunta: `sesión ${sesion.numero ?? sesionId}`,
        })) {
          completo += pedazo
          control.enqueue(codificador.encode(pedazo))
        }
        const partido = partirAnalisis(completo)
        await guardarAnalisis({
          id: sesionId, clienteId,
          analisis: partido.texto, puntos: partido.puntos,
          compromisos: partido.compromisos, quePaso: partido.quePaso,
        })
      } catch (error) {
        control.enqueue(codificador.encode(`\n\n[No se pudo analizar. ${explicarError(error)}]`))
      } finally {
        control.close()
      }
    },
  })

  return new Response(flujo, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}
