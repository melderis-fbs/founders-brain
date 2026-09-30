import { dondeSeCorta, faseDelHito, type HitoEvaluado } from './hitos'

/**
 * EL SEMÁFORO
 *
 * Cinco colores, y las diferencias importan.
 *
 * **Gris no es verde.** Un cliente del que no se sabe nada no puede salir en
 * verde, porque ahí es donde un tablero empieza a mentir, y verde es justamente
 * el color que hace que nadie lo mire.
 *
 * **Y rojo no es cualquier atraso.** La versión anterior ponía en rojo a
 * cualquiera con un hito bloqueante vencido, sin importar de cuánto era el
 * atraso. Como casi ninguna ficha tiene la oferta cargada, eso marcaba GRAVE a
 * media cartera. Un tablero donde todo es grave no dice nada: no se puede
 * decidir a quién llamar primero si los ciento noventa están en rojo, y la
 * palabra deja de significar algo justo cuando hace falta que signifique.
 *
 * Ahora el color sale de CUÁNTO hace que falta, y el hito bloqueante sube un
 * escalón en vez de saltar directo al último.
 *
 * Nunca hay puntaje: el color sale de hitos vencidos, que se pueden nombrar.
 */

/**
 * Azul no es un escalón del atraso: es «esto ya no es de esta semana».
 * Un cliente que terminó el programa no compite por la atención de hoy con uno
 * que va en la semana 6, y meterlos en el mismo amarillo los confunde.
 */
export type Color = 'verde' | 'amarillo' | 'naranja' | 'rojo' | 'gris' | 'azul'

export type Semaforo = {
  color: Color
  palabra: string
  porque: string
  /** En qué fase del programa se corta, si se corta. */
  fase: number | null
}

/**
 * Los escalones, en semanas de atraso.
 *
 * Una o dos semanas es algo para mirar, no una emergencia: en un programa de
 * dieciséis, dos semanas es lo que se recupera con una llamada.
 */
const PARA_ATRASADO = 3
const PARA_GRAVE = 6

export function semaforoDe(
  evaluados: readonly HitoEvaluado[],
  /** Si ya pasó la última semana del programa. */
  seLePaso = false,
): Semaforo {
  const seSabeAlgo = evaluados.some((e) => e.estado === 'hecho' || e.estado === 'falta')
  if (!seSabeAlgo) {
    return {
      color: 'gris',
      palabra: 'sin datos',
      porque: 'No hay con qué compararlo: falta la fecha de inicio, o las fuentes de estos datos no están cargadas.',
      fase: null,
    }
  }

  // Ni un dato de su negocio cargado no es un cliente que fracasó: es una ficha
  // vacía.
  //
  // Se mira lo que sale de la FICHA, no de los documentos: tener el onboarding
  // subido dice que hicimos el trámite, no que el cliente avanzó. Sin una sola
  // cosa suya cargada no hay con qué comparar, y decir GRAVE ahí afirma algo de
  // él que no sabemos. Lo que sabemos es de nosotros: que no lo cargamos. Gris
  // manda a cargarlo, que es lo que hay que hacer; rojo manda a llamarlo por un
  // atraso que puede no existir.
  if (!evaluados.some((e) => e.estado === 'hecho' && e.hito.fuente === 'ficha')) {
    return {
      color: 'gris',
      palabra: 'ficha vacía',
      porque: 'No hay ni un dato cargado de este cliente, así que no se lo puede comparar contra nada. ' +
              'Eso no quiere decir que esté atrasado: quiere decir que no sabemos.',
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

  // Un cliente que ya terminó el programa no está «grave»: terminó. El atraso
  // de algo que vencía en la semana 4 de un programa que acabó hace medio año
  // no es una urgencia de hoy, y ponerlo en rojo junto a alguien que va en la
  // semana 6 y se puede recuperar es lo que rompe la lista: deja de servir
  // para decidir a quién llamar primero.
  if (seLePaso) {
    const cuantos = vencidos.length
    return {
      color: 'azul',
      palabra: 'terminó sin cerrar',
      porque: `Se le terminó el programa y quedaron ${cuantos} ${cuantos === 1 ? 'cosa' : 'cosas'} sin cerrar, ` +
              `la primera «${corte.hito.etiqueta}». No es una urgencia de esta semana: es la conversación de la renovación.`,
      fase: faseDelHito(corte.hito),
    }
  }

  // Un hito bloqueante es peor que uno que no lo es, pero no convierte dos
  // semanas en una emergencia: sube un escalón, y nada más.
  const escalon = (atrasoMayor >= PARA_GRAVE ? 2 : atrasoMayor >= PARA_ATRASADO ? 1 : 0)
    + (bloqueante ? 1 : 0)


  const queFalta = bloqueante
    ? `«${bloqueante.hito.etiqueta}» bloquea todo lo que viene después y falta hace ${semanas(bloqueante.atrasoEnSemanas)}.`
    : `«${corte.hito.etiqueta}» falta hace ${semanas(corte.atrasoEnSemanas)}.`

  if (escalon >= 2) {
    return { color: 'rojo', palabra: 'grave', porque: queFalta, fase: faseDelHito(corte.hito) }
  }
  if (escalon === 1) {
    return { color: 'naranja', palabra: 'atrasado', porque: queFalta, fase: faseDelHito(corte.hito) }
  }
  return {
    color: 'amarillo',
    palabra: 'para mirar',
    porque: `${queFalta} Todavía se recupera.`,
    fase: faseDelHito(corte.hito),
  }
}

function semanas(n: number | null): string {
  const cuantas = n ?? 0
  return `${cuantas} ${cuantas === 1 ? 'semana' : 'semanas'}`
}
