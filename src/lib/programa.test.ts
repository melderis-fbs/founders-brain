import { describe, expect, it } from 'vitest'
import { seLePasoElPrograma, semanaEnLaQueVa, semanasDelPrograma, textoDeSemana } from './programa'

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
