import { plegado, vacio } from './texto'

/**
 * Lectura de valores que vienen de una planilla.
 *
 * Regla 1: celda vacía no es cero. Por eso todas estas funciones distinguen
 * tres resultados y nunca devuelven 0 por defecto:
 *   { estado: 'vacio' }            -> no hay dato, no se escribe nada
 *   { estado: 'ok', valor }        -> hay dato
 *   { estado: 'error', motivo }    -> hay algo escrito pero no se entiende
 */
export type Lectura<T> =
  | { estado: 'vacio' }
  | { estado: 'ok'; valor: T }
  | { estado: 'error'; motivo: string }

export function leerTexto(bruto: unknown): Lectura<string> {
  if (vacio(bruto)) return { estado: 'vacio' }
  return { estado: 'ok', valor: String(bruto).replace(/\s+/g, ' ').trim() }
}

export function leerTextoLargo(bruto: unknown): Lectura<string> {
  if (vacio(bruto)) return { estado: 'vacio' }
  return { estado: 'ok', valor: String(bruto).trim() }
}

/**
 * Números como los escribe la gente: "1.500,50", "1,500.50", "$ 1500", "1500 usd".
 * Devuelve error, no cero, cuando no se entiende.
 */
export function leerNumero(bruto: unknown): Lectura<number> {
  if (vacio(bruto)) return { estado: 'vacio' }
  if (typeof bruto === 'number') {
    return Number.isFinite(bruto) ? { estado: 'ok', valor: bruto } : { estado: 'error', motivo: 'no es un número' }
  }
  const texto = String(bruto).trim()
  let limpio = texto.replace(/[^0-9.,\-]/g, '')
  if (limpio === '' || limpio === '-') return { estado: 'error', motivo: `"${texto}" no es un número` }

  const comas = (limpio.match(/,/g) ?? []).length
  const puntos = (limpio.match(/\./g) ?? []).length
  const ultimaComa = limpio.lastIndexOf(',')
  const ultimoPunto = limpio.lastIndexOf('.')

  if (comas > 0 && puntos > 0) {
    // El separador decimal es el que aparece último: 1.500,50 vs 1,500.50
    if (ultimaComa > ultimoPunto) limpio = limpio.replace(/\./g, '').replace(',', '.')
    else limpio = limpio.replace(/,/g, '')
  } else if (comas > 1) {
    limpio = limpio.replace(/,/g, '')
  } else if (puntos > 1) {
    limpio = limpio.replace(/\./g, '')
  } else if (comas === 1) {
    // Una sola coma: decimal salvo que separe miles exactos (1,500)
    limpio = /,\d{3}$/.test(limpio) ? limpio.replace(',', '') : limpio.replace(',', '.')
  } else if (puntos === 1) {
    if (/\.\d{3}$/.test(limpio)) limpio = limpio.replace('.', '')
  }

  const valor = Number(limpio)
  if (!Number.isFinite(valor)) return { estado: 'error', motivo: `"${texto}" no es un número` }
  return { estado: 'ok', valor }
}

export function leerEntero(bruto: unknown): Lectura<number> {
  const n = leerNumero(bruto)
  if (n.estado !== 'ok') return n
  if (!Number.isInteger(n.valor)) return { estado: 'error', motivo: `"${String(bruto).trim()}" no es un número entero` }
  return n
}

/** Fechas en dd/mm/aaaa (el formato de la planilla), dd-mm-aaaa o aaaa-mm-dd. */
export function leerFecha(bruto: unknown): Lectura<string> {
  if (vacio(bruto)) return { estado: 'vacio' }
  const texto = String(bruto).trim()

  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/)
  if (iso) return armarFecha(Number(iso[1]), Number(iso[2]), Number(iso[3]), texto)

  const latino = texto.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (latino) {
    let anio = Number(latino[3])
    if (anio < 100) anio += anio < 70 ? 2000 : 1900
    return armarFecha(anio, Number(latino[2]), Number(latino[1]), texto)
  }

  return { estado: 'error', motivo: `"${texto}" no es una fecha (esperaba dd/mm/aaaa)` }
}

function armarFecha(anio: number, mes: number, dia: number, original: string): Lectura<string> {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return { estado: 'error', motivo: `"${original}" no es una fecha válida` }
  }
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    return { estado: 'error', motivo: `"${original}" no es una fecha válida` }
  }
  const dd = String(dia).padStart(2, '0')
  const mm = String(mes).padStart(2, '0')
  return { estado: 'ok', valor: `${anio}-${mm}-${dd}` }
}

const SI = new Set(['si', 's', 'true', 'verdadero', 'x', '1', 'ok', 'tiene', 'firmada', 'firmado'])
const NO = new Set(['no', 'n', 'false', 'falso', '0', 'ninguna', 'ninguno'])

export function leerBooleano(bruto: unknown): Lectura<boolean> {
  if (vacio(bruto)) return { estado: 'vacio' }
  if (typeof bruto === 'boolean') return { estado: 'ok', valor: bruto }
  const p = plegado(String(bruto))
  if (SI.has(p)) return { estado: 'ok', valor: true }
  if (NO.has(p)) return { estado: 'ok', valor: false }
  return { estado: 'error', motivo: `"${String(bruto).trim()}" no es sí ni no` }
}

/** Opciones cerradas: se acepta cualquier forma de escribirlas, se guarda una sola. */
export function leerOpcion(bruto: unknown, opciones: readonly string[], alias: Record<string, string> = {}): Lectura<string> {
  if (vacio(bruto)) return { estado: 'vacio' }
  const p = plegado(String(bruto))
  const directa = opciones.find((o) => plegado(o) === p)
  if (directa) return { estado: 'ok', valor: directa }
  const porAlias = alias[p]
  if (porAlias) return { estado: 'ok', valor: porAlias }
  return { estado: 'error', motivo: `"${String(bruto).trim()}" no es ninguna de: ${opciones.join(', ')}` }
}
