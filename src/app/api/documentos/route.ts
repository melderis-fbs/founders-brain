import { NextResponse, type NextRequest } from 'next/server'
import { puedeVerCliente } from '@/lib/permisos'
import { quienMira } from '@/lib/quien-mira'
import { guardarDocumento } from '@/lib/documentos'
import { extraerTextoDeArchivo } from '@/lib/extraer-archivo'

/**
 * Subir un archivo de un cliente.
 *
 * Va por un endpoint y no por una acción de servidor, que tiene tope de 1 MB.
 * Un contrato en PDF lo pasa sin despeinarse, y en la versión anterior eso
 * trababa la carga sin decir por qué.
 *
 * Atiende dos formas de pedir lo mismo:
 * - El formulario de un archivo, que manda y espera una redirección. Anda sin
 *   JavaScript y es el que sigue siendo el camino simple.
 * - La carga de varios, que manda `json=1` y espera la respuesta en JSON. Ahí
 *   el navegador manda UN archivo por pedido, de a uno, y no los quince
 *   juntos: un pedido de quince PDFs no entra en el tope de cuerpo de Vercel,
 *   y de a uno cada archivo cuenta cómo le fue en vez de caerse todo junto.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

function volver(clienteId: string, mensaje?: string) {
  const destino = mensaje
    ? `/clientes/${clienteId}?error=${encodeURIComponent(mensaje)}`
    : `/clientes/${clienteId}?cargado=1`
  return new NextResponse(null, { status: 303, headers: { location: destino } })
}

export async function POST(pedido: NextRequest) {
  let formulario: FormData
  try {
    formulario = await pedido.formData()
  } catch {
    return new NextResponse('No se pudo leer el archivo.', { status: 400 })
  }

  const enJson = formulario.get('json') === '1'
  const fallo = (mensaje: string, estado = 400) =>
    enJson ? NextResponse.json({ ok: false, error: mensaje }, { status: estado }) : volver(clienteId, mensaje)

  const quien = await quienMira()
  if (!quien) {
    return enJson
      ? NextResponse.json({ ok: false, error: 'Se cerró la sesión. Entrá de nuevo.' }, { status: 401 })
      : new NextResponse(null, { status: 303, headers: { location: '/login' } })
  }

  const clienteId = String(formulario.get('cliente_id') ?? '')
  if (!/^\d+$/.test(clienteId)) return fallo('Falta el cliente.')
  if (!(await puedeVerCliente(Number(clienteId), quien.alcance))) {
    return fallo('Ese cliente no está en tu cartera.', 404)
  }

  const archivo = formulario.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) {
    return fallo('No elegiste ningún archivo, o el que elegiste está vacío.')
  }

  const extraido = await extraerTextoDeArchivo(archivo.name, await archivo.arrayBuffer())
  if (!extraido.ok) return fallo(extraido.error)

  const guardado = await guardarDocumento({
    clienteId: Number(clienteId),
    tipo: String(formulario.get('tipo') ?? 'otro'),
    fechaBruta: String(formulario.get('fecha') ?? ''),
    titulo: String(formulario.get('titulo') ?? ''),
    texto: extraido.texto,
    archivoNombre: archivo.name,
    origen: 'archivo',
  })

  if (!guardado.ok) return fallo(guardado.error)

  return enJson
    ? NextResponse.json({ ok: true, yaEstaba: guardado.yaEstaba === true, nota: extraido.nota ?? null })
    : volver(clienteId)
}
