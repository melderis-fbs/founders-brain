import { type NextRequest } from 'next/server'
import { quienMira } from '@/lib/quien-mira'
import { cuantasConTexto, encuestasDeLaCartera, juntarEncuestas } from '@/lib/encuestas'
import { buscarPatronesEnVivo, explicarError, hayModelo } from '@/lib/modelo'

/**
 * Qué se repite en las encuestas de satisfacción.
 *
 * Corre sobre la cartera de quien mira: un admin ve todas, una consultora las de
 * sus clientes. Cuesta plata, así que sólo con el botón.
 */
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(_pedido: NextRequest) {
  const quien = await quienMira()
  if (!quien) return new Response('Hay que entrar primero.', { status: 401 })
  if (!hayModelo()) {
    return new Response('Falta la clave de Anthropic (ANTHROPIC_API_KEY).', { status: 503 })
  }

  const encuestas = await encuestasDeLaCartera(quien.alcance)
  const conTexto = cuantasConTexto(encuestas)

  // Tres es el mínimo del que se puede decir algo. Con dos, cualquier cosa que
  // se parezca es una coincidencia, y llamarla patrón manda a arreglar algo que
  // no está roto.
  if (conTexto < 3) {
    return new Response(
      conTexto === 0
        ? 'Todavía no hay ninguna encuesta de satisfacción cargada. Se cargan como un documento más, eligiendo «Encuesta de satisfacción».'
        : `Hay ${conTexto} ${conTexto === 1 ? 'encuesta cargada' : 'encuestas cargadas'}. Con menos de tres no se puede hablar de patrones: lo que se parezca va a ser casualidad.`,
      { status: 400 },
    )
  }

  const texto = juntarEncuestas(encuestas)
  const codificador = new TextEncoder()

  const flujo = new ReadableStream<Uint8Array>({
    async start(control) {
      let seguir = true
      const escribir = (t: string) => {
        if (!seguir) return
        try { control.enqueue(codificador.encode(t)) } catch { seguir = false }
      }

      try {
        escribir(`Leyendo ${conTexto} encuestas de ${new Set(encuestas.map((e) => e.cliente_id)).size} clientes…\n\n`)
        for await (const pedazo of buscarPatronesEnVivo(texto, {
          clienteId: null, usuarioId: quien.usuario.id, para: 'encuestas', pregunta: null,
        })) {
          escribir(pedazo)
        }
      } catch (error) {
        escribir(`\n\n[No se pudo. ${explicarError(error)}]`)
      } finally {
        try { control.close() } catch { /* el navegador ya se fue */ }
      }
    },
  })

  return new Response(flujo, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}
