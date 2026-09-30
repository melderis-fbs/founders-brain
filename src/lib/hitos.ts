import type { Campo } from './campos'
import { etapasDeLaSemana, FASES, faseDeLaSemana, type ClaveEtapa } from './modulos'

/**
 * Lo que tendría que estar hecho, y cuándo.
 *
 * De acá sale toda la comparación. Un hito no se marca solo porque sí: cada uno
 * declara de qué lee (`fuente`), y si esa fuente todavía no existe en la
 * aplicación el hito NO dice «falta», dice «sin datos».
 *
 * Es la regla 2 llevada a la comparación: una regla sin datos no opina. Decir
 * «no hizo la primera venta» cuando nadie cargó ninguna venta no es un dato
 * flojo, es una afirmación falsa sobre el cliente.
 */

/** De dónde lee un hito. Si la fuente no está cargada, el hito no opina. */
export type Fuente = 'ficha' | 'documentos' | 'ventas' | 'reuniones' | 'llamadas' | 'tracker' | 'seguimiento'

export const FUENTES_ETIQUETA: Record<Fuente, string> = {
  ficha: 'los datos de la ficha',
  documentos: 'los documentos del cliente',
  ventas: 'las ventas de cada cliente',
  reuniones: 'las reuniones agendadas',
  llamadas: 'las llamadas de venta',
  tracker: 'el tracker semanal',
  seguimiento: 'el sistema de seguimiento',
}

/**
 * Qué fuentes tienen datos de verdad, hoy, en esta cartera.
 *
 * No alcanza con que la aplicación sepa leer una fuente: la regla 2 dice que si
 * la tabla está vacía en TODA la cartera, la regla no dispara. Por eso esto se
 * calcula mirando lo que hay cargado, y no es una lista fija.
 */
export type FuentesConDatos = ReadonlySet<Fuente>

export function fuentesConDatos(cartera: {
  algunClienteConDatosDeFicha: boolean
  algunOnboardingCargado: boolean
}): FuentesConDatos {
  const con = new Set<Fuente>()
  if (cartera.algunClienteConDatosDeFicha) con.add('ficha')
  if (cartera.algunOnboardingCargado) con.add('documentos')
  // ventas, reuniones, llamadas, tracker y seguimiento todavía no se cargan en
  // ningún lado: mientras no existan, ningún hito que lea de ahí opina.
  return con
}

export type Hito = {
  clave: string
  semana: number
  etiqueta: string
  /** Sin esto, lo de más adelante no se le puede exigir. */
  bloquea: boolean
  fuente: Fuente
  /** Qué datos de la ficha lo dan por hecho. Vacío si la fuente no es la ficha. */
  camposQueLoDan?: readonly string[]
}

export const HITOS: readonly Hito[] = [
  { clave: 'onboarding', semana: 1, etiqueta: 'Onboarding hecho y datos base cargados',
    bloquea: false, fuente: 'documentos' },
  { clave: 'cuenta_inversa', semana: 1, etiqueta: 'Sabe cuántas ventas necesita por mes',
    bloquea: false, fuente: 'ficha', camposQueLoDan: ['meta_mensual', 'ticket'] },
  { clave: 'cliente_ideal', semana: 3, etiqueta: 'Cliente ideal y problema cerrados',
    bloquea: false, fuente: 'ficha', camposQueLoDan: ['cliente_ideal', 'problema'] },
  { clave: 'oferta', semana: 4, etiqueta: 'Oferta y promesa cerradas',
    bloquea: true, fuente: 'ficha', camposQueLoDan: ['oferta', 'promesa'] },
  { clave: 'mensaje', semana: 5, etiqueta: 'Mensaje y canal definidos',
    bloquea: false, fuente: 'ficha', camposQueLoDan: ['mensaje', 'canal'] },
  { clave: 'conversaciones', semana: 6, etiqueta: 'Primeras conversaciones que avanzan',
    bloquea: false, fuente: 'tracker' },
  { clave: 'primera_reunion', semana: 6, etiqueta: 'Primera reunión agendada',
    bloquea: false, fuente: 'reuniones' },
  { clave: 'ritmo', semana: 7, etiqueta: 'Ritmo semanal de mensajes sostenido 3 semanas',
    bloquea: false, fuente: 'tracker' },
  { clave: 'primera_llamada', semana: 8, etiqueta: 'Primera llamada de venta hecha',
    bloquea: false, fuente: 'llamadas' },
  { clave: 'primera_venta', semana: 9, etiqueta: 'Primera venta',
    bloquea: true, fuente: 'ventas' },
  { clave: 'segunda_venta', semana: 13, etiqueta: 'Segunda venta',
    bloquea: true, fuente: 'ventas' },
  { clave: 'seguimiento', semana: 14, etiqueta: 'Sistema de seguimiento que se sostiene',
    bloquea: false, fuente: 'seguimiento' },
]

export type EstadoHito = 'hecho' | 'falta' | 'esta_semana' | 'sin_datos' | 'todavia_no'

/**
 * Por qué no se sabe. Son tres cosas distintas y confundirlas fue el bug:
 *
 *  · `no_cargado`      — la fuente existe, pero de ESTE cliente no está cargada.
 *                        Es trabajo nuestro pendiente, y se puede hacer hoy.
 *  · `no_hay_fuente`   — esa fuente todavía no existe en la aplicación para
 *                        nadie. No es trabajo de nadie: es una funcionalidad
 *                        que falta.
 *  · `sin_fecha`       — sin fecha de inicio no se sabe si ya correspondía.
 */
export type PorQueNoSeSabe = 'no_cargado' | 'no_hay_fuente' | 'sin_fecha'

export type HitoEvaluado = {
  hito: Hito
  estado: EstadoHito
  /** Cuántas semanas hace que se venció, si se venció. */
  atrasoEnSemanas: number | null
  /** Por qué no se puede saber, cuando el estado es «sin datos». */
  porQueNoSeSabe?: string
  porQue?: PorQueNoSeSabe
}

const COMO_SE_CARGA: Partial<Record<Fuente, string>> = {
  ficha: 'no hay ningún dato de ficha cargado en toda la cartera',
  documentos: 'no hay ningún onboarding cargado en toda la cartera',
  ventas: 'todavía no se cargan las ventas de los clientes',
  reuniones: 'todavía no se cargan las reuniones',
  llamadas: 'todavía no se cargan las llamadas de venta',
  tracker: 'todavía no se carga el tracker semanal',
  seguimiento: 'todavía no se carga el sistema de seguimiento',
}

export function evaluarHitos(datos: {
  semana: number | null
  valores: Record<string, unknown>
  tiposDeDocumento: ReadonlySet<string>
  conDatos: FuentesConDatos
}): HitoEvaluado[] {
  return HITOS.map((hito) => {
    if (!datos.conDatos.has(hito.fuente)) {
      return {
        hito,
        estado: 'sin_datos' as const,
        atrasoEnSemanas: null,
        porQueNoSeSabe: COMO_SE_CARGA[hito.fuente] ?? 'falta la fuente de este dato',
        porQue: 'no_hay_fuente' as const,
      }
    }

    const hecho = hito.fuente === 'documentos'
      ? datos.tiposDeDocumento.has('onboarding')
      : (hito.camposQueLoDan ?? []).every((clave) => tieneDato(datos.valores[clave]))

    if (hecho) return { hito, estado: 'hecho', atrasoEnSemanas: null }
    if (datos.semana === null) {
      return {
        hito, estado: 'sin_datos', atrasoEnSemanas: null, porQue: 'sin_fecha',
        porQueNoSeSabe: 'no hay fecha de inicio, así que no se sabe si ya correspondía',
      }
    }

    if (datos.semana < hito.semana) return { hito, estado: 'todavia_no', atrasoEnSemanas: null }

    // Lo que vence esta misma semana todavía no está atrasado: se está
    // trabajando. Contarlo como falta hace que un cliente que va en tiempo se
    // ponga en rojo el lunes por algo que tiene toda la semana para hacer.
    if (datos.semana === hito.semana) return { hito, estado: 'esta_semana', atrasoEnSemanas: 0 }

    // LA REGLA 2, PERO POR CLIENTE. Acá estaba la mentira más cara del tablero.
    //
    // `conDatos` miraba si la fuente tenía datos en ALGÚN cliente de la
    // cartera. Como alguien había subido un onboarding, el hito opinaba sobre
    // los ciento catorce clientes a los que nadie les subió el suyo, y decía
    // que estaban atrasados desde la semana 1. Lo mismo con la ficha: «no sabe
    // cuántas ventas necesita, hace doce semanas» cuando lo que pasó es que
    // nadie cargó la meta y el ticket.
    //
    // Estas dos fuentes las llenamos NOSOTROS. Pueden probar que algo ESTÁ
    // hecho; no pueden probar que no se hizo. Un casillero vacío no es un cero
    // (regla 1), y una regla sin datos no dispara (regla 2). Así que cuando no
    // están cargadas, el hito no dice «falta»: dice qué hay que cargar.
    //
    // No hay umbrales ni medias tintas a propósito: cargar la mitad de un dato
    // no puede empeorar a un cliente. Si cargar algo pusiera a alguien en rojo,
    // el sistema estaría enseñando a no cargar nada.
    if (hito.fuente === 'documentos') {
      return {
        hito,
        estado: 'sin_datos',
        atrasoEnSemanas: null,
        porQueNoSeSabe: 'no está cargado el onboarding de este cliente',
        porQue: 'no_cargado',
      }
    }

    if (hito.fuente === 'ficha') {
      const cuales = (hito.camposQueLoDan ?? []).join(' y ')
      return {
        hito,
        estado: 'sin_datos',
        atrasoEnSemanas: null,
        porQueNoSeSabe: `no está cargado ${cuales} de este cliente`,
        porQue: 'no_cargado',
      }
    }


    return { hito, estado: 'falta', atrasoEnSemanas: datos.semana - hito.semana }
  })
}

function tieneDato(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false
  if (typeof valor === 'string') return valor.trim() !== ''
  return true
}

/** Dónde se corta: el primer hito vencido que falta. */
export function dondeSeCorta(evaluados: readonly HitoEvaluado[]): HitoEvaluado | null {
  return evaluados.find((e) => e.estado === 'falta') ?? null
}

/**
 * En qué etapa del programa cae un hito.
 *
 * Sale de su semana, no de un campo escrito a mano: así no puede decir
 * «Ventas y Cierre» un hito que vence en la semana 3.
 */
export function etapaDelHito(hito: Hito): ClaveEtapa | null {
  return etapasDeLaSemana(hito.semana)[0]?.clave ?? null
}

/** En qué fase del programa cae un hito. */
export function faseDelHito(hito: Hito): 1 | 2 | 3 | 4 | null {
  return faseDeLaSemana(hito.semana)?.numero ?? null
}

/** Cómo está cada fase: mira todos los hitos que vencen dentro de ella. */
export function fasesSegunLosHitos(evaluados: readonly HitoEvaluado[]): Record<number, EstadoHito> {
  const salida: Record<number, EstadoHito> = {}
  for (const fase of FASES) {
    const suyos = evaluados.filter((e) => faseDelHito(e.hito) === fase.numero)
    const etapa = fase.numero
    // Una fase está hecha cuando está hecho TODO lo suyo. Antes alcanzaba con
    // uno, y una fase con un hito hecho y tres que ni se pueden medir salía en
    // verde: es la clase de mentira que hace que nadie mire más el tablero.
    if (suyos.length === 0) salida[etapa] = 'sin_datos'
    else if (suyos.some((e) => e.estado === 'falta')) salida[etapa] = 'falta'
    else if (suyos.every((e) => e.estado === 'hecho')) salida[etapa] = 'hecho'
    else if (suyos.some((e) => e.estado === 'esta_semana')) salida[etapa] = 'esta_semana'
    else if (suyos.some((e) => e.estado === 'sin_datos')) salida[etapa] = 'sin_datos'
    else salida[etapa] = 'todavia_no'
  }
  return salida
}

/**
 * La línea de qué necesita: corta, en el idioma del equipo.
 *
 * Lo primero que dice es lo que falta CARGAR, cuando falta. Es lo que se puede
 * hacer hoy, y es lo que hay que hacer antes de poder decir cualquier otra cosa
 * de ese cliente.
 */
export function queNecesita(evaluados: readonly HitoEvaluado[], faltanDatos: readonly Campo[]): string {
  const corte = dondeSeCorta(evaluados)
  if (corte) {
    const semanas = corte.atrasoEnSemanas ?? 0
    if (semanas === 0) return `${corte.hito.etiqueta.toLowerCase()}, esta semana`
    return `${corte.hito.etiqueta.toLowerCase()}: ${semanas} ${semanas === 1 ? 'semana' : 'semanas'} de atraso`
  }
  const sinCargar = faltaCargar(evaluados)
  if (sinCargar.length > 0) {
    return `cargar ${sinCargar[0]!.hito.etiqueta.toLowerCase()}` +
      (sinCargar.length > 1 ? ` y ${sinCargar.length - 1} ${sinCargar.length === 2 ? 'cosa' : 'cosas'} más` : '')
  }
  if (faltanDatos.length > 0) {
    return `completar la ficha: faltan ${faltanDatos.length} datos`
  }
  const seSabe = evaluados.some((e) => e.estado !== 'sin_datos')
  return seSabe ? 'va en tiempo' : 'no hay datos para saber cómo va'
}

/**
 * Lo que ya venció y no se puede mirar porque no está cargado.
 *
 * Es la lista que convierte un gris en algo que se puede hacer hoy: no dice
 * «no sabemos», dice qué cargar y de qué cliente.
 *
 * No hace falta pasarle la semana: `no_cargado` sólo se devuelve cuando la
 * semana del hito ya pasó. Pedirla era una forma de que el dato se perdiera en
 * silencio cuando el que llamaba no la tenía a mano, que es justo lo que pasaba
 * en el expediente.
 */
export function faltaCargar(evaluados: readonly HitoEvaluado[]): HitoEvaluado[] {
  return evaluados.filter((e) => e.porQue === 'no_cargado')
}
