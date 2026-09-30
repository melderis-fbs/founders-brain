import { dondeSeCorta, faseDelHito, type HitoEvaluado } from './hitos'
import { lasQueSiguenValiendo, lasTibias, senalesDeGrave, type Senal } from './riesgo'
import type { LoQueDijo } from './temperatura-tipos'

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
  /** Cuando es grave: cuáles de las cinco señales se prendieron, nombradas. */
  senales?: Senal[]
  /** Lo tibio: se mira, no es grave. Va aparte para que nadie lo sume al rojo. */
  tibias?: Senal[]
}

/** Lo que hay que saber del cliente para pintarlo. */
export type ComoViene = {
  /** Ya pasó la última semana del programa. */
  seLePaso?: boolean
  /** En qué semana va. */
  semana?: number | null
  /** Las etapas y los hitos que alguien marcó. */
  marcadas?: ReadonlySet<string>
  bandera?: 'roja' | 'naranja' | 'amarilla' | null
  banderaDesdeHaceSemanas?: number | null
  /** Lo que el cliente dijo de nosotros, con su cita: sesiones y encuestas. */
  loQueDijo?: readonly LoQueDijo[]
}

/**
 * Los escalones de lo que NO llega a grave.
 *
 * Grave lo deciden las cinco señales de `riesgo.ts`. Lo que queda abajo se
 * separa en dos: una o dos semanas es algo para mirar —en un programa de
 * dieciséis, eso se recupera con una llamada— y de ahí para arriba, atrasado.
 */
const PARA_ATRASADO = 2

export function semaforoDe(evaluados: readonly HitoEvaluado[], como: ComoViene | boolean = {}): Semaforo {
  // Antes el segundo argumento era sólo «ya se le pasó». Se acepta igual para
  // no romper lo que todavía lo llama así.
  const viene: ComoViene = typeof como === 'boolean' ? { seLePaso: como } : como
  const seLePaso = viene.seLePaso ?? false
  const marcadas = viene.marcadas ?? new Set<string>()

  const todas = senalesDeGrave({
    semana: viene.semana ?? null,
    marcadas,
    hitos: evaluados,
    bandera: viene.bandera ?? null,
    banderaDesdeHaceSemanas: viene.banderaDesdeHaceSemanas,
    loQueDijo: viene.loQueDijo,
  })

  // Las señales HUMANAS —red flag levantada, queja del cliente— se miran antes
  // que nada, porque no dependen del calendario y por eso se perdían justo
  // donde más importan: un cliente sin fecha de inicio salía gris, y uno con
  // todo al día salía verde, aunque estuviera pidiendo la plata de vuelta. El
  // atraso se calcula; esto lo dijo alguien.
  const humanas = lasQueSiguenValiendo(todas)
  const tibias = lasTibias({ loQueDijo: viene.loQueDijo })

  if (humanas.length > 0) {
    return {
      color: 'rojo',
      palabra: 'grave',
      porque: humanas.map((s) => s.dice).join(' '),
      fase: faseDeDondeSeCorta(evaluados),
      senales: humanas,
    }
  }

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
    // Al día en el calendario, pero dijo algo de costado. No es grave —eso ya
    // se decidió— y tampoco es verde: verde es el color que hace que nadie lo
    // mire otra vez.
    if (tibias.length > 0) {
      return {
        color: 'amarillo',
        palabra: 'para mirar',
        porque: `${tibias.map((s) => s.dice).join(' ')} No está atrasado: esto es lo que dijo.`,
        fase: null,
        tibias,
      }
    }
    return {
      color: 'verde',
      palabra: 'en tiempo',
      porque: 'No hay nada vencido de lo que hoy se puede medir.',
      fase: null,
    }
  }

  const corte = dondeSeCorta(evaluados)!

  // Lo humano ya se fue arriba. Acá queda lo del calendario: el atraso y la
  // venta que no pasó. Al que ya terminó no le valen —el atraso de un programa
  // que acabó hace medio año no es una urgencia de hoy—, y por eso una queja
  // sí lo sigue pintando de rojo y esto no.
  const senales = seLePaso ? [] : todas.filter((s) => !humanas.includes(s))

  if (senales.length > 0) {
    return {
      color: 'rojo',
      palabra: 'grave',
      porque: senales.map((s) => s.dice).join(' '),
      fase: faseDelHito(corte.hito),
      senales,
    }
  }

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
  const escalon = (atrasoMayor >= PARA_ATRASADO ? 1 : 0) + (bloqueante ? 1 : 0)


  const queFalta = bloqueante
    ? `«${bloqueante.hito.etiqueta}» bloquea todo lo que viene después y falta hace ${semanas(bloqueante.atrasoEnSemanas)}.`
    : `«${corte.hito.etiqueta}» falta hace ${semanas(corte.atrasoEnSemanas)}.`

  if (escalon >= 1) {
    return { color: 'naranja', palabra: 'atrasado', porque: queFalta, fase: faseDelHito(corte.hito) }
  }
  return {
    color: 'amarillo',
    palabra: 'para mirar',
    porque: `${queFalta} Todavía se recupera.`,
    fase: faseDelHito(corte.hito),
  }
}

function faseDeDondeSeCorta(evaluados: readonly HitoEvaluado[]): number | null {
  const corte = dondeSeCorta(evaluados)
  return corte ? faseDelHito(corte.hito) : null
}

function semanas(n: number | null): string {
  const cuantas = n ?? 0
  return `${cuantas} ${cuantas === 1 ? 'semana' : 'semanas'}`
}
