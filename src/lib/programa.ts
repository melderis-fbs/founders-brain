/**
 * Aritmética del programa. Restas de fechas, nada más: no cuesta nada y por eso
 * corre siempre.
 */

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Un programa de 4 meses son 17 semanas; uno de 6, 26. */
export function semanasDelPrograma(meses: number | null | undefined): number | null {
  if (meses === null || meses === undefined || !Number.isFinite(meses) || meses <= 0) return null
  return Math.round((meses * 30.44) / 7)
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

/** El texto de la semana, siempre con su comparación: «semana 31 de 17». */
export function textoDeSemana(fechaInicio: string | null | undefined, meses: number | null | undefined, hoy?: Date): string {
  const semana = semanaEnLaQueVa(fechaInicio, hoy)
  const total = semanasDelPrograma(meses)
  if (semana === null) return 'sin fecha de inicio'
  if (semana === 0) return 'todavía no arrancó'
  if (total === null) return `semana ${semana}`
  return `semana ${semana} de ${total}`
}

export function seLePasoElPrograma(fechaInicio: string | null | undefined, meses: number | null | undefined, hoy?: Date): boolean {
  const semana = semanaEnLaQueVa(fechaInicio, hoy)
  const total = semanasDelPrograma(meses)
  if (semana === null || total === null) return false
  return semana > total
}
