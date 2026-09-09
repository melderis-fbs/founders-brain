import { NextResponse } from 'next/server'
import { usuarioActual } from '@/lib/auth'
import { csvDePlantilla } from '@/lib/importar/plantilla'

export const runtime = 'nodejs'

export async function GET() {
  if (!(await usuarioActual())) return new NextResponse('Hay que entrar primero.', { status: 401 })
  return new NextResponse('﻿' + csvDePlantilla(), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="planilla-madre-founders.csv"',
    },
  })
}
