/**
 * Aritmética del programa. Restas de fechas, nada más: no cuesta nada y por eso
 * corre siempre.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Cuántas semanas dura el programa.
 *
 * Cuatro semanas por mes, que es como se cuenta en Founders: un programa de 4
 * meses son 16 semanas y uno de 6, 24. No es el promedio del calendario
 * (30,44 días), es la cuenta con la que trabaja el equipo.
 */
export function semanasDelPrograma(meses: number | null | undefined): number | null {
  if (meses === null || meses === undefined || !Number.isFinite(meses) || meses <= 0) return null
  return Math.round(meses * 4)
}

/** En qué semana del programa va hoy. El primer día es la semana 1. */
export function semanaEnLaQueVa(fechaInicio: string | null | undefined, hoy: Date = new Date()): number | null {
  if (!fechaInicio) return null
  const partes = fechaInicio.slice(0, 10).split('-').map(Number)
  if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return null
  const inicio = Date.UTC(partes[0], partes[1] - 1, partes[2])
  const ahora = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())
  const dias = Math.floor((ahora - inicio) / MS_POR_DIA)
  if (dias < 0) return 0 // todavía no arrancó
  return Math.floor(dias / 7) + 1
}

/**
 * EL PLAZO DE UN CLIENTE: de cuándo a cuándo va su programa.
 *
 * Son dos datos que pueden decir cosas distintas, y hasta acá la aplicación
 * miraba uno solo. Una clienta que empezó el 09/10/2025 con fin previsto el
 * 21/10/2027 —dos años— tenía cargado «12 meses» en cuánto dura, y el tablero
 * hacía la cuenta con los meses: «semana 51 de 48, ya se pasó del programa».
 * Estaba a mitad de camino.
 */
export type Plazo = {
  inicio: string | null | undefined
  meses: number | null | undefined
  /** La fecha de fin que escribió una persona. Si está, manda. */
  finPrevisto?: string | null
}

/**
 * Cuántas semanas dura, de verdad.
 *
 * Si alguien escribió la fecha de fin, sale de las fechas. Es la regla 9: lo
 * que escribió una persona no lo pisa un cálculo automático, y «12 meses» es
 * casi siempre el default del contrato, no lo que se acordó con este cliente.
 */
export function semanasQueDura(plazo: Plazo): number | null {
  const porFechas = semanasEntre(plazo.inicio, plazo.finPrevisto)
  return porFechas ?? semanasDelPrograma(plazo.meses)
}

function semanasEntre(desde: string | null | undefined, hasta: string | null | undefined): number | null {
  if (!desde || !hasta) return null
  const a = Date.parse(`${String(desde).slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${String(hasta).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  const semanas = Math.round((b - a) / (7 * MS_POR_DIA))
  // Una fecha de fin anterior a la de inicio es un dato mal cargado, no un
  // programa de duración negativa: no se usa, y se avisa aparte.
  return semanas > 0 ? semanas : null
}

/** El texto de la semana, siempre con su comparación: «semana 31 de 17». */
export function textoDeSemana(plazo: Plazo, hoy?: Date): string {
  const semana = semanaEnLaQueVa(plazo.inicio, hoy)
  const total = semanasQueDura(plazo)
  if (semana === null) return 'sin fecha de inicio'
  if (semana === 0) return 'todavía no arrancó'
  if (total === null) return `semana ${semana}`
  return `semana ${semana} de ${total}`
}

export function seLePasoElPrograma(plazo: Plazo, hoy?: Date): boolean {
  const semana = semanaEnLaQueVa(plazo.inicio, hoy)
  const total = semanasQueDura(plazo)
  if (semana === null || total === null) return false
  return semana > total
}

/**
 * Cuando los dos datos del plazo no dicen lo mismo.
 *
 * No se elige en silencio: manda la fecha de fin, y se dice que los meses
 * cargados no cierran con ella para que alguien corrija el que esté mal. Elegir
 * callado es cómo se llegó a «semana 51 de 48» sin que nadie pudiera ver por
 * qué.
 */
export function desajusteDePlazo(plazo: Plazo): string | null {
  const porFechas = semanasEntre(plazo.inicio, plazo.finPrevisto)
  const porMeses = semanasDelPrograma(plazo.meses)
  if (porFechas === null || porMeses === null) return null
  if (Math.abs(porFechas - porMeses) <= 2) return null

  const mesesDeLasFechas = Math.round((porFechas / 4) * 10) / 10
  return `«Cuánto dura» dice ${plazo.meses} meses, pero entre el inicio y el fin previsto hay ` +
    `${porFechas} semanas, que son unos ${mesesDeLasFechas} meses. Se usa la fecha de fin; ` +
    'corregí el que esté mal.'
}

/**
 * Cuándo termina el programa.
 *
 * La fecha de fin no está cargada en NINGÚN cliente de la cartera, pero se
 * sabe: es la de inicio más los meses del programa. Así que se muestra la
 * cargada si alguien la escribió, y si no la calculada — diciendo que es
 * calculada. Un dato que dice de dónde salió se puede discutir; uno que se
 * hace pasar por cargado, no.
 */
export function cuandoTermina(
  fechaInicio: string | null | undefined,
  meses: number | null | undefined,
  cargada?: string | null,
): { fecha: string; calculada: boolean } | null {
  if (cargada) return { fecha: String(cargada).slice(0, 10), calculada: false }
  if (!fechaInicio || !meses) return null

  const inicio = new Date(`${String(fechaInicio).slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(inicio.getTime())) return null

  const fin = new Date(inicio)
  fin.setUTCMonth(fin.getUTCMonth() + meses)
  return { fecha: fin.toISOString().slice(0, 10), calculada: true }
}

/**
 * El plazo de un cliente de la lista, en un solo lugar.
 *
 * Existe para que ninguna pantalla vuelva a hacer la cuenta con los meses
 * olvidándose de la fecha de fin: el que tenga los tres datos arma el plazo con
 * esto y no piensa más en el tema.
 */
export function plazoDe(c: { fechaInicio: string | null; programaMeses: number | null; finPrevisto?: string | null }): Plazo {
  return { inicio: c.fechaInicio, meses: c.programaMeses, finPrevisto: c.finPrevisto ?? null }
}
