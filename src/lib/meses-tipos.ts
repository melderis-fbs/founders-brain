/**
 * Los tipos y las cuentas de los meses, sin base de datos al lado.
 *
 * Vive separado de `meses.ts` porque la pantalla es un componente de cliente: si
 * importara el módulo que habla con Postgres, `pg` se iría al navegador y el
 * build se cae con «Can't resolve 'fs'». Ya pasó con las sesiones y con las
 * banderas; es el mismo corte.
 */

export type MesDelCliente = {
  id: number
  anio: number
  mes: number
  ventas: number | null
  ticket: number | null
  facturacion: number | null
  nota: string | null
  quien: string | null
}

export const NOMBRE_DEL_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const

export function comoSeLlamaElMes(anio: number, mes: number): string {
  return `${NOMBRE_DEL_MES[mes - 1] ?? mes} ${anio}`
}

export type Totales = {
  meses: number
  ventas: number | null
  facturacion: number | null
  /** Promedio sobre los meses que tienen el dato, no sobre todos. */
  ticketPromedio: number | null
  /** Facturación dividida por ventas: el ticket que salió de verdad. */
  ticketReal: number | null
  mejor: MesDelCliente | null
  peor: MesDelCliente | null
}

function sumar(valores: (number | null)[]): number | null {
  const hay = valores.filter((v): v is number => v !== null)
  return hay.length === 0 ? null : hay.reduce((a, b) => a + b, 0)
}

/**
 * Los totales, sin inventar ceros.
 *
 * Un mes sin cargar no suma cero: no suma. Si ningún mes tiene facturación, el
 * total es null y la pantalla dice «—», no «$0». La diferencia importa: cero
 * pesos es un cliente que no vendió, y sin cargar es un cliente del que no
 * sabemos.
 */
export function totalesDe(meses: readonly MesDelCliente[]): Totales {
  const ventas = sumar(meses.map((m) => m.ventas))
  const facturacion = sumar(meses.map((m) => m.facturacion))
  const conTicket = meses.filter((m) => m.ticket !== null)
  const conFacturacion = meses.filter((m) => m.facturacion !== null)

  const ordenados = [...conFacturacion].sort((a, b) => (b.facturacion ?? 0) - (a.facturacion ?? 0))

  return {
    meses: meses.length,
    ventas,
    facturacion,
    ticketPromedio: conTicket.length === 0
      ? null
      : Math.round(conTicket.reduce((a, m) => a + (m.ticket ?? 0), 0) / conTicket.length),
    ticketReal: facturacion !== null && ventas !== null && ventas > 0
      ? Math.round(facturacion / ventas)
      : null,
    mejor: ordenados[0] ?? null,
    peor: ordenados.length > 1 ? ordenados[ordenados.length - 1]! : null,
  }
}
