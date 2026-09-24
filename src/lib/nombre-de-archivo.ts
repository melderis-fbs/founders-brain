import type { TipoDocumento } from './campos'
import { plegado } from './texto'

/**
 * QUÉ ES ESTE ARCHIVO, LEÍDO DE SU NOMBRE
 *
 * Cargar quince archivos de un cliente y elegir a mano el tipo, la fecha y el
 * título de cada uno son cuarenta y cinco decisiones. Nadie las toma: se deja
 * todo en «Otro», y un documento marcado «Otro» se lee mal, porque cada tipo se
 * lee distinto y busca datos distintos.
 *
 * Así que esto propone. No decide: lo propuesto aparece en la pantalla, fila
 * por fila, y la consultora corrige lo que esté mal antes de subir nada. Es la
 * regla 4 sin gastar un peso, porque acá no hay modelo: son reglas sobre el
 * nombre del archivo.
 *
 * Cuando no está seguro no inventa. La fecha vuelve vacía y el tipo vuelve
 * «Otro», que es lo honesto: un campo vacío se ve y se completa, uno inventado
 * pasa desapercibido.
 */

/**
 * Las palabras que delatan cada tipo, en el orden en que hay que buscarlas.
 *
 * El orden importa: «llamada de venta» tiene adentro «llamada», que también es
 * una sesión. Gana la más específica, que es la que está primero.
 */
const SEÑALES: ReadonlyArray<readonly [TipoDocumento, readonly string[]]> = [
  ['match_de_marca', ['match de marca', 'matchdemarca', 'match marca', 'manual de transformacion', 'identidad de marca']],
  ['llamada_venta', ['llamada de venta', 'call de venta', 'venta', 'closer', 'discovery', 'cierre de venta']],
  ['onboarding', ['onboarding', 'on boarding', 'formulario', 'cuestionario', 'alta de cliente', 'kickoff', 'kick off']],
  ['contrato', ['contrato', 'acuerdo', 'convenio', 'propuesta firmada', 'garantia', 'factura', 'presupuesto']],
  ['sesion', ['sesion', 'session', 'semana', 'reunion', 'meeting', 'mentoria', 'transcripcion', 'transcript', 'llamada', 'zoom', 'meet', 'grabacion', 'encuentro']],
  ['notas', ['notas', 'nota', 'apuntes', 'minuta', 'resumen']],
]

/** Los subtítulos salen de una grabación: si nada más lo dice, es una sesión. */
const DE_GRABACION = ['.vtt', '.srt']

function extension(nombre: string): string {
  const i = nombre.lastIndexOf('.')
  return i < 0 ? '' : nombre.slice(i).toLowerCase()
}

/** El nombre sin la extensión. */
export function sinExtension(nombre: string): string {
  const i = nombre.lastIndexOf('.')
  return i <= 0 ? nombre : nombre.slice(0, i)
}

/**
 * Qué tipo de documento parece, mirando el nombre.
 *
 * Devuelve 'otro' cuando ninguna señal aparece. 'otro' no es un fracaso: es
 * «decidilo vos», y en la pantalla se ve como cualquier otra fila para corregir.
 */
export function adivinarTipo(nombre: string): TipoDocumento {
  const texto = ` ${plegado(sinExtension(nombre))} `

  for (const [tipo, palabras] of SEÑALES) {
    // `includes` suelto y no palabra entera a propósito: «Sesion04» y
    // «onboarding-juan» son nombres de archivo reales y ahí no hay separador.
    if (palabras.some((palabra) => texto.includes(palabra))) return tipo
  }

  if (DE_GRABACION.includes(extension(nombre))) return 'sesion'
  return 'otro'
}

/** Un año creíble para un cliente de Founders. Ni 1200 ni 3040. */
function añoCreible(año: number): boolean {
  return año >= 2020 && año <= 2100
}

function armar(año: number, mes: number, dia: number): string | null {
  if (!añoCreible(año) || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const fecha = new Date(Date.UTC(año, mes - 1, dia))
  // Rebota el 31 de febrero en vez de dejarlo pasar como 3 de marzo.
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null
  return `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * La fecha que trae el nombre del archivo, en ISO, o null.
 *
 * Los dos órdenes que aparecen de verdad: el ISO que ponen las herramientas
 * (2026-03-14) y el que escribe una persona acá (14-03-2026). Cuando los dos
 * números podrían ser el día, manda el orden argentino: día primero.
 *
 * Si no hay nada reconocible devuelve null y el campo queda vacío. Vacío no es
 * cero (regla 1) y una fecha inventada es peor que ninguna: nadie la revisa.
 */
export function adivinarFecha(nombre: string): string | null {
  const texto = sinExtension(nombre)

  // 2026-03-14 · 2026_03_14 · 2026.03.14 · 2026/03/14
  const iso = texto.match(/(?<!\d)(20\d{2})[-_./](\d{1,2})[-_./](\d{1,2})(?!\d)/)
  if (iso) {
    const armada = armar(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    if (armada) return armada
  }

  // 14-03-2026 · 14/03/2026 · 14.03.26
  const criollo = texto.match(/(?<!\d)(\d{1,2})[-_./](\d{1,2})[-_./](\d{2}|20\d{2})(?!\d)/)
  if (criollo) {
    const año = Number(criollo[3]!.length === 2 ? `20${criollo[3]}` : criollo[3])
    const armada = armar(año, Number(criollo[2]), Number(criollo[1]))
    if (armada) return armada
  }

  // 20260314, pegado, como lo deja una exportación.
  const pegada = texto.match(/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/)
  if (pegada) {
    const armada = armar(Number(pegada[1]), Number(pegada[2]), Number(pegada[3]))
    if (armada) return armada
  }

  return null
}

/**
 * El título que se propone: el nombre del archivo, legible.
 *
 * Se le saca la extensión y se cambian guiones y guiones bajos por espacios,
 * porque «Sesion_04_Juan-Perez» es el nombre del archivo, no un título. No se
 * toca nada más: lo que escribió una persona se respeta como está.
 */
export function adivinarTitulo(nombre: string): string {
  return sinExtension(nombre).replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || nombre
}
