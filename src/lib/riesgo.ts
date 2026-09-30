import { ETAPAS } from './modulos'
import { etapaHecha } from './avance'
import type { HitoEvaluado } from './hitos'
import { DE_DONDE_SE_DICE, esQueja, esTibia, type LoQueDijo } from './temperatura-tipos'

/**
 * CUÁNDO UN CLIENTE ES GRAVE
 *
 * «Grave» no es una posición en el programa: es que si no hacés algo esta
 * semana, lo perdés. Y no sale de una cuenta sola, sale de cinco señales que el
 * equipo ya venía mirando a mano en su planilla de seguimiento.
 *
 * Basta con que se prenda UNA para que el cliente sea grave, y todas se nombran:
 * la pantalla nunca dice «grave» sin decir por qué, porque un color sin motivo
 * no le sirve a nadie un lunes a la mañana.
 *
 * El atraso se mide en SEMANAS, no en etapas sin marcar, y la diferencia es
 * grande: tres etapas que vencían todas la semana pasada son una semana de
 * atraso, y una sola etapa que vencía en la semana 4 son ocho. Lo que importa
 * es hace cuánto vencía lo primero que falta, no cuántas cosas faltan.
 */

/** Tres semanas de atraso en un programa de dieciséis ya es un cuarto del camino. */
export const SEMANAS_PARA_GRAVE = 3

/** En qué semana se espera la primera venta. */
export const SEMANA_DE_LA_VENTA = 9

export type ClaveDeSenal = 'red_flag' | 'sin_venta' | 'atraso' | 'queja' | 'encuesta'

export type Senal = {
  clave: ClaveDeSenal
  /** Lo que se lee en la pantalla, con su número adentro. */
  dice: string
}

/**
 * HACE CUÁNTAS SEMANAS VENCÍA LO PRIMERO QUE FALTA
 *
 * No es lo mismo que contar etapas sin marcar. Tres etapas que vencían todas la
 * semana pasada son UNA semana de atraso: el cliente está trabajando, va justo.
 * Una sola etapa que vencía en la semana 4, en un cliente que va por la 12, son
 * OCHO semanas: eso quedó abandonado hace meses.
 *
 * Contar cosas mide desprolijidad. Contar semanas mide riesgo.
 */
export function atrasoEnSemanas(semana: number | null, marcadas: ReadonlySet<string>): number | null {
  if (semana === null) return null

  const vencidasSinHacer = ETAPAS.filter((e) => !etapaHecha(e, marcadas) && semana > e.hastaSemana)
  if (vencidasSinHacer.length === 0) return 0

  const laMasVieja = Math.min(...vencidasSinHacer.map((e) => e.hastaSemana))
  return semana - laMasVieja
}

/** Cuál es la etapa más vieja que quedó sin hacer, para poder nombrarla. */
export function laQueQuedoAtras(semana: number | null, marcadas: ReadonlySet<string>) {
  if (semana === null) return null
  const vencidasSinHacer = ETAPAS.filter((e) => !etapaHecha(e, marcadas) && semana > e.hastaSemana)
  if (vencidasSinHacer.length === 0) return null
  return vencidasSinHacer.reduce((a, b) => (a.hastaSemana <= b.hastaSemana ? a : b))
}

export type LoQuePasa = {
  semana: number | null
  marcadas: ReadonlySet<string>
  /** Los hitos evaluados, para saber si vendió. */
  hitos: readonly HitoEvaluado[]
  /** Hay una bandera levantada, y de qué color. */
  bandera: 'roja' | 'naranja' | 'amarilla' | null
  /** Hace cuántas semanas está levantada sin resolverse. */
  banderaDesdeHaceSemanas?: number | null
  /**
   * Lo que el cliente dijo de NOSOTROS, en sesiones y encuestas, con su cita.
   *
   * Caliente y quemando son grave. Tibio no: es un yellow flag, y se devuelve
   * aparte en `lasTibias`. La diferencia la pidió el equipo con esas palabras.
   */
  loQueDijo?: readonly LoQueDijo[]
}

/**
 * Las señales de que este cliente es grave, cada una con su motivo.
 *
 * Vacío quiere decir que no es grave. No quiere decir que esté bien: eso lo
 * decide el atraso, que se mide aparte.
 */
export function senalesDeGrave(lo: LoQuePasa): Senal[] {
  const senales: Senal[] = []

  if (lo.bandera === 'roja') {
    const cuanto = lo.banderaDesdeHaceSemanas
    senales.push({
      clave: 'red_flag',
      dice: cuanto && cuanto >= 1
        ? `Tiene una red flag levantada hace ${cuanto} ${cuanto === 1 ? 'semana' : 'semanas'}, sin resolver.`
        : 'Tiene una red flag levantada.',
    })
  }

  // Las quejas: caliente y quemando. Un tibio NO entra acá.
  for (const dicho of (lo.loQueDijo ?? []).filter((d) => esQueja(d.temperatura))) {
    senales.push({
      clave: dicho.de === 'encuesta' ? 'encuesta' : 'queja',
      dice: comoSeCuenta(dicho),
    })
  }

  // No vendió pasada su semana de venta. Es lo que vino a comprar: si eso no
  // pasa, lo demás da igual.
  const venta = lo.hitos.find((h) => h.hito.clave === 'primera_venta')
  if (lo.semana !== null && lo.semana > SEMANA_DE_LA_VENTA && venta?.estado === 'falta') {
    const hace = lo.semana - SEMANA_DE_LA_VENTA
    senales.push({
      clave: 'sin_venta',
      dice: `Pasó la semana de la primera venta hace ${hace} ${hace === 1 ? 'semana' : 'semanas'} y todavía no vendió.`,
    })
  }

  // El atraso se mira por dos caminos y gana el peor, porque miden lo mismo en
  // la misma unidad y cada uno ve lo que el otro no:
  //  · las ETAPAS marcadas dicen qué del programa quedó sin cerrar;
  //  · los HITOS dicen qué de la ficha vencía y no está.
  // Si nadie marcó etapas todavía, los hitos igual alcanzan para medirlo. Al
  // revés también. No mirar los dos es como el bug de los hitos que no movían
  // el avance: el dato estaba y la cuenta no lo usaba.
  // Con CERO etapas marcadas, el atraso por etapas no mide nada: mide que
  // nadie marcó. Es la regla 1 otra vez —vacío no es cero— y no respetarla acá
  // pondría en grave a todo cliente cuya consultora todavía no tildó nada.
  const hayAlgunaMarcada = ETAPAS.some((e) => etapaHecha(e, lo.marcadas))
  const porEtapas = hayAlgunaMarcada ? atrasoEnSemanas(lo.semana, lo.marcadas) ?? 0 : 0
  const porHitos = Math.max(
    0,
    ...lo.hitos.filter((h) => h.estado === 'falta').map((h) => h.atrasoEnSemanas ?? 0),
  )
  const atraso = Math.max(porEtapas, porHitos)

  // No se pide saber la semana: si `porHitos` trae algo, es porque se evaluó
  // con una semana. Exigirla acá dejaba la señal apagada en silencio cuando el
  // que llama no la pasaba, que es la peor clase de regla: la que no dispara y
  // no se queja.
  if (atraso >= SEMANAS_PARA_GRAVE) {
    const quedo = laQueQuedoAtras(lo.semana, lo.marcadas)
    const corte = lo.hitos
      .filter((h) => h.estado === 'falta')
      .sort((a, b) => (b.atrasoEnSemanas ?? 0) - (a.atrasoEnSemanas ?? 0))[0]

    const queEs = porEtapas >= porHitos && quedo
      ? `«${quedo.nombre}» vencía en la semana ${quedo.hastaSemana}`
      : corte ? `«${corte.hito.etiqueta}» vencía en la semana ${corte.hito.semana}` : null

    senales.push({
      clave: 'atraso',
      dice: `Va ${atraso} ${atraso === 1 ? 'semana' : 'semanas'} atrasado${queEs ? `: ${queEs}` : ''}.`,
    })
  }

  return senales
}

/**
 * Cuáles de las señales siguen valiendo cuando el programa ya terminó.
 *
 * Las del calendario no: el atraso de algo que vencía en la semana 4 de un
 * programa que acabó hace medio año no es una urgencia de hoy, y no haber
 * vendido ya está dicho en «terminó sin cerrar».
 *
 * Las humanas sí, y con más razón: un cliente que se está quejando o que tiene
 * una red flag levantada sigue siendo grave aunque el programa haya terminado.
 * De hecho ahí es cuando pide la plata de vuelta.
 */
const SIGUEN_VALIENDO: ReadonlySet<ClaveDeSenal> = new Set(['red_flag', 'queja', 'encuesta'])

export function lasQueSiguenValiendo(senales: readonly Senal[]): Senal[] {
  return senales.filter((s) => SIGUEN_VALIENDO.has(s.clave))
}

/**
 * LO TIBIO: lo que se mira pero no es grave.
 *
 * «Un tibio no cuenta como grave, es un yellow flag.» Pinta amarillo —«para
 * mirar»— y nada más. Que algo se diga de costado no alcanza para mandar a una
 * consultora a tener una conversación incómoda, pero tampoco puede quedar
 * invisible hasta que sea caliente.
 */
export function lasTibias(lo: Pick<LoQuePasa, 'loQueDijo'>): Senal[] {
  return (lo.loQueDijo ?? [])
    .filter((d) => esTibia(d.temperatura))
    .map((d) => ({ clave: (d.de === 'encuesta' ? 'encuesta' : 'queja') as ClaveDeSenal, dice: comoSeCuenta(d) }))
}

/**
 * Cómo se lee la señal en pantalla, con la frase que la prendió.
 *
 * La cita va siempre que exista: una alerta que no puede mostrar lo que el
 * cliente dijo no se puede discutir, y entonces o se obedece a ciegas o se
 * ignora. Las dos cosas son malas.
 */
function comoSeCuenta(dicho: LoQueDijo): string {
  const donde = DE_DONDE_SE_DICE[dicho.de]
  const que = dicho.temperatura === 'quemando'
    ? `Habló de irse en ${donde}`
    : dicho.temperatura === 'caliente'
      ? `Se quejó de nosotros en ${donde}`
      : `Dijo algo de costado en ${donde}`
  return dicho.cita ? `${que}: «${dicho.cita}»` : `${que}.`
}
