import { CAMPOS, DOCUMENTOS_DE_PLANILLA, type Campo, type TipoDocumento } from '../campos'
import { plegado } from '../texto'

/**
 * De los encabezados de la planilla a los campos de la aplicación.
 *
 * Acá sí se pliega el texto (sin acentos, sin mayúsculas): un encabezado mal
 * tipeado no es un cliente equivocado, es una columna que hay que reconocer.
 */

export type Mapeo = {
  /** clave de campo -> nombre exacto de la columna en el archivo */
  campos: Map<string, string>
  /** tipo de documento -> nombre exacto de la columna */
  documentos: Map<TipoDocumento, string>
  /** columna con el id estable del cliente, si la planilla lo trae */
  columnaRef: string | null
  /** columnas que la aplicación no reconoce y va a ignorar */
  ignoradas: string[]
  /** columnas repetidas: se usa la primera y se informan las otras */
  repetidas: string[]
}

const SINONIMOS_REF = ['id', 'id cliente', 'identificador', 'ref', 'referencia', 'codigo', 'id founders']

const INDICE_CAMPOS: ReadonlyMap<string, Campo> = (() => {
  const m = new Map<string, Campo>()
  for (const campo of CAMPOS) {
    m.set(plegado(campo.clave), campo)
    for (const s of campo.sinonimos) m.set(plegado(s), campo)
  }
  return m
})()

const INDICE_DOCUMENTOS: ReadonlyMap<string, TipoDocumento> = (() => {
  const m = new Map<string, TipoDocumento>()
  for (const doc of DOCUMENTOS_DE_PLANILLA) {
    m.set(plegado(doc.tipo), doc.tipo)
    m.set(plegado(`texto_${doc.tipo}`), doc.tipo)
    m.set(plegado(doc.etiqueta), doc.tipo)
    for (const s of doc.sinonimos) m.set(plegado(s), doc.tipo)
  }
  return m
})()

export function mapearEncabezados(encabezados: readonly string[]): Mapeo {
  const campos = new Map<string, string>()
  const documentos = new Map<TipoDocumento, string>()
  const ignoradas: string[] = []
  const repetidas: string[] = []
  let columnaRef: string | null = null

  for (const bruto of encabezados) {
    const encabezado = bruto.trim()
    if (encabezado === '') continue
    const p = plegado(encabezado)

    if (SINONIMOS_REF.includes(p)) {
      if (columnaRef === null) columnaRef = encabezado
      else repetidas.push(encabezado)
      continue
    }

    const campo = INDICE_CAMPOS.get(p)
    if (campo) {
      if (campos.has(campo.clave)) repetidas.push(encabezado)
      else campos.set(campo.clave, encabezado)
      continue
    }

    const tipoDoc = INDICE_DOCUMENTOS.get(p)
    if (tipoDoc) {
      if (documentos.has(tipoDoc)) repetidas.push(encabezado)
      else documentos.set(tipoDoc, encabezado)
      continue
    }

    ignoradas.push(encabezado)
  }

  return { campos, documentos, columnaRef, ignoradas, repetidas }
}

/** Los encabezados que la aplicación entiende, para bajar la plantilla. */
export function encabezadosDePlantilla(): string[] {
  return [
    'id_cliente',
    ...CAMPOS.map((c) => c.clave),
    ...DOCUMENTOS_DE_PLANILLA.map((d) => `texto_${d.tipo}`),
  ]
}
