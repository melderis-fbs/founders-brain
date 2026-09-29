import { describe, expect, it } from 'vitest'
import { comoSeLlamaElMes, totalesDe, type MesDelCliente } from './meses-tipos'

const mes = (m: Partial<MesDelCliente> & { mes: number }): MesDelCliente => ({
  id: m.mes, anio: 2026, ventas: null, ticket: null, facturacion: null, nota: null, quien: null, ...m,
})

describe('los totales de los meses', () => {
  it('suma ventas y facturación', () => {
    const t = totalesDe([
      mes({ mes: 1, ventas: 2, facturacion: 3000000 }),
      mes({ mes: 2, ventas: 3, facturacion: 4500000 }),
    ])
    expect(t.ventas).toBe(5)
    expect(t.facturacion).toBe(7500000)
    expect(t.meses).toBe(2)
  })

  it('un mes sin cargar NO suma cero: no suma (regla 1)', () => {
    const t = totalesDe([
      mes({ mes: 1, ventas: 2, facturacion: 3000000 }),
      mes({ mes: 2 }),                                    // cargado el mes, sin números
    ])
    expect(t.ventas).toBe(2)
    expect(t.facturacion).toBe(3000000)
  })

  it('sin ningún dato el total es nulo, no cero', () => {
    const t = totalesDe([mes({ mes: 1 }), mes({ mes: 2 })])
    expect(t.facturacion).toBeNull()
    expect(t.ventas).toBeNull()
    expect(t.ticketPromedio).toBeNull()
  })

  it('el ticket promedio sale de los meses que lo tienen, no de todos', () => {
    const t = totalesDe([
      mes({ mes: 1, ticket: 1000000 }),
      mes({ mes: 2, ticket: 2000000 }),
      mes({ mes: 3 }),                                    // éste no baja el promedio
    ])
    expect(t.ticketPromedio).toBe(1500000)
  })

  it('el ticket real sale de dividir lo facturado por las ventas', () => {
    const t = totalesDe([
      mes({ mes: 1, ventas: 2, facturacion: 3000000 }),
      mes({ mes: 2, ventas: 1, facturacion: 1800000 }),
    ])
    expect(t.ticketReal).toBe(1600000)                    // 4.800.000 / 3
  })

  it('sin ventas no divide por cero', () => {
    expect(totalesDe([mes({ mes: 1, ventas: 0, facturacion: 0 })]).ticketReal).toBeNull()
  })

  it('dice cuál fue el mejor mes y cuál el peor', () => {
    const t = totalesDe([
      mes({ mes: 1, facturacion: 3000000 }),
      mes({ mes: 2, facturacion: 8000000 }),
      mes({ mes: 3, facturacion: 1000000 }),
    ])
    expect(t.mejor!.mes).toBe(2)
    expect(t.peor!.mes).toBe(3)
  })

  it('con un solo mes no hay mejor y peor: es el mismo', () => {
    const t = totalesDe([mes({ mes: 5, facturacion: 3000000 })])
    expect(t.mejor!.mes).toBe(5)
    expect(t.peor).toBeNull()
  })
})

describe('cómo se nombra un mes', () => {
  it('con su nombre y su año', () => {
    expect(comoSeLlamaElMes(2026, 1)).toBe('enero 2026')
    expect(comoSeLlamaElMes(2026, 12)).toBe('diciembre 2026')
  })
})
