import { CAMPOS, ETIQUETA_GRUPO, type Grupo } from './campos'
import type { HitoEvaluado } from './hitos'
import { ETIQUETA_ETAPA } from './hitos'
import type { SesionEnLista } from './sesiones-tipos'

/**
 * La lectura del caso, hecha con aritmética.
 *
 * Corre siempre y no cuesta nada: restar fechas y contar hitos es gratis. El
 * modelo se llama después, cuando alguien aprieta un botón, y para lo que la
 * aritmética no puede contestar.
 *
 * LA DIFERENCIA CON UN PUNTAJE SUELTO. Un número como «índice 9» no dice nada:
 * no se sabe si es 9 porque el cliente no hizo nada o porque nadie cargó nada,
 * y son la cosa opuesta. Acá cada parte dice si tiene datos o no, lo que no
 * tiene datos NO cuenta como cero —se reparte su peso entre las que sí— y el
 * resultado viaja siempre con sobre cuánta información se calculó. Un 40 sobre
 * el 30% de la información no es un 40: es «todavía no se sabe».
 */

export type ClaveParte = 'hitos' | 'cuenta_inversa' | 'ejecucion' | 'resultado' | 'criterio'

export type Parte = {
  clave: ClaveParte
  etiqueta: string
  /** Cuánto pesa, si tiene datos. */
  peso: number
  pregunta: string
} & (
  | { estado: 'sin_datos'; porque: string }
  | { estado: 'medido'; valor: number; detalle: string }
)

/** Dónde se corta: el primer hito vencido que traba lo que viene después. */
export type Corte = {
  etiqueta: string
  etapa: string
  atrasoEnSemanas: number | null
  /** Si la información alcanza para sacar una conclusión, o sólo para juntar dato. */
  alcanzaParaConcluir: boolean
  porque: string
  accion: string
  /** Lo que NO hay que hacer con esta información. Vale tanto como la acción. */
  queNoHacer: string
}

export type Lectura = {
  partes: Parte[]
  /** 0 a 100 sobre lo que se pudo medir. null si no se pudo medir nada. */
  puntaje: number | null
  /** Qué parte del peso total tuvo datos, de 0 a 100. */
  cobertura: number
  /** La frase que se lee antes que el número. */
  titular: string
  corte: Corte | null
  /** Qué habría que cargar para que esto valga más. */
  paraQueValgaMas: string[]
}

const PESOS: Record<ClaveParte, { peso: number; etiqueta: string; pregunta: string }> = {
  hitos:          { peso: 30, etiqueta: 'Lo que tendría que estar hecho', pregunta: '¿Está donde tendría que estar a esta altura?' },
  cuenta_inversa: { peso: 25, etiqueta: 'La cuenta inversa',              pregunta: '¿Sabe cuántas ventas necesita, y de dónde salen?' },
  ejecucion:      { peso: 20, etiqueta: 'El trabajo de las semanas',      pregunta: '¿Se están haciendo las sesiones?' },
  resultado:      { peso: 15, etiqueta: 'Lo que vendió',                  pregunta: '¿Está vendiendo?' },
  criterio:       { peso: 10, etiqueta: 'La lectura de la consultora',    pregunta: '¿Alguien miró este caso y escribió qué ve?' },
}

const DIAS_DE_EJECUCION = 30

export type DatosDeLectura = {
  hitos: readonly HitoEvaluado[]
  valores: Record<string, unknown>
  sesiones: readonly SesionEnLista[]
  /** Si en TODA la cartera hay alguna sesión cargada. Regla 2. */
  hayAlgunaSesionEnLaCartera: boolean
  hayDiagnostico: boolean
  hoy?: Date
}

export function leerElCaso(datos: DatosDeLectura): Lectura {
  const partes: Parte[] = [
    deHitos(datos.hitos),
    deCuentaInversa(datos.valores),
    deEjecucion(datos.sesiones, datos.hayAlgunaSesionEnLaCartera, datos.hoy ?? new Date()),
    deResultado(datos.hitos),
    deCriterio(datos.hayDiagnostico),
  ]

  // El peso de lo que no se sabe no se cuenta como cero: se reparte entre lo
  // que sí se pudo medir. Si no, «nadie cargó nada» y «no hizo nada» dan el
  // mismo número, y hay que llamar al cliente para saber cuál de las dos es.
  const medidas = partes.filter((p) => p.estado === 'medido') as Extract<Parte, { estado: 'medido' }>[]
  const pesoMedido = medidas.reduce((t, p) => t + p.peso, 0)
  const pesoTotal = partes.reduce((t, p) => t + p.peso, 0)

  const puntaje = pesoMedido === 0
    ? null
    : Math.round(medidas.reduce((t, p) => t + p.valor * p.peso, 0) / pesoMedido)

  const cobertura = Math.round((pesoMedido / pesoTotal) * 100)
  const corte = dondeSeCorta(datos.hitos, cobertura)

  return {
    partes,
    puntaje,
    cobertura,
    titular: titularDe(corte, puntaje, cobertura),
    corte,
    paraQueValgaMas: partes
      .filter((p) => p.estado === 'sin_datos')
      .map((p) => `${p.etiqueta}: ${(p as Extract<Parte, { estado: 'sin_datos' }>).porque}`),
  }
}

/**
 * El titular, que es lo que se lee antes que el número.
 *
 * Primero lo que se puede afirmar, después con cuánta información. Nunca el
 * número solo: «9» no se puede discutir, «la oferta falta hace 27 semanas» sí.
 */
function titularDe(corte: Corte | null, puntaje: number | null, cobertura: number): string {
  if (corte) {
    const cuando = corte.atrasoEnSemanas === null
      ? 'y todavía no está'
      : `y falta hace ${corte.atrasoEnSemanas} ${corte.atrasoEnSemanas === 1 ? 'semana' : 'semanas'}`
    return `Se corta en «${corte.etiqueta}» ${cuando}.`
  }
  if (puntaje === null) {
    return 'Sobre este cliente no se puede afirmar nada todavía: no hay nada cargado para mirar.'
  }
  if (cobertura < 50) {
    return `Lo que hay cargado da bien, pero es el ${cobertura}% de lo que haría falta para opinar.`
  }
  return 'Está donde tendría que estar a esta altura.'
}

// ── Cada parte ──────────────────────────────────────────────────────────────

function deHitos(hitos: readonly HitoEvaluado[]): Parte {
  const base = { clave: 'hitos' as const, ...PESOS.hitos }
  const exigibles = hitos.filter((h) => h.estado === 'hecho' || h.estado === 'falta')
  if (exigibles.length === 0) {
    return { ...base, estado: 'sin_datos', porque: 'ninguno de los hitos se puede evaluar con lo que hay cargado' }
  }
  const hechos = exigibles.filter((h) => h.estado === 'hecho').length
  return {
    ...base,
    estado: 'medido',
    valor: Math.round((hechos / exigibles.length) * 100),
    detalle: `${hechos} de ${exigibles.length} que ya le tocaban${
      hitos.length - exigibles.length > 0 ? ` · ${hitos.length - exigibles.length} no se pueden evaluar` : ''}`,
  }
}

/**
 * La cuenta inversa: cuántas ventas necesita para llegar a la meta.
 *
 * No es un campo que se marca: son tres números que tienen que estar y tienen
 * que cerrar. Si la meta no se puede alcanzar con el precio que cobra, eso no
 * es un puntaje bajo, es una cuenta que hay que rehacer con el cliente.
 */
function deCuentaInversa(valores: Record<string, unknown>): Parte {
  const base = { clave: 'cuenta_inversa' as const, ...PESOS.cuenta_inversa }
  const meta = numero(valores.meta_mensual)
  const precio = numero(valores.precio_actual) ?? numero(valores.ticket)
  const hecha = valores.fecha_cuenta_inversa != null && String(valores.fecha_cuenta_inversa) !== ''

  if (meta === null && precio === null) {
    return { ...base, estado: 'sin_datos', porque: 'no está cargada ni la meta mensual ni el precio' }
  }
  if (meta === null) return { ...base, estado: 'sin_datos', porque: 'falta la meta mensual' }
  if (precio === null) return { ...base, estado: 'sin_datos', porque: 'falta el precio que cobra hoy' }
  if (precio <= 0) return { ...base, estado: 'sin_datos', porque: 'el precio cargado es cero' }

  const ventasPorMes = Math.ceil(meta / precio)
  if (!hecha) {
    return {
      ...base,
      estado: 'medido',
      valor: 40,
      detalle: `Los números están (necesita ${ventasPorMes} ${ventasPorMes === 1 ? 'venta' : 'ventas'} por mes), pero la cuenta no está hecha con el cliente.`,
    }
  }
  return {
    ...base,
    estado: 'medido',
    valor: 100,
    detalle: `Hecha: necesita ${ventasPorMes} ${ventasPorMes === 1 ? 'venta' : 'ventas'} por mes para llegar a la meta.`,
  }
}

function deEjecucion(
  sesiones: readonly SesionEnLista[],
  hayAlgunaEnLaCartera: boolean,
  hoy: Date,
): Parte {
  const base = { clave: 'ejecucion' as const, ...PESOS.ejecucion }

  // Regla 2: si en toda la cartera no se cargó nunca una sesión, esto no opina.
  // Cero sesiones puede ser «no se reunieron» o «no las cargamos», y decir lo
  // primero cuando pasa lo segundo es una afirmación falsa sobre el cliente.
  if (!hayAlgunaEnLaCartera) {
    return { ...base, estado: 'sin_datos', porque: 'todavía no se cargan sesiones en ningún cliente' }
  }

  const desde = new Date(hoy)
  desde.setDate(desde.getDate() - DIAS_DE_EJECUCION)
  const recientes = sesiones.filter(
    (s) => s.estado === 'hecha' && s.fecha !== null && new Date(`${s.fecha}T00:00:00`) >= desde,
  )

  if (sesiones.length === 0) {
    return { ...base, estado: 'medido', valor: 0, detalle: `Ninguna sesión cargada de este cliente.` }
  }
  // Una por semana es el ritmo del programa: cuatro en treinta días es 100.
  const valor = Math.min(100, Math.round((recientes.length / 4) * 100))
  return {
    ...base,
    estado: 'medido',
    valor,
    detalle: `${recientes.length} ${recientes.length === 1 ? 'sesión hecha' : 'sesiones hechas'} en los últimos ${DIAS_DE_EJECUCION} días.`,
  }
}

function deResultado(hitos: readonly HitoEvaluado[]): Parte {
  const base = { clave: 'resultado' as const, ...PESOS.resultado }
  const deVenta = hitos.filter((h) => h.hito.fuente === 'ventas')
  if (deVenta.length === 0 || deVenta.every((h) => h.estado === 'sin_datos')) {
    return { ...base, estado: 'sin_datos', porque: deVenta[0]?.porQueNoSeSabe ?? 'todavía no se cargan las ventas de los clientes' }
  }
  const hechas = deVenta.filter((h) => h.estado === 'hecho').length
  return {
    ...base,
    estado: 'medido',
    valor: Math.round((hechas / deVenta.length) * 100),
    detalle: `${hechas} de ${deVenta.length} hitos de venta.`,
  }
}

function deCriterio(hayDiagnostico: boolean): Parte {
  const base = { clave: 'criterio' as const, ...PESOS.criterio }
  return hayDiagnostico
    ? { ...base, estado: 'medido', valor: 100, detalle: 'El caso está diagnosticado.' }
    : { ...base, estado: 'medido', valor: 0, detalle: 'Todavía nadie diagnosticó este caso.' }
}

// ── Dónde se corta ──────────────────────────────────────────────────────────

/**
 * El primer hito vencido, y qué hacer con eso.
 *
 * Lo que más importa acá no es la acción, es el «qué no hacer»: con la ficha a
 * medias es tentador concluir que el cliente no vende, cuando lo único que se
 * sabe es que nadie cargó las ventas. Una conclusión sacada de un campo vacío
 * se convierte en una conversación con el cliente, y esa no se puede deshacer.
 */
function dondeSeCorta(hitos: readonly HitoEvaluado[], cobertura: number): Corte | null {
  const vencidos = hitos.filter((h) => h.estado === 'falta')
  if (vencidos.length === 0) return null

  // El que bloquea manda, aunque haya otro más viejo que no bloquee.
  const primero = vencidos.find((h) => h.hito.bloquea) ?? vencidos[0]!
  const alcanza = cobertura >= 50

  return {
    etiqueta: primero.hito.etiqueta,
    etapa: ETIQUETA_ETAPA[primero.hito.etapa],
    atrasoEnSemanas: primero.atrasoEnSemanas,
    alcanzaParaConcluir: alcanza,
    porque: primero.hito.bloquea
      ? 'Sin esto, lo que viene después no se le puede exigir: cualquier cosa que se trabaje más adelante se apoya en esto.'
      : 'Es lo primero de la lista que está vencido.',
    accion: `En la próxima sesión, cerrar «${primero.hito.etiqueta.toLowerCase()}» y dejarlo cargado en la ficha.`,
    queNoHacer: alcanza
      ? 'No saltar a lo que viene después. Trabajar la etapa siguiente sin esto cerrado es rehacerlo en dos semanas.'
      : `No sacar conclusiones sobre este cliente todavía: sólo está cargado el ${cobertura}% de lo que haría falta. Un diagnóstico sin datos es una opinión.`,
  }
}

function numero(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

// ── Los bloques de la ficha ─────────────────────────────────────────────────

export type Bloque = {
  grupo: Grupo
  etiqueta: string
  cargados: number
  total: number
  estado: 'completo' | 'a_medias' | 'vacio'
}

export type Expedientito = {
  bloques: Bloque[]
  conAlgo: number
  /** Qué va a poder contestar el diagnóstico con esto, dicho sin vueltas. */
  queVaAPoder: string
  /** Si vale la pena gastar en el modelo, o la respuesta ya se sabe. */
  valeLaPena: boolean
}

/**
 * En qué estado está la ficha, por bloques.
 *
 * Seis bloques, tres estados, una frase. No hace falta más: la lista de los
 * 49 campos que faltan ya está en la ficha, y repetirla acá no ayuda a
 * decidir nada. Lo que sí ayuda es saber si el diagnóstico va a contestar
 * algo o va a decir «eso no está cargado» cuarenta veces.
 */
export function bloquesDeLaFicha(
  valores: Record<string, unknown>,
  hay: { documentos: number; sesiones: number },
): Expedientito {
  const bloques: Bloque[] = ([...new Set(CAMPOS.map((c) => c.grupo))] as Grupo[]).map((grupo) => {
    const suyos = CAMPOS.filter((c) => c.grupo === grupo && c.cuenta)
    const cargados = suyos.filter((c) => tieneAlgo(valores[c.clave])).length
    return {
      grupo,
      etiqueta: ETIQUETA_GRUPO[grupo],
      cargados,
      total: suyos.length,
      estado: cargados === 0 ? 'vacio' : cargados === suyos.length ? 'completo' : 'a_medias',
    }
  })

  const conAlgo = bloques.filter((b) => b.estado !== 'vacio').length
  const nada = conAlgo === 0 && hay.documentos === 0 && hay.sesiones === 0

  return {
    bloques,
    conAlgo,
    valeLaPena: !nada,
    queVaAPoder: nada
      ? 'No hay nada cargado de este cliente: ni ficha, ni documentos, ni sesiones. El diagnóstico no tiene sobre qué trabajar y no hace falta gastar en pedirlo.'
      : conAlgo <= 2 && hay.documentos === 0
        ? `Con ${conAlgo} de 6 bloques y ningún documento, el diagnóstico va a contestar «eso no está cargado» más de lo que te va a servir. Cargá un documento y completá la ficha desde ahí primero.`
        : hay.documentos === 0
          ? `Hay ${conAlgo} de 6 bloques con datos, pero ningún documento cargado. El diagnóstico va a poder comparar contra el programa; de la cabeza del cliente no va a poder decir nada.`
          : `Hay ${conAlgo} de 6 bloques con datos y ${hay.documentos} ${hay.documentos === 1 ? 'documento' : 'documentos'}. Alcanza para diagnosticar.`,
  }
}

function tieneAlgo(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  return true
}
