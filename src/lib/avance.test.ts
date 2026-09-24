import { describe, expect, it } from 'vitest'
import { atrasoEnSemanas, avanceDe, etapasEsperadas, filasDeEtapas } from './avance'
import { ETAPAS } from './modulos'

const claves = (cuantas: number) => new Set(ETAPAS.slice(0, cuantas).map((e) => e.clave))

describe('qué etapas ya tendrían que estar', () => {
  it('no cuenta la etapa que está en curso: terminadas, no empezadas', () => {
    // La etapa 1 va de la semana 1 a la 1. En la semana 1 está en curso.
    expect(etapasEsperadas(1)).toBe(0)
    expect(etapasEsperadas(2)).toBe(1)
  })

  it('en la última semana ya pasaron trece de las catorce', () => {
    expect(etapasEsperadas(16)).toBe(ETAPAS.length - 1)
    expect(etapasEsperadas(17)).toBe(ETAPAS.length)
  })

  it('pasado el programa siguen siendo las catorce, no se desborda', () => {
    expect(etapasEsperadas(33)).toBe(ETAPAS.length)
  })

  it('sin semana no espera ninguna', () => {
    expect(etapasEsperadas(null)).toBe(0)
  })
})

describe('dónde está y dónde tendría que estar', () => {
  it('sin fecha de inicio no compara: lo dice en vez de inventar un estado', () => {
    const a = avanceDe(null, claves(4))
    expect(a.estado).toBe('sin_fecha')
    expect(a.titular).toContain('sin fecha de inicio')
  })

  it('cero etapas marcadas NO es cero avance: es que nadie marcó (regla 1)', () => {
    const a = avanceDe(10, new Set())
    expect(a.estado).toBe('sin_marcar')
    expect(a.titular).toContain('nadie las marcó')
    expect(a.atraso).toBeGreaterThan(0)   // el atraso se calcula igual, pero no manda
  })

  it('en la semana 1, sin nada marcado, no está atrasado: todavía no le pedían nada', () => {
    const a = avanceDe(1, new Set())
    expect(a.estado).toBe('al_dia')
    expect(a.esperadas).toBe(0)
  })

  it('con las que le corresponden va a término', () => {
    const a = avanceDe(5, claves(etapasEsperadas(5)))
    expect(a.estado).toBe('al_dia')
    expect(a.palabra).toBe('a término')
    expect(a.atraso).toBe(0)
  })

  it('con más de las que le corresponden va adelantado, y el atraso no es negativo', () => {
    const a = avanceDe(5, claves(etapasEsperadas(5) + 3))
    expect(a.estado).toBe('al_dia')
    expect(a.palabra).toBe('adelantado')
    expect(a.atraso).toBe(0)
  })

  it('dos etapas de menos es atrasado; tres es grave', () => {
    const semana = 10
    const debe = etapasEsperadas(semana)
    expect(avanceDe(semana, claves(debe - 1)).palabra).toBe('atrasado')
    expect(avanceDe(semana, claves(debe - 2)).palabra).toBe('atrasado')
    expect(avanceDe(semana, claves(debe - 3)).palabra).toBe('grave')
  })

  it('el titular dice los dos números, no un porcentaje suelto', () => {
    const a = avanceDe(10, claves(etapasEsperadas(10) - 2))
    expect(a.titular).toContain(`${a.hechas} de las ${a.esperadas}`)
    expect(a.titular).toContain('le faltan 2')
  })

  it('los porcentajes son sobre catorce, como los de la planilla', () => {
    expect(avanceDe(20, claves(14)).porReal).toBe(100)
    expect(avanceDe(20, claves(7)).porReal).toBe(50)
    expect(avanceDe(20, claves(0)).porEsperado).toBe(100)
  })

  it('una etapa marcada que no es del programa no cuenta', () => {
    const a = avanceDe(5, new Set(['etapa_inventada', 'otra_mas']))
    expect(a.hechas).toBe(0)
    expect(a.estado).toBe('sin_marcar')
  })
})

describe('el atraso dicho en semanas, que es como habla el equipo', () => {
  it('no lo dice cuando no hay con qué compararlo', () => {
    expect(atrasoEnSemanas(avanceDe(null, new Set()))).toBeNull()
    expect(atrasoEnSemanas(avanceDe(10, new Set()))).toBeNull()
  })

  it('al día son cero semanas', () => {
    expect(atrasoEnSemanas(avanceDe(5, claves(etapasEsperadas(5))))).toBe(0)
  })

  it('tres etapas de atraso son tres semanas largas de programa', () => {
    const a = avanceDe(10, claves(etapasEsperadas(10) - 3))
    expect(atrasoEnSemanas(a)).toBe(3)
  })
})

describe('las catorce etapas, una por una', () => {
  it('sin marcar y con la semana pasada es la que hay que mirar', () => {
    const filas = filasDeEtapas(10, new Set())
    expect(filas[0]!.estado).toBe('debia_estar')          // semana 1, ya pasó
    expect(filas[0]!.porque).toContain('no está marcada')
    expect(filas[13]!.estado).toBe('todavia_no')          // semana 16, falta
  })

  it('marcada gana sobre el calendario: adelantarse no es un error', () => {
    const filas = filasDeEtapas(2, new Set([ETAPAS[13]!.clave]))
    expect(filas[13]!.estado).toBe('hecha')
    expect(filas[13]!.hecha).toBe(true)
  })

  it('la de esta semana no es ni «ya pasó» ni «todavía no»', () => {
    const filas = filasDeEtapas(3, new Set())
    expect(filas[2]!.estado).toBe('es_la_de_ahora')       // Match de Marca, semana 3
  })

  it('sin fecha de inicio ninguna queda en rojo', () => {
    const filas = filasDeEtapas(null, new Set())
    expect(filas.every((f) => f.estado === 'todavia_no')).toBe(true)
  })

  it('marca cuál eligió la consultora a mano, sin pisar el resto', () => {
    const filas = filasDeEtapas(10, new Set(), ETAPAS[4]!.nombre)
    expect(filas[4]!.elegida).toBe(true)
    expect(filas[4]!.estado).toBe('debia_estar')          // sigue diciendo que falta
    expect(filas.filter((f) => f.elegida)).toHaveLength(1)
  })
})
