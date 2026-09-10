import { describe, expect, it } from 'vitest'
import { evaluarHitos, fuentesConDatos } from './hitos'
import { columnaDe, semaforoDe } from './semaforo'

const CARTERA = fuentesConDatos({ algunClienteConDatosDeFicha: true, algunOnboardingCargado: true })
const SIN_DOCS = new Set<string>()

const evaluar = (semana: number | null, valores: Record<string, unknown> = {}, docs = SIN_DOCS) =>
  evaluarHitos({ semana, valores, tiposDeDocumento: docs, conDatos: CARTERA })

const AL_DIA = {
  fecha_cuenta_inversa: '2026-01-05', meta_mensual: 1, ticket: 1,
  cliente_ideal: 'x', problema: 'y', oferta: 'z', promesa: 'w', mensaje: 'm', canal: 'c',
}

describe('el semáforo', () => {
  it('gris no es verde: sin datos no se pinta de en tiempo', () => {
    const s = semaforoDe(evaluar(null, {}))
    expect(s.color).toBe('gris')
    expect(s.palabra).toBe('sin datos')
    expect(s.porque).toContain('fecha de inicio')
  })

  it('verde cuando no hay nada vencido de lo que se puede medir', () => {
    const s = semaforoDe(evaluar(6, AL_DIA, new Set(['onboarding'])))
    expect(s.color).toBe('verde')
    expect(s.palabra).toBe('en tiempo')
    expect(s.etapa).toBeNull()
  })

  it('amarillo cuando hay un atraso chico que no bloquea', () => {
    const s = semaforoDe(evaluar(6, { ...AL_DIA, mensaje: '', canal: '' }, new Set(['onboarding'])))
    expect(s.color).toBe('amarillo')
    expect(s.palabra).toBe('atrasado')
    expect(s.porque).toContain('1 semana')
    expect(s.etapa).toBe('mensaje')
  })

  it('rojo cuando lo vencido bloquea lo que viene después', () => {
    const s = semaforoDe(evaluar(6, { ...AL_DIA, oferta: '', promesa: '' }, new Set(['onboarding'])))
    expect(s.color).toBe('rojo')
    expect(s.palabra).toBe('grave')
    expect(s.porque).toContain('bloquea')
    expect(s.etapa).toBe('definicion')
  })

  it('rojo también cuando el atraso ya es largo, aunque no bloquee', () => {
    const s = semaforoDe(evaluar(12, { ...AL_DIA, mensaje: '', canal: '' }, new Set(['onboarding'])))
    expect(s.color).toBe('rojo')
    expect(s.porque).toContain('7 semanas')
  })

  it('cada color viene con una frase que lo explica, siempre', () => {
    for (const evaluados of [evaluar(null), evaluar(6, AL_DIA, new Set(['onboarding'])), evaluar(12, {}, new Set(['onboarding']))]) {
      const s = semaforoDe(evaluados)
      expect(s.porque.length).toBeGreaterThan(20)
      expect(s.palabra).not.toBe('')
    }
  })

  it('la columna del kanban sale del semáforo', () => {
    expect(columnaDe(semaforoDe(evaluar(null)))).toBe('sin_datos')
    expect(columnaDe(semaforoDe(evaluar(6, AL_DIA, new Set(['onboarding']))))).toBe('al_dia')
    expect(columnaDe(semaforoDe(evaluar(12, {}, new Set(['onboarding']))))).toBe('definicion')
  })
})
