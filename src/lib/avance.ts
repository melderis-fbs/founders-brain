import { ETAPAS, SEMANAS_DEL_PROGRAMA, etapasDeLaSemana, type Etapa } from './modulos'

/**
 * DÓNDE ESTÁ, Y DÓNDE TENDRÍA QUE ESTAR
 *
 * La pregunta de toda la aplicación, contestada con las catorce etapas del
 * programa y nada más. Dos números al lado: las que ya tendría que tener
 * terminadas según el calendario, y las que la consultora marcó como hechas.
 * La diferencia entre los dos ES el estado. No hay puntaje ni índice: hay
 * etapas, que se pueden nombrar de a una.
 *
 * Es la misma cuenta que hace la planilla con % AvanceEsperado y % AvanceReal,
 * con una diferencia: la planilla deja de calcular cuando el cliente se pasó de
 * la fecha de fin, y justo ahí es cuando más falta hace saber qué pasó.
 *
 * Tres cosas que esto NO hace, y son las reglas del método:
 *
 * 1. Sin fecha de inicio no compara. No hay contra qué: devuelve «sin fecha» y
 *    lo dice. Una regla sin datos no dispara.
 * 2. Con CERO etapas marcadas tampoco compara, por más atrasado que parezca.
 *    Que nadie haya marcado nada no es lo mismo que que el cliente no haya
 *    hecho nada, y tratarlo como cero es la mentira más fácil de construir.
 *    Devuelve «sin marcar» y pide que alguien las marque.
 * 3. No cuesta un peso: es restar fechas y contar. Corre siempre.
 */

export type EstadoDeAvance = 'sin_fecha' | 'sin_marcar' | 'al_dia' | 'atrasado' | 'grave' | 'camino_propio'

/** A partir de cuántas etapas de atraso deja de ser un retraso y es un problema. */
const ETAPAS_PARA_GRAVE = 3

export type Avance = {
  semana: number | null
  /** Las catorce. */
  total: number
  /** Las que la consultora marcó como hechas. */
  hechas: number
  /** Las que ya tendrían que estar terminadas, por calendario. */
  esperadas: number
  porReal: number
  porEsperado: number
  /** Cuántas etapas le faltan de las que ya tendrían que estar. Nunca negativo. */
  atraso: number
  estado: EstadoDeAvance
  /** Cómo se dice el estado. */
  palabra: string
  /** Una línea que explica el estado sin que haya que interpretar los números. */
  titular: string
}

function porciento(cuantas: number): number {
  return Math.round((cuantas / ETAPAS.length) * 100)
}

/**
 * Cuántas etapas ya tendrían que estar terminadas en esa semana.
 *
 * Terminadas, no empezadas: la etapa que va de la semana 5 a la 6 no se cuenta
 * hasta que la semana 6 quedó atrás. Contarla antes sería marcar en rojo a
 * alguien que está justo donde tiene que estar.
 */
export function etapasEsperadas(semana: number | null): number {
  if (semana === null) return 0
  return ETAPAS.filter((e) => semana > e.hastaSemana).length
}

/**
 * ¿Esta etapa está hecha?
 *
 * De dos maneras, y las dos valen: alguien la marcó, o están marcados todos sus
 * hitos clave. Antes eran dos listas separadas y marcar «Primera venta» no movía
 * el avance, que es exactamente lo que se veía: el hito tildado y el porcentaje
 * quieto.
 */
export function etapaHecha(etapa: Etapa, marcadas: ReadonlySet<string>): boolean {
  if (marcadas.has(etapa.clave)) return true
  if (etapa.hitosClave.length === 0) return false
  return etapa.hitosClave.every((h) => marcadas.has(h.clave))
}

/**
 * Cuando el cliente no sigue el Road Map.
 *
 * Los M2 y las excepciones no tienen estructura definida: se trabaja sobre el
 * caso puntual. Compararlos contra las catorce etapas los saca «graves» por no
 * haber hecho algo que nunca les tocó hacer, y eso no es medir: es ensuciar el
 * tablero para todos los demás.
 */
export function avanceDe(
  semana: number | null,
  marcadas: ReadonlySet<string>,
  sigueElPrograma = true,
): Avance {
  const total = ETAPAS.length
  const hechas = ETAPAS.filter((e) => etapaHecha(e, marcadas)).length
  const esperadas = etapasEsperadas(semana)
  const porReal = porciento(hechas)
  const porEsperado = porciento(esperadas)
  const atraso = Math.max(0, esperadas - hechas)

  if (!sigueElPrograma) {
    return {
      semana, total, hechas, esperadas, porReal, porEsperado, atraso: 0,
      estado: 'camino_propio',
      palabra: 'camino propio',
      titular: hechas > 0
        ? `No sigue el Road Map: se trabaja sobre su caso. Tiene ${hechas} de las ${total} etapas marcadas, pero no se lo compara contra ellas.`
        : 'No sigue el Road Map: se trabaja sobre su caso, así que no se lo compara contra las catorce etapas. El plan está en su ficha.',
    }
  }

  if (semana === null) {
    return {
      semana, total, hechas, esperadas, porReal, porEsperado, atraso,
      estado: 'sin_fecha',
      palabra: 'sin fecha de inicio',
      titular: hechas > 0
        ? `Tiene ${hechas} de ${total} etapas marcadas, pero sin fecha de inicio no hay contra qué compararlas.`
        : 'Sin fecha de inicio no se sabe en qué semana va ni qué tendría que tener hecho.',
    }
  }

  if (hechas === 0 && esperadas > 0) {
    return {
      semana, total, hechas, esperadas, porReal, porEsperado, atraso,
      estado: 'sin_marcar',
      palabra: 'sin marcar',
      titular: `Va en la semana ${semana} y tendría que tener ${esperadas} de ${total} etapas, pero no hay ninguna marcada. Eso no quiere decir que no las haya hecho: quiere decir que nadie las marcó.`,
    }
  }

  if (atraso === 0) {
    return {
      semana, total, hechas, esperadas, porReal, porEsperado, atraso,
      estado: 'al_dia',
      palabra: hechas > esperadas ? 'adelantado' : 'a término',
      titular: hechas > esperadas
        ? `Tiene ${hechas} de ${total} etapas y a esta altura le pedían ${esperadas}: va adelantado.`
        : `Tiene las ${esperadas} etapas que le corresponden a la semana ${semana}.`,
    }
  }

  const palabra = atraso >= ETAPAS_PARA_GRAVE ? 'grave' : 'atrasado'
  return {
    semana, total, hechas, esperadas, porReal, porEsperado, atraso,
    estado: atraso >= ETAPAS_PARA_GRAVE ? 'grave' : 'atrasado',
    palabra,
    titular: `Tiene ${hechas} de las ${esperadas} etapas que ya tendrían que estar: le faltan ${atraso}.`,
  }
}

/**
 * Cuántas semanas de programa representa el atraso.
 *
 * Sirve para decirlo en la unidad en la que habla el equipo —«va cuatro semanas
 * atrasado»— en vez de en porcentaje. Las catorce etapas ocupan dieciséis
 * semanas, así que cada etapa pesa algo más de una semana.
 */
export function atrasoEnSemanas(avance: Avance): number | null {
  if (avance.estado === 'sin_fecha' || avance.estado === 'sin_marcar') return null
  if (avance.atraso === 0) return 0
  return Math.round((avance.atraso * SEMANAS_DEL_PROGRAMA) / ETAPAS.length)
}

/**
 * Cada etapa con las dos cosas que hay que ver juntas: si está marcada y si ya
 * le tocaba. Una sola de las dos no dice nada. Marcada y todavía no le tocaba
 * es alguien que va adelantado; sin marcar y ya pasó es el renglón que hay que
 * mirar, y es el único que sale en rojo.
 */
export type FilaDeEtapa = {
  etapa: Etapa
  hecha: boolean
  /** Marcada a mano, distinto de dada por hecha porque están todos sus hitos. */
  marcadaAMano: boolean
  /** Cuántos de sus hitos clave están marcados. */
  hitosHechos: number
  estado: 'hecha' | 'debia_estar' | 'es_la_de_ahora' | 'todavia_no'
  /** La etapa que la consultora eligió a mano como «acá está». */
  elegida: boolean
  porque: string
}

export function filasDeEtapas(
  semana: number | null,
  marcadas: ReadonlySet<string>,
  elegida: string | null = null,
): FilaDeEtapa[] {
  const ahora = etapasDeLaSemana(semana)

  return ETAPAS.map((etapa) => {
    const hecha = etapaHecha(etapa, marcadas)
    const esLaDeAhora = ahora.some((e) => e.clave === etapa.clave)
    const yaPaso = semana !== null && semana > etapa.hastaSemana
    const cuando = etapa.desdeSemana === etapa.hastaSemana
      ? `semana ${etapa.desdeSemana}`
      : `semanas ${etapa.desdeSemana} a ${etapa.hastaSemana}`

    const base = {
      etapa, hecha,
      marcadaAMano: marcadas.has(etapa.clave),
      hitosHechos: etapa.hitosClave.filter((h) => marcadas.has(h.clave)).length,
      elegida: elegida === etapa.nombre,
    }

    if (hecha) return { ...base, estado: 'hecha' as const, porque: `Marcada como hecha. Le tocaba en la ${cuando}.` }
    if (yaPaso) return { ...base, estado: 'debia_estar' as const, porque: `Le tocaba en la ${cuando} y no está marcada.` }
    if (esLaDeAhora) return { ...base, estado: 'es_la_de_ahora' as const, porque: `Es la de esta semana.` }
    if (semana === null) return { ...base, estado: 'todavia_no' as const, porque: `Sin fecha de inicio no se sabe si ya le tocaba. Va en la ${cuando}.` }
    return { ...base, estado: 'todavia_no' as const, porque: `Le toca en la ${cuando}.` }
  })
}
