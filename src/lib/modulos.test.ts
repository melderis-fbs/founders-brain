import { describe, expect, it } from 'vitest'
import { HITOS } from './hitos'
import { enQueModuloVa, MODULOS, moduloDe, nombreCompleto } from './modulos'

describe('los módulos del programa', () => {
  it('están en orden y sin saltear ni repetir semanas', () => {
    expect(MODULOS.map((m) => m.semana)).toEqual([...MODULOS.keys()].map((i) => i + 1))
  })

  it('entran en un programa de 16 semanas', () => {
    expect(MODULOS[MODULOS.length - 1]!.semana).toBeLessThanOrEqual(16)
  })

  it('el nombre lleva su aclaración cuando la tiene', () => {
    expect(nombreCompleto(moduloDe(2)!)).toBe('Identidad (Manual de Transformación 2.0)')
    expect(nombreCompleto(moduloDe(3)!)).toBe('Match de Marca')
  })

  it('una semana sin módulo no devuelve cualquier cosa', () => {
    expect(moduloDe(15)).toBeNull()
    expect(moduloDe(null)).toBeNull()
  })

  it('sin fecha de inicio dice por qué, en vez de quedar en blanco', () => {
    expect(enQueModuloVa(null).porque).toContain('sin fecha de inicio')
    expect(enQueModuloVa(0).porque).toContain('todavía no arrancó')
  })

  it('pasado el último módulo lo dice: el programa sigue', () => {
    const r = enQueModuloVa(31)
    expect(r.modulo).toBeNull()
    expect(r.porque).toContain('ya pasó el último módulo')
  })

  it('los hitos caen dentro del tramo que cubren los módulos', () => {
    // Si un hito vence después del último módulo, o la lista de módulos está
    // incompleta, o ese hito se exige sin haberlo trabajado nunca.
    const ultimo = MODULOS[MODULOS.length - 1]!.semana
    const tarde = HITOS.filter((h) => h.semana > ultimo).map((h) => `${h.etiqueta} (semana ${h.semana})`)
    expect(tarde).toEqual([])
  })
})
