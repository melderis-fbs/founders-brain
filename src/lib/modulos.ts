/**
 * Los módulos del programa, en orden.
 *
 * Esto es distinto de los hitos y de las etapas, y conviene no confundirlos:
 *
 *   - Los MÓDULOS son lo que se trabaja cada semana. Es el programa.
 *   - Los HITOS son lo que tendría que estar CERRADO, y cuándo. Es la
 *     comparación.
 *   - Las ETAPAS son las cinco preguntas del negocio. Es dónde está parado.
 *
 * Se parecen y se cruzan —«Tu Oferta en Una Página» es el módulo donde se
 * cierra el hito «Oferta y promesa cerradas»— pero no son lo mismo: uno es lo
 * que se da, el otro es lo que quedó hecho. Un cliente puede haber visto el
 * módulo y no tener el hito, y eso es exactamente lo que hay que ver.
 *
 * OJO CON LAS SEMANAS: la lista de módulos vino en orden, sin semanas. Están
 * puestos uno por semana, del 1 al 14, en un programa de 16. Si alguno ocupa
 * dos semanas o si hay semanas de trabajo sin módulo, se corrige acá y se
 * arregla solo en la grilla, en las sesiones y en la ficha.
 */

export type Modulo = {
  semana: number
  nombre: string
  /** Lo que aclara el nombre entre paréntesis, cuando lo tiene. */
  detalle?: string
}

export const MODULOS: readonly Modulo[] = [
  { semana: 1, nombre: 'Onboarding y Diagnóstico' },
  { semana: 2, nombre: 'Identidad', detalle: 'Manual de Transformación 2.0' },
  { semana: 3, nombre: 'Match de Marca' },
  { semana: 4, nombre: 'Promesa y Pilares' },
  { semana: 5, nombre: 'Tu Oferta en Una Página' },
  { semana: 6, nombre: 'Estrategia de Contenido', detalle: 'Synoma, sistema de 35 minutos, Reto 21 días' },
  { semana: 7, nombre: 'Diseño de tu Programa' },
  { semana: 8, nombre: 'Primera pauta', detalle: 'TOFU' },
  { semana: 9, nombre: 'Conversaciones por DM', detalle: 'MOFU' },
  { semana: 10, nombre: 'Ventas y Cierre' },
  { semana: 11, nombre: 'Validación', detalle: 'la clave es ejecutar' },
  { semana: 12, nombre: 'Finanzas del negocio' },
  { semana: 13, nombre: 'Optimización y Cuello de Botella' },
  { semana: 14, nombre: 'Cierre y Plan del Próximo Trimestre' },
]

const POR_SEMANA: ReadonlyMap<number, Modulo> = new Map(MODULOS.map((m) => [m.semana, m]))

/** Qué módulo le toca a esa semana. null si esa semana no tiene módulo. */
export function moduloDe(semana: number | null): Modulo | null {
  if (semana === null) return null
  return POR_SEMANA.get(semana) ?? null
}

/** El nombre completo, con su aclaración: «Identidad (Manual de Transformación 2.0)». */
export function nombreCompleto(m: Modulo): string {
  return m.detalle ? `${m.nombre} (${m.detalle})` : m.nombre
}

/**
 * En qué módulo va hoy, o qué pasó si ya se le terminaron.
 *
 * Después del último módulo el programa sigue —quedan semanas de trabajo— y
 * eso no es un error: se dice, no se deja en blanco.
 */
export function enQueModuloVa(semana: number | null): { modulo: Modulo | null; porque: string } {
  if (semana === null) return { modulo: null, porque: 'sin fecha de inicio no se sabe en qué semana va' }
  if (semana < 1) return { modulo: null, porque: 'todavía no arrancó' }

  const suyo = POR_SEMANA.get(semana)
  if (suyo) return { modulo: suyo, porque: '' }

  const ultimo = MODULOS[MODULOS.length - 1]!
  if (semana > ultimo.semana) {
    return { modulo: null, porque: `ya pasó el último módulo, que era el de la semana ${ultimo.semana}` }
  }
  return { modulo: null, porque: 'esa semana no tiene módulo' }
}
