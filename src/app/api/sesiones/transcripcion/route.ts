import { NextResponse, type NextRequest } from 'next/server'
import { extraerTextoDeArchivo } from '@/lib/extraer-archivo'
import { puedeVerCliente } from '@/lib/permisos'
import { quienMira } from '@/lib/quien-mira'
import { guardarTranscripcion } from '@/lib/sesiones'

/**
 * Subir la transcripción de una sesión como archivo.
 *
 * Pegar el texto sigue siendo el camino principal, pero una transcripción de
 * Zoom o de Meet baja como archivo y son cincuenta mil caracteres: pegarlos a
 * mano es un trámite. Va por un endpoint y no por una acción de servidor,
 * que tiene tope de 1 MB y se traba sin avisar.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

function volver(clienteId: string, mensaje?: string) {
  const destino = mensaje
    ? `/clientes/${clienteId}?bloque=sesiones&error=${encodeURIComponent(mensaje)}`
    : `/clientes/${clienteId}?bloque=sesiones&cargado=1`
  return new NextResponse(null, { status: 303, headers: { location: destino } })
}

export async function POST(pedido: NextRequest) {
  const quien = await quienMira()
  if (!quien) return new NextResponse(null, { status: 303, headers: { location: '/login' } })

  let formulario: FormData
  try {
    formulario = await pedido.formData()
  } catch {
    return new NextResponse('No se pudo leer el archivo.', { status: 400 })
  }

  const clienteId = String(formulario.get('cliente_id') ?? '')
  const sesionId = String(formulario.get('sesion_id') ?? '')
  if (!/^\d+$/.test(clienteId) || !/^\d+$/.test(sesionId)) {
    return new NextResponse('Falta el cliente o la sesión.', { status: 400 })
  }
  if (!(await puedeVerCliente(Number(clienteId), quien.alcance))) {
    return new NextResponse('Ese cliente no está en tu cartera.', { status: 404 })
  }

  const archivo = formulario.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) {
    return volver(clienteId, 'No elegiste ningún archivo, o el que elegiste está vacío.')
  }

  const extraido = await extraerTextoDeArchivo(archivo.name, await archivo.arrayBuffer())
  if (!extraido.ok) return volver(clienteId, extraido.error)

  // Guardar es una cosa y analizar es otra: el análisis cuesta plata y sale
  // del botón, no de haber subido un archivo.
  const guardado = await guardarTranscripcion(Number(sesionId), Number(clienteId), extraido.texto)
  return volver(clienteId, guardado.ok ? undefined : guardado.error)
}
