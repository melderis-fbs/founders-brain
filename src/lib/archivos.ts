import { escribir, filas } from './db'

/**
 * EL ARCHIVO ORIGINAL, PARA PODER VERLO COMO ES
 *
 * De un contrato se saca el texto para leerlo, pero el texto plano pierde los
 * bloques, las cláusulas y las firmas: una cláusula de garantía en texto corrido
 * no se parece a la cláusula de garantía. Así que además del texto se guarda el
 * archivo tal cual entró, y la pantalla lo muestra en un visor.
 *
 * Vive en su propia tabla a propósito: así ninguna consulta de la lista arrastra
 * los bytes sin querer.
 */

/** 8 MB. Un contrato son 200 KB; arriba de esto es un escaneo. */
export const TOPE_DEL_ARCHIVO = 8 * 1024 * 1024

const TIPOS_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/plain; charset=utf-8',
  '.vtt': 'text/plain; charset=utf-8',
  '.srt': 'text/plain; charset=utf-8',
  '.json': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
}

export function tipoMimeDe(nombre: string): string {
  const i = nombre.lastIndexOf('.')
  return TIPOS_MIME[i < 0 ? '' : nombre.slice(i).toLowerCase()] ?? 'application/octet-stream'
}

/** Sólo el PDF se puede mostrar adentro de la página; el resto se baja. */
export function seVeEnPantalla(tipoMime: string): boolean {
  return tipoMime === 'application/pdf'
}

/**
 * Guardar el archivo original de un documento.
 *
 * Si no se puede guardar, NO se cae la carga: el documento y su texto ya están,
 * que es lo que hace falta para leerlo. El archivo es un plus, y perder el plus
 * no puede costar el documento.
 */
export async function guardarArchivo(datos: {
  documentoId: number
  nombre: string
  bytes: Buffer
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (datos.bytes.byteLength > TOPE_DEL_ARCHIVO) {
    return {
      ok: false,
      error: `El archivo pesa ${Math.round(datos.bytes.byteLength / 1024 / 1024)} MB y el tope para guardarlo entero es 8 MB. El texto se cargó igual; lo que no vas a poder es abrir el original desde acá.`,
    }
  }
  try {
    await escribir(
      `insert into documento_archivo (documento_id, bytes, tipo_mime, peso)
       values ($1, $2, $3, $4)
       on conflict (documento_id) do update set
         bytes = excluded.bytes, tipo_mime = excluded.tipo_mime, peso = excluded.peso`,
      [datos.documentoId, datos.bytes, tipoMimeDe(datos.nombre), datos.bytes.byteLength],
    )
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export type ArchivoGuardado = { bytes: Buffer; tipo_mime: string; peso: number }

/** El archivo, comprobando antes que el documento sea de ese cliente. */
export async function traerArchivo(documentoId: number, clienteId: number): Promise<ArchivoGuardado | null> {
  const r = await filas<ArchivoGuardado>(
    `select a.bytes, a.tipo_mime, a.peso
       from documento_archivo a join documentos d on d.id = a.documento_id
      where a.documento_id = $1 and d.cliente_id = $2`,
    [documentoId, clienteId],
  )
  return r[0] ?? null
}

/** Qué documentos de este cliente tienen su archivo guardado, y cómo se ven. */
export async function archivosDe(clienteId: number): Promise<Map<number, { tipo_mime: string; peso: number }>> {
  const r = await filas<{ documento_id: number; tipo_mime: string; peso: number }>(
    `select a.documento_id, a.tipo_mime, a.peso
       from documento_archivo a join documentos d on d.id = a.documento_id
      where d.cliente_id = $1`,
    [clienteId],
  )
  return new Map(r.map((f) => [f.documento_id, { tipo_mime: f.tipo_mime, peso: f.peso }]))
}
