import { describe, expect, it } from 'vitest'
import { etapasHechasDe, todoLoMarcado, type HechoPorCliente } from './hitos-clave'
import { avanceDe, etapaHecha } from './avance'
import { ETAPAS } from './modulos'

const marca = (): HechoPorCliente => ({ clave: '', hecho_en: '2026-03-01', quien: 'Camila' })

function guardado(...claves: string[]): Map<string, HechoPorCliente> {
  return new Map(claves.map((c) => [c, { ...marca(), clave: c }]))
}

describe('lo que se le pasa al cálculo del avance', () => {
  /**
   * Este test existe por un bug real: al cálculo se le pasaban sólo las etapas
   * marcadas, así que tildar «Primera venta» guardaba bien en la base y no
   * movía el avance ni un punto.
   */
  it('junta las etapas y los hitos, todo sin prefijo', () => {
    const todo = todoLoMarcado(guardado('etapa:identidad', 'primera_venta', 'segunda_venta'))
    expect([...todo].sort()).toEqual(['identidad', 'primera_venta', 'segunda_venta'])
  })

  it('con eso, marcar los hitos de una etapa la da por hecha', () => {
    const ventas = ETAPAS.find((e) => e.clave === 'ventas_y_cierre')!
    const hechos = guardado(...ventas.hitosClave.map((h) => h.clave))

    expect(etapaHecha(ventas, todoLoMarcado(hechos))).toBe(true)
    expect(avanceDe(12, todoLoMarcado(hechos)).hechas).toBe(1)

    // Y lo que se le pasaba antes, que era el bug:
    expect(etapaHecha(ventas, etapasHechasDe(hechos))).toBe(false)
  })

  it('las etapas solas siguen saliendo con su propia función', () => {
    const solo = etapasHechasDe(guardado('etapa:identidad', 'primera_venta'))
    expect([...solo]).toEqual(['identidad'])
  })

  it('sin nada marcado no devuelve nada', () => {
    expect(todoLoMarcado(new Map()).size).toBe(0)
  })
})
