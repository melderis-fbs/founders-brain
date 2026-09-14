import { describe, expect, it } from 'vitest'
import { HITOS } from './hitos'
import {
  enQueFaseVa, FASES, faseDeLaSemana, HITOS_CLAVE, modulosDeLaSemana,
  SEMANAS_DEL_PROGRAMA, SEMANAS_POR_FASE,
} from './modulos'

describe('el programa: cuatro fases de cuatro semanas', () => {
  it('son cuatro, numeradas en orden', () => {
    expect(FASES.map((f) => f.numero)).toEqual([1, 2, 3, 4])
  })

  it('cada fase dura cuatro semanas y el programa son dieciséis', () => {
    for (const f of FASES) expect(f.hastaSemana - f.desdeSemana + 1).toBe(SEMANAS_POR_FASE)
    expect(SEMANAS_DEL_PROGRAMA).toBe(16)
  })

  it('las fases se tocan sin huecos ni superposiciones', () => {
    expect(FASES[0]!.desdeSemana).toBe(1)
    for (let i = 1; i < FASES.length; i++) {
      expect(FASES[i]!.desdeSemana).toBe(FASES[i - 1]!.hastaSemana + 1)
    }
  })

  it('cada semana del programa cae en una fase y sólo en una', () => {
    for (let semana = 1; semana <= SEMANAS_DEL_PROGRAMA; semana++) {
      const caen = FASES.filter((f) => semana >= f.desdeSemana && semana <= f.hastaSemana)
      expect(caen, `la semana ${semana}`).toHaveLength(1)
    }
  })

  it('los hitos clave no repiten clave', () => {
    const claves = HITOS_CLAVE.map((h) => h.clave)
    expect(new Set(claves).size).toBe(claves.length)
  })

  it('cada fase empieza donde le toca', () => {
    expect(faseDeLaSemana(1)!.numero).toBe(1)
    expect(faseDeLaSemana(4)!.numero).toBe(1)
    expect(faseDeLaSemana(5)!.numero).toBe(2)
    expect(faseDeLaSemana(8)!.numero).toBe(2)
    expect(faseDeLaSemana(9)!.numero).toBe(3)
    expect(faseDeLaSemana(12)!.numero).toBe(3)
    expect(faseDeLaSemana(13)!.numero).toBe(4)
    expect(faseDeLaSemana(16)!.numero).toBe(4)
  })

  it('pasada la semana 16 lo dice, en vez de quedar en blanco', () => {
    expect(faseDeLaSemana(17)).toBeNull()
    expect(enQueFaseVa(17).porque).toContain('ya pasó la semana 16')
    expect(enQueFaseVa(null).porque).toContain('sin fecha de inicio')
    expect(enQueFaseVa(0).porque).toContain('todavía no arrancó')
  })

  it('todos los módulos de una fase aparecen en alguna de sus semanas', () => {
    for (const fase of FASES) {
      const repartidos = []
      for (let s = fase.desdeSemana; s <= fase.hastaSemana; s++) repartidos.push(...modulosDeLaSemana(s))
      expect(repartidos.sort()).toEqual([...fase.modulos].sort())
    }
  })

  it('la fase 1 tiene cinco módulos en cuatro semanas: la doble es la última', () => {
    expect(FASES[0]!.modulos).toHaveLength(5)
    expect(modulosDeLaSemana(1)).toEqual(['Onboarding y Diagnóstico'])
    expect(modulosDeLaSemana(4)).toEqual(['Promesa y Pilares', 'Tu Oferta en Una Página'])
    expect([1, 2, 3, 4].flatMap((s) => modulosDeLaSemana(s))).toHaveLength(5)
  })

  it('en la semana 4 se trabaja la oferta, que es cuando vence su hito', () => {
    const suHito = HITOS.find((h) => h.clave === 'oferta')!
    expect(suHito.semana).toBe(4)
    expect(modulosDeLaSemana(suHito.semana)).toContain('Tu Oferta en Una Página')
  })

  it('fuera del programa no hay módulo', () => {
    expect(modulosDeLaSemana(0)).toEqual([])
    expect(modulosDeLaSemana(17)).toEqual([])
    expect(modulosDeLaSemana(null)).toEqual([])
  })

  it('los hitos de la comparación caen dentro del programa', () => {
    const tarde = HITOS.filter((h) => h.semana > SEMANAS_DEL_PROGRAMA).map((h) => h.etiqueta)
    expect(tarde).toEqual([])
  })
})

describe('las columnas de la grilla', () => {
  it('son las dieciséis semanas, no sólo las que vencen algo', async () => {
    const { SEMANAS_CON_HITOS } = await import('./grilla')
    expect(SEMANAS_CON_HITOS).toEqual([...Array(16).keys()].map((i) => i + 1))
  })

  it('toda semana con hito sigue estando', async () => {
    const { SEMANAS_CON_HITOS } = await import('./grilla')
    for (const h of HITOS) expect(SEMANAS_CON_HITOS).toContain(h.semana)
  })
})
