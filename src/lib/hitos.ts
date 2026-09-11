import type { Campo } from './campos'

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

export const ETAPAS = ['definicion', 'mensaje', 'volumen', 'conversion', 'escala'] as const
export type Etapa = (typeof ETAPAS)[number]

export const ETIQUETA_ETAPA: Record<Etapa, string> = {
  definicion: 'Definición',
  mensaje: 'Mensaje',
  volumen: 'Volumen',
  conversion: 'Conversión',
  escala: 'Escala',
}

export const PREGUNTA_ETAPA: Record<Etapa, string> = {
  definicion: '¿Qué vende, a quién y por cuánto?',
  mensaje: '¿Lo comunica de forma que el comprador correcto se reconozca?',
  volumen: '¿Le llega a suficiente gente?',
  conversion: '¿Las conversaciones se transforman en ventas?',
  escala: '¿La venta se repite o fue suerte?',
}

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
  etapa: Etapa
  /** Sin esto, lo de más adelante no se le puede exigir. */
  bloquea: boolean
  fuente: Fuente
  /** Qué datos de la ficha lo dan por hecho. Vacío si la fuente no es la ficha. */
  camposQueLoDan?: readonly string[]
}

export const HITOS: readonly Hito[] = [
  { clave: 'onboarding', semana: 1, etiqueta: 'Onboarding hecho y datos base cargados', etapa: 'definicion',
    bloquea: false, fuente: 'documentos' },
  { clave: 'cuenta_inversa', semana: 1, etiqueta: 'Cuenta inversa hecha con el cliente', etapa: 'definicion',
    bloquea: false, fuente: 'ficha', camposQueLoDan: ['fecha_cuenta_inversa', 'meta_mensual', 'ticket'] },
  { clave: 'cliente_ideal', semana: 3, etiqueta: 'Cliente ideal y problema cerrados', etapa: 'definicion',
    bloquea: false, fuente: 'ficha', camposQueLoDan: ['cliente_ideal', 'problema'] },
  { clave: 'oferta', semana: 4, etiqueta: 'Oferta y promesa cerradas', etapa: 'definicion',
    bloquea: true, fuente: 'ficha', camposQueLoDan: ['oferta', 'promesa'] },
  { clave: 'mensaje', semana: 5, etiqueta: 'Mensaje y canal definidos', etapa: 'mensaje',
    bloquea: false, fuente: 'ficha', camposQueLoDan: ['mensaje', 'canal'] },
  { clave: 'conversaciones', semana: 6, etiqueta: 'Primeras conversaciones que avanzan', etapa: 'volumen',
    bloquea: false, fuente: 'tracker' },
  { clave: 'primera_reunion', semana: 6, etiqueta: 'Primera reunión agendada', etapa: 'volumen',
    bloquea: false, fuente: 'reuniones' },
  { clave: 'ritmo', semana: 7, etiqueta: 'Ritmo semanal de mensajes sostenido 3 semanas', etapa: 'volumen',
    bloquea: false, fuente: 'tracker' },
  { clave: 'primera_llamada', semana: 8, etiqueta: 'Primera llamada de venta hecha', etapa: 'conversion',
    bloquea: false, fuente: 'llamadas' },
  { clave: 'primera_venta', semana: 9, etiqueta: 'Primera venta', etapa: 'conversion',
    bloquea: true, fuente: 'ventas' },
  { clave: 'segunda_venta', semana: 13, etiqueta: 'Segunda venta', etapa: 'escala',
    bloquea: true, fuente: 'ventas' },
  { clave: 'seguimiento', semana: 14, etiqueta: 'Sistema de seguimiento que se sostiene', etapa: 'escala',
    bloquea: false, fuente: 'seguimiento' },
]

export type EstadoHito = 'hecho' | 'falta' | 'sin_datos' | 'todavia_no'

export type HitoEvaluado = {
  hito: Hito
  estado: EstadoHito
  /** Cuántas semanas hace que se venció, si se venció. */
  atrasoEnSemanas: number | null
  /** Por qué no se puede saber, cuando el estado es «sin datos». */
  porQueNoSeSabe?: string
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
      }
    }

    const hecho = hito.fuente === 'documentos'
      ? datos.tiposDeDocumento.has('onboarding')
      : (hito.camposQueLoDan ?? []).every((clave) => tieneDato(datos.valores[clave]))

    if (hecho) return { hito, estado: 'hecho', atrasoEnSemanas: null }
    if (datos.semana === null) return { hito, estado: 'sin_datos', atrasoEnSemanas: null, porQueNoSeSabe: 'no hay fecha de inicio, así que no se sabe si ya correspondía' }
    if (datos.semana < hito.semana) return { hito, estado: 'todavia_no', atrasoEnSemanas: null }
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

/** Cómo está cada etapa: hecha si todos sus hitos exigibles están hechos. */
export function estadoDeEtapas(evaluados: readonly HitoEvaluado[]): Record<Etapa, EstadoHito> {
  const salida = {} as Record<Etapa, EstadoHito>
  for (const etapa of ETAPAS) {
    const suyos = evaluados.filter((e) => e.hito.etapa === etapa)
    if (suyos.some((e) => e.estado === 'falta')) salida[etapa] = 'falta'
    else if (suyos.every((e) => e.estado === 'hecho')) salida[etapa] = 'hecho'
    else if (suyos.some((e) => e.estado === 'hecho')) salida[etapa] = 'hecho'
    else if (suyos.every((e) => e.estado === 'todavia_no')) salida[etapa] = 'todavia_no'
    else salida[etapa] = 'sin_datos'
  }
  return salida
}

/** La línea de qué necesita: corta, en el idioma del equipo. */
export function queNecesita(evaluados: readonly HitoEvaluado[], faltanDatos: readonly Campo[]): string {
  const corte = dondeSeCorta(evaluados)
  if (corte) {
    const semanas = corte.atrasoEnSemanas ?? 0
    if (semanas === 0) return `${corte.hito.etiqueta.toLowerCase()}, esta semana`
    return `${corte.hito.etiqueta.toLowerCase()}: ${semanas} ${semanas === 1 ? 'semana' : 'semanas'} de atraso`
  }
  if (faltanDatos.length > 0) {
    return `completar la ficha: faltan ${faltanDatos.length} datos`
  }
  const seSabe = evaluados.some((e) => e.estado !== 'sin_datos')
  return seSabe ? 'va en tiempo' : 'no hay datos para saber cómo va'
}

/**
 * En qué etapa tendría que estar un cliente por calendario.
 *
 * La última etapa cuyo primer hito ya venció. No es dónde está: es dónde el
 * programa dice que debería estar a esta altura. Las dos juntas son la
 * comparación —«tendría que estar vendiendo y se corta en la oferta»—, y por
 * separado no dicen nada.
 *
 * Sin fecha de inicio no hay semana, y sin semana no hay etapa que le toque.
 * No se inventa una.
 */
export function etapaQueLeTocaria(semana: number | null): Etapa | null {
  if (semana === null) return null

  let laQueVa: Etapa | null = null
  for (const etapa of ETAPAS) {
    const arranca = Math.min(...HITOS.filter((h) => h.etapa === etapa).map((h) => h.semana))
    if (semana >= arranca) laQueVa = etapa
  }
  return laQueVa
}
