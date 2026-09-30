import { ETAPAS, SEMANAS_DEL_PROGRAMA, etapasDeLaSemana, type Etapa } from './modulos'
import { atrasoEnSemanas, lasQueSiguenValiendo, laQueQuedoAtras, senalesDeGrave, type LoQuePasa, type Senal } from './riesgo'

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

export type EstadoDeAvance =
  | 'sin_fecha' | 'sin_marcar' | 'camino_propio' | 'termino'
  | 'al_dia' | 'atencion' | 'atrasado' | 'grave'

/**
 * Los escalones del atraso, en etapas.
 *
 * Antes había uno solo: tres etapas de atraso y el cliente salía GRAVE. Con
 * catorce etapas en dieciséis semanas, tres etapas son tres semanas, y tres
 * semanas de atraso no son una emergencia: son una llamada. El resultado era
 * media cartera en rojo, y un tablero donde todo es grave no deja decidir a
 * quién llamar primero.
 *
 * Ahora hay tres escalones, y para llegar al último no alcanza con el número
 * absoluto: tiene que faltarle además la MITAD de lo que le pedían. Dos etapas
 * de atraso en la semana 3 y dos en la semana 15 no son lo mismo.
 */
const ETAPAS_PARA_ATENCION = 1
const ETAPAS_PARA_ATRASADO = 3
const ETAPAS_PARA_GRAVE = 5

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
  /** Hace cuántas semanas vencía lo primero que falta. */
  atrasoEnSemanas: number | null
  /** Cuando es grave: las señales que se prendieron, nombradas. */
  senales: Senal[]
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
  /** Cuántas semanas dura su programa: sin esto no se sabe si ya terminó. */
  semanasQueDura: number | null = null,
  /** El resto de lo que puede hacer grave a un cliente, además del atraso. */
  loDemas: Omit<LoQuePasa, 'semana' | 'marcadas'> = { hitos: [], bandera: null },
): Avance {
  const total = ETAPAS.length
  const hechas = ETAPAS.filter((e) => etapaHecha(e, marcadas)).length

  // El atraso se mide en SEMANAS —hace cuánto vencía lo primero que falta— y no
  // en etapas sin marcar. Tres etapas que vencían todas la semana pasada son
  // una semana de atraso; una sola que vencía en la semana 4 son ocho.
  const enSemanas = atrasoEnSemanas(semana, marcadas)
  const todasLasSenales = sigueElPrograma
    ? senalesDeGrave({ semana, marcadas, ...loDemas })
    : []

  // Al que ya terminó sólo le valen las señales humanas: una queja o una red
  // flag siguen siendo graves —ahí es cuando pide la plata de vuelta— pero el
  // atraso de un programa que acabó no es una urgencia de esta semana.
  const yaTermino = semanasQueDura !== null && semana !== null && semana > semanasQueDura
  const senales = yaTermino ? lasQueSiguenValiendo(todasLasSenales) : todasLasSenales
  const esperadas = etapasEsperadas(semana)
  const porReal = porciento(hechas)
  const porEsperado = porciento(esperadas)
  const atraso = Math.max(0, esperadas - hechas)

  if (!sigueElPrograma) {
    return {
      semana, total, hechas, esperadas, porReal, porEsperado, atraso: 0,
      atrasoEnSemanas: enSemanas, senales,
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
      atrasoEnSemanas: enSemanas, senales,
      estado: 'sin_fecha',
      palabra: 'sin fecha de inicio',
      titular: hechas > 0
        ? `Tiene ${hechas} de ${total} etapas marcadas, pero sin fecha de inicio no hay contra qué compararlas.`
        : 'Sin fecha de inicio no se sabe en qué semana va ni qué tendría que tener hecho.',
    }
  }

  // Grave lo deciden las cinco señales, no el número de etapas: una red flag,
  // una queja, no haber vendido pasada su semana, o tres semanas de atraso.
  if (senales.length > 0) {
    const quedo = laQueQuedoAtras(semana, marcadas)
    return {
      semana, total, hechas, esperadas, porReal, porEsperado, atraso,
      atrasoEnSemanas: enSemanas, senales,
      estado: 'grave',
      palabra: 'grave',
      titular: senales.map((s) => s.dice).join(' '),
    }
  }

  if (hechas === 0 && esperadas > 0) {
    return {
      semana, total, hechas, esperadas, porReal, porEsperado, atraso,
      atrasoEnSemanas: enSemanas, senales,
      estado: 'sin_marcar',
      palabra: 'sin marcar',
      titular: `Va en la semana ${semana} y tendría que tener ${esperadas} de ${total} etapas, pero no hay ninguna marcada. Eso no quiere decir que no las haya hecho: quiere decir que nadie las marcó.`,
    }
  }

  // Un cliente que ya terminó el programa no está «grave»: terminó. Lo que le
  // faltó es la conversación de la renovación, no la urgencia de esta semana, y
  // ponerlo en rojo al lado de alguien que va en la semana 6 y se recupera es lo
  // que hace que la lista deje de servir para decidir a quién llamar.
  if (semanasQueDura !== null && semana > semanasQueDura) {
    return {
      semana, total, hechas, esperadas, porReal, porEsperado, atraso,
      atrasoEnSemanas: enSemanas, senales,
      estado: 'termino',
      palabra: atraso === 0 ? 'terminó completo' : 'terminó sin cerrar',
      titular: atraso === 0
        ? `Terminó el programa con las ${total} etapas hechas.`
        : `Terminó el programa con ${hechas} de ${total} etapas: le quedaron ${atraso} sin cerrar. No es una urgencia de esta semana, es la conversación de la renovación.`,
    }
  }


  if (atraso === 0) {
    return {
      semana, total, hechas, esperadas, porReal, porEsperado, atraso,
      atrasoEnSemanas: enSemanas, senales,
      estado: 'al_dia',
      palabra: hechas > esperadas ? 'adelantado' : 'a término',
      titular: hechas > esperadas
        ? `Tiene ${hechas} de ${total} etapas y a esta altura le pedían ${esperadas}: va adelantado.`
        : `Tiene las ${esperadas} etapas que le corresponden a la semana ${semana}.`,
    }
  }

  // Lo que no llega a grave: una o dos semanas de atraso es para mirar, de ahí
  // para arriba está atrasado. Grave ya se decidió arriba, con las señales.
  const estado: EstadoDeAvance = (enSemanas ?? 0) >= 2 ? 'atrasado' : 'atencion'
  const quedo = laQueQuedoAtras(semana, marcadas)

  return {
    semana, total, hechas, esperadas, porReal, porEsperado, atraso,
    atrasoEnSemanas: enSemanas, senales,
    estado,
    palabra: estado === 'atrasado' ? 'atrasado' : 'para mirar',
    titular: enSemanas && enSemanas > 0
      ? `Va ${enSemanas} ${enSemanas === 1 ? 'semana' : 'semanas'} atrasado${quedo ? `: «${quedo.nombre}» vencía en la semana ${quedo.hastaSemana}` : ''}.` +
        (estado === 'atencion' ? ' Todavía se recupera.' : '')
      : `Tiene ${hechas} de las ${esperadas} etapas que ya tendrían que estar: le ${atraso === 1 ? 'falta 1' : `faltan ${atraso}`}.`,
  }
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
