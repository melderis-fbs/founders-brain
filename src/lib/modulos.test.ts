import { describe, expect, it } from 'vitest'
import { HITOS } from './hitos'
import {
  enQueFaseVa, ETAPAS, FASES, faseDeLaSemana, etapasDeLaSemana, HITOS_CLAVE,
  nombreDeEtapa, SEMANAS_DEL_PROGRAMA, SEMANAS_POR_FASE,
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

  it('son catorce etapas, numeradas en orden', () => {
    expect(ETAPAS).toHaveLength(14)
    expect(ETAPAS.map((e) => e.numero)).toEqual([...Array(14).keys()].map((i) => i + 1))
  })

  it('no repiten clave', () => {
    expect(new Set(ETAPAS.map((e) => e.clave)).size).toBe(14)
  })

  it('cada etapa cae adentro de su fase', () => {
    for (const e of ETAPAS) {
      const suya = FASES[e.fase - 1]!
      expect(e.desdeSemana, e.nombre).toBeGreaterThanOrEqual(suya.desdeSemana)
      expect(e.hastaSemana, e.nombre).toBeLessThanOrEqual(suya.hastaSemana)
      expect(e.hastaSemana, e.nombre).toBeGreaterThanOrEqual(e.desdeSemana)
    }
  })

  it('las dieciséis semanas tienen al menos una etapa', () => {
    for (let s = 1; s <= SEMANAS_DEL_PROGRAMA; s++) {
      expect(etapasDeLaSemana(s), `la semana ${s}`).not.toHaveLength(0)
    }
  })

  it('todas las etapas aparecen en alguna semana', () => {
    const vistas = new Set<string>()
    for (let s = 1; s <= SEMANAS_DEL_PROGRAMA; s++) for (const e of etapasDeLaSemana(s)) vistas.add(e.clave)
    expect(vistas.size).toBe(ETAPAS.length)
  })

  it('el nombre lleva su aclaración cuando la tiene', () => {
    expect(nombreDeEtapa(ETAPAS[1]!)).toBe('Identidad (Manual de Transformación 2.0)')
    expect(nombreDeEtapa(ETAPAS[2]!)).toBe('Match de Marca')
  })

  it('en la semana 4 se trabaja la oferta, que es cuando vence su hito', () => {
    const suHito = HITOS.find((h) => h.clave === 'oferta')!
    expect(suHito.semana).toBe(4)
    expect(etapasDeLaSemana(4).map((e) => e.nombre)).toContain('Tu Oferta en Una Página')
  })

  it('fuera del programa no hay etapa', () => {
    expect(etapasDeLaSemana(0)).toEqual([])
    expect(etapasDeLaSemana(17)).toEqual([])
    expect(etapasDeLaSemana(null)).toEqual([])
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
