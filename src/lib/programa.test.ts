import { describe, expect, it } from 'vitest'
import {
  cuandoTermina, desajusteDePlazo, semanaEnLaQueVa, semanasDelPrograma, semanasQueDura,
  seLePasoElPrograma, textoDeSemana,
} from './programa'

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
    const plazo = { inicio: '2025-02-03', meses: 4 }
    expect(textoDeSemana(plazo, new Date('2025-09-01T12:00:00Z'))).toBe('semana 31 de 16')
    expect(seLePasoElPrograma(plazo, new Date('2025-09-01T12:00:00Z'))).toBe(true)
  })

  it('lo dice también cuando falta el dato, en vez de mostrar un número solo', () => {
    expect(textoDeSemana({ inicio: null, meses: 4 })).toBe('sin fecha de inicio')
  })
})

/**
 * EL CASO QUE LO ROMPÍA.
 *
 * Una clienta empezó el 09/10/2025 con fin previsto el 21/10/2027 —dos años— y
 * tenía cargado «12 meses» en cuánto dura. La aplicación hacía la cuenta con
 * los meses y mostraba «semana 51 de 48, ya se pasó del programa». Estaba a
 * mitad de camino.
 */
describe('cuánto dura, cuando los dos datos no dicen lo mismo', () => {
  const real = { inicio: '2025-10-09', meses: 12, finPrevisto: '2027-10-21' }

  it('manda la fecha de fin que escribió una persona, no los meses', () => {
    expect(semanasQueDura(real)).toBe(106)
    expect(semanasQueDura({ inicio: '2025-10-09', meses: 12 })).toBe(48)
  })

  it('con el fin previsto cargado, esa clienta ya no aparece pasada del programa', () => {
    const hoy = new Date('2026-09-30T12:00:00Z')
    expect(seLePasoElPrograma(real, hoy)).toBe(false)
    expect(textoDeSemana(real, hoy)).toBe('semana 51 de 106')

    // Sin la fecha de fin, con los meses solos, es como salía antes.
    const soloMeses = { inicio: '2025-10-09', meses: 12 }
    expect(seLePasoElPrograma(soloMeses, hoy)).toBe(true)
  })

  // No se elige en silencio: elegir callado es cómo se llegó a «semana 51 de 48».
  it('dice que los dos datos no cierran, con los dos números', () => {
    const dice = desajusteDePlazo(real)!
    expect(dice).toContain('12 meses')
    expect(dice).toContain('106 semanas')
  })

  it('si cierran, no dice nada', () => {
    expect(desajusteDePlazo({ inicio: '2025-02-03', meses: 4, finPrevisto: '2025-06-03' })).toBeNull()
  })

  // Un fin anterior al inicio es un dato mal cargado, no un programa negativo.
  it('una fecha de fin anterior al inicio no se usa', () => {
    expect(semanasQueDura({ inicio: '2025-10-09', meses: 12, finPrevisto: '2024-01-01' })).toBe(48)
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
