import { ETIQUETA_DOCUMENTO, type TipoDocumento } from './campos'
import { escribir, escribirDevolviendo, filas } from './db'
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

/**
 * Guardar el resumen de un documento.
 *
 * Se escribe una vez, con su fecha y con qué modelo lo hizo. Volver a leer el
 * documento lo reemplaza; mientras tanto, todo lo que necesite saber qué dice
 * ese documento lee esto y no gasta nada.
 */
export async function guardarResumen(datos: {
  documentoId: number
  clienteId: number
  resumen: string
  modelo: string
}): Promise<void> {
  await escribir(
    `update documentos set resumen = $3, resumen_en = now(), resumen_modelo = $4
      where id = $1 and cliente_id = $2`,
    [datos.documentoId, datos.clienteId, datos.resumen, datos.modelo],
  )
}

export type DocumentoResumido = {
  id: number
  tipo: string
  titulo: string
  fecha: string | null
  caracteres: number
  resumen: string | null
  resumen_en: string | null
}

/**
 * Los documentos del cliente con su resumen, sin el texto entero.
 *
 * Esto es lo que arma el expediente para el diagnóstico: TODOS los documentos
 * entran, porque un resumen de cinco renglones siempre entra. Antes entraban
 * los más nuevos hasta llenar el tope y el resto se informaba como omitido, o
 * sea que el diagnóstico no los había visto.
 */
export async function documentosResumidos(clienteId: number): Promise<DocumentoResumido[]> {
  return filas<DocumentoResumido>(
    `select id, tipo, titulo, fecha, caracteres, resumen, resumen_en::text as resumen_en
       from documentos where cliente_id = $1
      order by coalesce(fecha, creado_en::date) desc, id desc`,
    [clienteId],
  )
}
