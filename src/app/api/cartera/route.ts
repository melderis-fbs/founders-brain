import { NextResponse } from 'next/server'
import { quienMira } from '@/lib/quien-mira'
import { exportarClientes } from '@/lib/clientes'
import { csvDeCartera } from '@/lib/importar/plantilla'

/**
 * La cartera cargada, bajada con los mismos encabezados que la plantilla.
 * Es lo que hace que la planilla madre se pueda rehacer desde la aplicación:
 * bajar, corregir en la planilla, volver a subir. Como la fila se identifica
 * por el id del cliente, volver a subirla corrige y no duplica.
 */
export const runtime = 'nodejs'

export async function GET() {
  // La planilla que se baja tiene que traer lo mismo que se ve en la pantalla:
  // una consultora baja los suyos, el admin baja la cartera entera.
  const quien = await quienMira()
  if (!quien) return new NextResponse('Hay que entrar primero.', { status: 401 })

  const clientes = await exportarClientes(quien.alcance)
  const fecha = new Date().toISOString().slice(0, 10)
  return new NextResponse('﻿' + csvDeCartera(clientes), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="cartera-founders-${fecha}.csv"`,
    },
  })
}
