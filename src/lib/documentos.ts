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

export const TIPOS: readonly TipoDocumento[] = ['onboarding', 'match_de_marca', 'llamada_venta', 'contrato', 'sesion', 'encuesta', 'notas', 'otro']

const MINIMO = 20

export type Guardado =
  | { ok: true; id: number; yaEstaba?: true }
  | { ok: false; error: string }

/**
 * ¿Este mismo archivo ya está cargado en este cliente?
 *
 * Regla 7: volver a importar corrige, no duplica. Subir la carpeta entera dos
 * veces —que es lo que va a pasar— no puede dejar treinta documentos donde hay
 * quince. Se compara el nombre del archivo y el largo del texto: dos archivos
 * distintos con el mismo nombre y exactamente la misma cantidad de caracteres
 * no existen en la práctica, y si el documento cambió, el largo cambió.
 */
async function mismoArchivoYaCargado(
  clienteId: number,
  archivoNombre: string,
  caracteres: number,
): Promise<number | null> {
  const r = await filas<{ id: number }>(
    `select id from documentos
      where cliente_id = $1 and archivo_nombre = $2 and caracteres = $3
      order by id limit 1`,
    [clienteId, archivoNombre, caracteres],
  )
  return r[0]?.id ?? null
}

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
    if (datos.archivoNombre) {
      const repetido = await mismoArchivoYaCargado(datos.clienteId, datos.archivoNombre, texto.length)
      if (repetido !== null) return { ok: true, id: repetido, yaEstaba: true }
    }

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

/**
 * Corregir qué es un documento, cuándo es y cómo se llama.
 *
 * El tipo es el que más importa: de él dependen las reglas con las que se lee,
 * y un contrato marcado como «Otro» se lee sin reglas. Hasta acá el tipo se
 * elegía al subir y no se podía cambiar nunca más.
 *
 * No toca el texto: el texto es lo que trajo el archivo. Sí borra el resumen si
 * cambió el tipo, porque ese resumen se hizo leyéndolo como otra cosa.
 */
export async function editarDocumento(id: number, clienteId: number, datos: {
  tipo?: string
  fechaBruta?: string | null
  titulo?: string | null
}): Promise<Guardado> {
  const actual = await filas<{ id: number; tipo: string }>(
    'select id, tipo from documentos where id = $1 and cliente_id = $2', [id, clienteId],
  )
  if (actual.length === 0) return { ok: false, error: 'Ese documento no es de este cliente.' }

  const cambios: string[] = []
  const parametros: unknown[] = [id, clienteId]

  if (datos.tipo !== undefined) {
    if (!TIPOS.includes(datos.tipo as TipoDocumento)) {
      return { ok: false, error: `«${datos.tipo}» no es un tipo de documento.` }
    }
    parametros.push(datos.tipo)
    cambios.push(`tipo = $${parametros.length}`)
    if (datos.tipo !== actual[0]!.tipo) {
      cambios.push('resumen = null, resumen_en = null, resumen_modelo = null')
    }
  }

  if (datos.fechaBruta !== undefined) {
    let fecha: string | null = null
    if (datos.fechaBruta && datos.fechaBruta.trim() !== '') {
      const leida = leerFecha(datos.fechaBruta)
      if (leida.estado === 'error') return { ok: false, error: `La fecha: ${leida.motivo}` }
      if (leida.estado === 'ok') fecha = leida.valor
    }
    parametros.push(fecha)
    cambios.push(`fecha = $${parametros.length}`)
  }

  if (datos.titulo !== undefined) {
    const titulo = (datos.titulo ?? '').trim()
    if (titulo === '') return { ok: false, error: 'El título no puede quedar vacío.' }
    parametros.push(titulo)
    cambios.push(`titulo = $${parametros.length}`)
  }

  if (cambios.length === 0) return { ok: true, id }

  try {
    await escribir(
      `update documentos set ${cambios.join(', ')} where id = $1 and cliente_id = $2`,
      parametros, { esperadas: 1 },
    )
    return { ok: true, id }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Borrar un documento.
 *
 * Hace falta porque subir un documento al cliente equivocado pasa, y hasta acá
 * no había forma de deshacerlo: quedaba ahí para siempre, y peor, el diagnóstico
 * lo leía como si fuera de ese cliente.
 *
 * Las propuestas que salieron de él y los orígenes de campo quedan: dicen de
 * dónde salió un dato que alguien ya confirmó, y eso no se borra porque el
 * documento se haya ido. La referencia queda en null, no rota.
 */
export async function borrarDocumento(id: number, clienteId: number): Promise<Guardado> {
  const suyo = await filas<{ id: number }>(
    'select id from documentos where id = $1 and cliente_id = $2', [id, clienteId],
  )
  if (suyo.length === 0) return { ok: false, error: 'Ese documento no es de este cliente.' }

  await escribir('delete from documentos where id = $1 and cliente_id = $2', [id, clienteId], { esperadas: 1 })
  return { ok: true, id }
}
