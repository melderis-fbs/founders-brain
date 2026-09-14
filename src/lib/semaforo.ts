import { dondeSeCorta, faseDelHito, type HitoEvaluado } from './hitos'

/**
 * El semáforo.
 *
 * Cuatro colores, no tres, y la diferencia importa: **gris no es verde**. Un
 * cliente del que no se sabe nada no puede salir en verde, porque ahí es donde
 * un tablero empieza a mentir — y verde es justamente el color que hace que
 * nadie lo mire.
 *
 * Cada color viene con su palabra al lado y con una frase que lo explica. No
 * hay puntaje: el color sale de los hitos vencidos, que se pueden nombrar.
 */

export type Color = 'verde' | 'amarillo' | 'rojo' | 'gris'

export type Semaforo = {
  color: Color
  palabra: string
  porque: string
  /** En qué fase del programa se corta, si se corta. */
  fase: number | null
}

/** A partir de cuántas semanas de atraso un retraso pasa a ser grave. */
const SEMANAS_PARA_GRAVE = 4

export function semaforoDe(evaluados: readonly HitoEvaluado[]): Semaforo {
  const seSabeAlgo = evaluados.some((e) => e.estado === 'hecho' || e.estado === 'falta')
  if (!seSabeAlgo) {
    return {
      color: 'gris',
      palabra: 'sin datos',
      porque: 'No hay con qué compararlo: falta la fecha de inicio, o las fuentes de estos datos no están cargadas.',
      fase: null,
    }
  }

  const vencidos = evaluados.filter((e) => e.estado === 'falta')
  if (vencidos.length === 0) {
    return {
      color: 'verde',
      palabra: 'en tiempo',
      porque: 'No hay nada vencido de lo que hoy se puede medir.',
      fase: null,
    }
  }

  const corte = dondeSeCorta(evaluados)!
  const bloqueante = vencidos.find((e) => e.hito.bloquea)
  const atrasoMayor = Math.max(...vencidos.map((e) => e.atrasoEnSemanas ?? 0))

  if (bloqueante) {
    return {
      color: 'rojo',
      palabra: 'grave',
      porque: `«${bloqueante.hito.etiqueta}» bloquea todo lo que viene después y falta hace ${semanas(bloqueante.atrasoEnSemanas)}.`,
      fase: faseDelHito(corte.hito),
    }
  }

  if (atrasoMayor >= SEMANAS_PARA_GRAVE) {
    return {
      color: 'rojo',
      palabra: 'grave',
      porque: `«${corte.hito.etiqueta}» falta hace ${semanas(corte.atrasoEnSemanas)}.`,
      fase: faseDelHito(corte.hito),
    }
  }

  return {
    color: 'amarillo',
    palabra: 'atrasado',
    porque: `«${corte.hito.etiqueta}» falta hace ${semanas(corte.atrasoEnSemanas)}.`,
    fase: faseDelHito(corte.hito),
  }
}

function semanas(n: number | null): string {
  const cuantas = n ?? 0
  return `${cuantas} ${cuantas === 1 ? 'semana' : 'semanas'}`
}
