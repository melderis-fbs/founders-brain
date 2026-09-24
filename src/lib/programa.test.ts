import { describe, expect, it } from 'vitest'
import { cuandoTermina, seLePasoElPrograma, semanaEnLaQueVa, semanasDelPrograma, textoDeSemana } from './programa'

describe('la semana en la que va', () => {
  it('el primer día es la semana 1', () => {
    expect(semanaEnLaQueVa('2025-02-03', new Date('2025-02-03T12:00:00Z'))).toBe(1)
    expect(semanaEnLaQueVa('2025-02-03', new Date('2025-02-09T12:00:00Z'))).toBe(1)
    expect(semanaEnLaQueVa('2025-02-03', new Date('2025-02-10T12:00:00Z'))).toBe(2)
  })

  it('sin fecha de inicio no se inventa una semana', () => {
    expect(semanaEnLaQueVa(null)).toBeNull()
  })

  it('un programa de 4 meses son 16 semanas y uno de 6, 24', () => {
    expect(semanasDelPrograma(4)).toBe(16)
    expect(semanasDelPrograma(6)).toBe(24)
    expect(semanasDelPrograma(null)).toBeNull()
  })

  it('el número siempre viene con su comparación', () => {
    const texto = textoDeSemana('2025-02-03', 4, new Date('2025-09-01T12:00:00Z'))
    expect(texto).toBe('semana 31 de 16')
    expect(seLePasoElPrograma('2025-02-03', 4, new Date('2025-09-01T12:00:00Z'))).toBe(true)
  })

  it('lo dice también cuando falta el dato, en vez de mostrar un número solo', () => {
    expect(textoDeSemana(null, 4)).toBe('sin fecha de inicio')
  })
})

describe('cuándo termina el programa', () => {
  it('si alguien la cargó, manda la cargada', () => {
    expect(cuandoTermina('2026-02-12', 4, '2026-07-01')).toEqual({ fecha: '2026-07-01', calculada: false })
  })

  it('si no, la calcula desde el inicio y lo dice', () => {
    expect(cuandoTermina('2026-02-12', 4)).toEqual({ fecha: '2026-06-12', calculada: true })
  })

  it('cruza el año sin perderse', () => {
    expect(cuandoTermina('2026-11-20', 4)).toEqual({ fecha: '2027-03-20', calculada: true })
  })

  it('sin fecha de inicio no inventa ninguna', () => {
    expect(cuandoTermina(null, 4)).toBeNull()
    expect(cuandoTermina('2026-02-12', null)).toBeNull()
  })
})
