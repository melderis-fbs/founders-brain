import { NextResponse } from 'next/server'
import { usuarioActual } from '@/lib/auth'
import { traerSesion } from '@/lib/sesiones'

/** Una sesión con su transcripción, sólo cuando alguien la abre. */
export const runtime = 'nodejs'

export async function GET(pedido: Request, contexto: { params: Promise<{ id: string }> }) {
  if (!(await usuarioActual())) return new NextResponse('Hay que entrar primero.', { status: 401 })
  const { id } = await contexto.params
  const clienteId = new URL(pedido.url).searchParams.get('cliente')
  if (!clienteId) return new NextResponse('Falta el cliente.', { status: 400 })

  const sesion = await traerSesion(Number(id), Number(clienteId))
  if (!sesion) return new NextResponse('Esa sesión no es de este cliente.', { status: 404 })
  return NextResponse.json(sesion)
}
