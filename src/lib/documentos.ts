import { ETIQUETA_DOCUMENTO, type TipoDocumento } from './campos'
import { escribirDevolviendo, filas } from './db'
import { leerFecha } from './valores'

/**
 * Cargar un documento de un cliente.
 *
 * Los dos caminos —pegar texto y subir archivo— terminan acá, con las mismas
 * validaciones. El archivo llega ya convertido a texto: quién lo convierte es
 * `extraer-archivo.ts`, y quién lo recibe es un endpoint del servidor, nunca
 * una acción de servidor.
 */

export const TIPOS: readonly TipoDocumento[] = ['onboarding', 'llamada_venta', 'contrato', 'sesion', 'notas', 'otro']

const MINIMO = 20

export type Guardado = { ok: true; id: number } | { ok: false; error: string }

export async function guardarDocumento(datos: {
  clienteId: number
  tipo: string
  fechaBruta?: string | null
  titulo?: string | null
  texto: string
  archivoNombre?: string | null
  origen: 'pegado' | 'archivo'
}): Promise<Guardado> {
  const tipo = TIPOS.includes(datos.tipo as TipoDocumento) ? (datos.tipo as TipoDocumento) : null
  if (!tipo) return { ok: false, error: `«${datos.tipo}» no es un tipo de documento.` }

  const texto = datos.texto.trim()
  if (texto.length < MINIMO) {
    return { ok: false, error: `El documento tiene ${texto.length} caracteres. Con menos de ${MINIMO} no hay nada que guardar.` }
  }

  let fecha: string | null = null
  if (datos.fechaBruta && datos.fechaBruta.trim() !== '') {
    const leida = leerFecha(datos.fechaBruta)
    if (leida.estado === 'error') return { ok: false, error: `La fecha: ${leida.motivo}` }
    if (leida.estado === 'ok') fecha = leida.valor
  }

  const titulo = (datos.titulo ?? '').trim() || datos.archivoNombre || ETIQUETA_DOCUMENTO[tipo]

  try {
    const creado = await escribirDevolviendo<{ id: number }>(
      `insert into documentos (cliente_id, tipo, titulo, fecha, texto, caracteres, archivo_nombre, origen)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [datos.clienteId, tipo, titulo, fecha, texto, texto.length, datos.archivoNombre ?? null, datos.origen],
    )
    return { ok: true, id: creado.id }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** El texto completo de un documento. Se trae sólo cuando alguien lo pide. */
export async function textoDe(documentoId: number, clienteId: number): Promise<string | null> {
  const r = await filas<{ texto: string | null }>(
    'select texto from documentos where id = $1 and cliente_id = $2',
    [documentoId, clienteId],
  )
  return r[0]?.texto ?? null
}
