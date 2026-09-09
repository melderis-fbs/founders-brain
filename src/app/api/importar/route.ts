import { NextResponse, type NextRequest } from 'next/server'
import { usuarioActual } from '@/lib/auth'
import { importarCsv } from '@/lib/importar/importar'

/**
 * El archivo entra por acá y no por una acción de servidor.
 *
 * Es la lección de la versión anterior: una acción de servidor tiene tope de
 * 1 MB, y la planilla entera no entra. Cuando se pasaba, la carga se trababa
 * sin decir por qué.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

const TOPE_BYTES = 25 * 1024 * 1024

/**
 * Redirección relativa a propósito: una absoluta armada desde la URL del pedido
 * puede cambiar de «127.0.0.1» a «localhost» (o de dominio, detrás de un proxy),
 * y ahí se pierde la cookie de sesión y la pantalla te devuelve al login sin
 * decir por qué. El navegador resuelve la relativa contra el origen que ya tiene.
 */
function irA(ruta: string) {
  return new NextResponse(null, { status: 303, headers: { location: ruta } })
}

export async function POST(pedido: NextRequest) {
  const usuario = await usuarioActual()
  if (!usuario) return irA('/login')

  const volverConError = (mensaje: string) => irA(`/importar?error=${encodeURIComponent(mensaje)}`)

  let archivo: File | null = null
  try {
    const formulario = await pedido.formData()
    const subido = formulario.get('archivo')
    archivo = subido instanceof File ? subido : null
  } catch {
    return volverConError('No se pudo leer el archivo que subiste. Probá de nuevo.')
  }

  if (!archivo || archivo.size === 0) return volverConError('No elegiste ningún archivo, o el que elegiste está vacío.')
  if (archivo.size > TOPE_BYTES) {
    return volverConError(
      `El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el tope es 25 MB. ` +
        'Si la planilla trae los textos completos, exportala en dos partes.',
    )
  }

  let contenido: string
  try {
    contenido = new TextDecoder('utf-8').decode(await archivo.arrayBuffer())
  } catch {
    return volverConError('El archivo no se pudo leer como texto. Tiene que ser un CSV exportado de la planilla.')
  }

  try {
    const reporte = await importarCsv({ contenido, archivo: archivo.name, usuarioId: usuario.id })
    return irA(`/importar/${reporte.importacionId}`)
  } catch (error) {
    // Regla 8: si la escritura falló, no se informa como aplicada.
    const mensaje = error instanceof Error ? error.message : String(error)
    return volverConError(`No se aplicó nada: ${mensaje}`)
  }
}
