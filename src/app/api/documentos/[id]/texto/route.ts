import { NextResponse } from 'next/server'
import { usuarioActual } from '@/lib/auth'
import { textoDe } from '@/lib/documentos'

/**
 * El texto completo de un documento, sólo cuando alguien lo pide.
 * En la ficha se ven el título, el tipo y el tamaño; el texto entero viaja
 * únicamente si se abre.
 */
export const runtime = 'nodejs'

export async function GET(pedido: Request, contexto: { params: Promise<{ id: string }> }) {
  if (!(await usuarioActual())) return new NextResponse('Hay que entrar primero.', { status: 401 })

  const { id } = await contexto.params
  const clienteId = new URL(pedido.url).searchParams.get('cliente')
  if (!clienteId) return new NextResponse('Falta el cliente.', { status: 400 })

  const texto = await textoDe(Number(id), Number(clienteId))
  if (texto === null) return new NextResponse('Ese documento no es de este cliente.', { status: 404 })

  return new NextResponse(texto, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
