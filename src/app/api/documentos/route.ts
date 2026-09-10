import { NextResponse, type NextRequest } from 'next/server'
import { usuarioActual } from '@/lib/auth'
import { guardarDocumento } from '@/lib/documentos'
import { extraerTextoDeArchivo } from '@/lib/extraer-archivo'

/**
 * Subir un archivo de un cliente.
 *
 * Va por un endpoint y no por una acción de servidor, que tiene tope de 1 MB.
 * Un contrato en PDF lo pasa sin despeinarse, y en la versión anterior eso
 * trababa la carga sin decir por qué.
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
  const usuario = await usuarioActual()
  if (!usuario) return new NextResponse(null, { status: 303, headers: { location: '/login' } })

  let formulario: FormData
  try {
    formulario = await pedido.formData()
  } catch {
    return new NextResponse('No se pudo leer el archivo.', { status: 400 })
  }

  const clienteId = String(formulario.get('cliente_id') ?? '')
  if (!/^\d+$/.test(clienteId)) return new NextResponse('Falta el cliente.', { status: 400 })

  const archivo = formulario.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) {
    return volver(clienteId, 'No elegiste ningún archivo, o el que elegiste está vacío.')
  }

  const extraido = await extraerTextoDeArchivo(archivo.name, await archivo.arrayBuffer())
  if (!extraido.ok) return volver(clienteId, extraido.error)

  const guardado = await guardarDocumento({
    clienteId: Number(clienteId),
    tipo: String(formulario.get('tipo') ?? 'otro'),
    fechaBruta: String(formulario.get('fecha') ?? ''),
    titulo: String(formulario.get('titulo') ?? ''),
    texto: extraido.texto,
    archivoNombre: archivo.name,
    origen: 'archivo',
  })

  return volver(clienteId, guardado.ok ? undefined : guardado.error)
}
