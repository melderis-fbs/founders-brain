import { type NextRequest } from 'next/server'
import { quienMira } from '@/lib/quien-mira'
import { armarExpediente } from '@/lib/expediente'
import { fila } from '@/lib/db'
import { explicarError, hayModelo, partirTemperatura, tomarTemperaturaEnVivo } from '@/lib/modelo'
import { guardarTemperatura } from '@/lib/temperatura'

/**
 * Leer una encuesta de satisfacción de UN cliente y tomarle la temperatura.
 *
 * Es distinto de lo de /api/encuestas, que busca qué se repite en toda la
 * cartera. Esto mira a una persona: qué dijo ella de nosotros, y si eso tiene
 * que prender una alerta en su ficha.
 *
 * La de las sesiones no pasa por acá: viene dentro del análisis de la sesión,
 * en la misma llamada, así que no cuesta una moneda más. Una encuesta no tiene
 * dónde colgarse, así que es su propio botón.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(pedido: NextRequest) {
  const quien = await quienMira()
  if (!quien) return new Response('Hay que entrar primero.', { status: 401 })
  if (!hayModelo()) {
    return new Response('Falta la clave de Anthropic (ANTHROPIC_API_KEY). Sin eso no se puede leer.', { status: 503 })
  }

  let cuerpo: { clienteId?: number; documentoId?: number }
  try { cuerpo = await pedido.json() } catch { return new Response('No se entendió el pedido.', { status: 400 }) }

  const clienteId = Number(cuerpo.clienteId)
  const documentoId = Number(cuerpo.documentoId)
  if (!Number.isInteger(clienteId) || !Number.isInteger(documentoId)) {
    return new Response('Falta el cliente o el documento.', { status: 400 })
  }

  const documento = await fila<{ tipo: string; titulo: string; texto: string | null }>(
    'select tipo, titulo, texto from documentos where id = $1 and cliente_id = $2',
    [documentoId, clienteId],
  )
  if (!documento) return new Response('Ese documento no es de este cliente.', { status: 404 })
  if (documento.tipo !== 'encuesta') {
    return new Response('Esto sólo se le hace a una encuesta de satisfacción: es lo único que el cliente contesta sobre nosotros.', { status: 400 })
  }
  if (!documento.texto || documento.texto.trim().length < 20) {
    return new Response(
      'Esa encuesta está cargada pero no tiene texto adentro, así que no hay nada para leer.',
      { status: 400 },
    )
  }

  const expediente = await armarExpediente(clienteId, quien.alcance)
  if (!expediente) return new Response('Ese cliente no existe.', { status: 404 })

  const codificador = new TextEncoder()
  const flujo = new ReadableStream<Uint8Array>({
    async start(control) {
      let seguir = true
      const escribir = (t: string) => {
        if (!seguir) return
        try { control.enqueue(codificador.encode(t)) } catch { seguir = false }
      }

      let completo = ''
      try {
        for await (const pedazo of tomarTemperaturaEnVivo(expediente.texto, documento.texto!, {
          clienteId, usuarioId: quien.usuario.id, para: 'temperatura', pregunta: documento.titulo,
        })) {
          completo += pedazo
          escribir(pedazo)
        }
        const t = partirTemperatura(completo)
        await guardarTemperatura({
          clienteId, de: 'encuesta', origenId: documentoId,
          temperatura: t.temperatura, deQue: t.deQue, porque: t.porque,
          citas: t.citas, loOtro: t.loOtro, quePreguntar: t.quePreguntar,
        })
      } catch (error) {
        escribir(`\n\n[No se pudo. ${explicarError(error)}]`)
      } finally {
        try { control.close() } catch { /* el navegador ya se fue */ }
      }
    },
  })

  return new Response(flujo, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}
