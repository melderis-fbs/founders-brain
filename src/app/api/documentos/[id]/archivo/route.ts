import { type NextRequest } from 'next/server'
import { quienMira } from '@/lib/quien-mira'
import { puedeVerCliente } from '@/lib/permisos'
import { traerArchivo } from '@/lib/archivos'

/**
 * Servir el archivo original de un documento.
 *
 * Con `?bajar=1` se descarga; sin eso se abre en el visor del navegador, que es
 * lo que permite ver un contrato como contrato y no como texto corrido.
 */
export const runtime = 'nodejs'

export async function GET(
  pedido: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const quien = await quienMira()
  if (!quien) return new Response('Hay que entrar primero.', { status: 401 })

  const { id } = await params
  const documentoId = Number(id)
  const clienteId = Number(pedido.nextUrl.searchParams.get('cliente'))
  if (!Number.isInteger(documentoId) || !Number.isInteger(clienteId)) {
    return new Response('Falta el documento o el cliente.', { status: 400 })
  }
  if (!(await puedeVerCliente(clienteId, quien.alcance))) {
    return new Response('Ese cliente no está en tu cartera.', { status: 404 })
  }

  const archivo = await traerArchivo(documentoId, clienteId)
  if (!archivo) return new Response('De ese documento no se guardó el archivo original.', { status: 404 })

  const bajar = pedido.nextUrl.searchParams.get('bajar') === '1'
  return new Response(new Uint8Array(archivo.bytes), {
    headers: {
      'content-type': archivo.tipo_mime,
      'content-length': String(archivo.peso),
      'content-disposition': bajar ? 'attachment' : 'inline',
      'cache-control': 'private, max-age=300',
    },
  })
}
