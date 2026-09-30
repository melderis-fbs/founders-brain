import { describe, expect, it } from 'vitest'
import { atrasoEnSemanas, laQueQuedoAtras, senalesDeGrave, type LoQuePasa } from './riesgo'
import { ETAPAS } from './modulos'
import type { HitoEvaluado } from './hitos'

const claves = (cuantas: number) => new Set(ETAPAS.slice(0, cuantas).map((e) => e.clave))
const todasMenos = (...sacar: string[]) =>
  new Set(ETAPAS.filter((e) => !sacar.includes(e.clave)).map((e) => e.clave))

const SIN_HITOS: HitoEvaluado[] = []
const base = (lo: Partial<LoQuePasa>): LoQuePasa => ({
  semana: 12, marcadas: new Set(), hitos: SIN_HITOS, bandera: null, ...lo,
})

describe('el atraso se mide en semanas, no en etapas sin marcar', () => {
  /**
   * La diferencia que hace que la cuenta sirva. Contar cosas mide
   * desprolijidad; contar semanas mide riesgo.
   */
  it('tres etapas que vencían todas hace poco son POCAS semanas de atraso', () => {
    // En la semana 8 ya vencieron las siete primeras. Tiene seis: le faltan
    // la 6 y la 7, que vencían en las semanas 6 y 7.
    const atraso = atrasoEnSemanas(8, claves(5))
    expect(atraso).toBe(2)   // la más vieja sin hacer vencía en la semana 6
  })

  it('UNA sola etapa vieja sin hacer son MUCHAS semanas de atraso', () => {
    // Tiene todo menos la etapa 2, que vencía en la semana 2. Va por la 12.
    const atraso = atrasoEnSemanas(12, todasMenos('identidad'))
    expect(atraso).toBe(10)
  })

  it('las dos situaciones anteriores tienen la misma cantidad de etapas que la otra… y distinto riesgo', () => {
    const muchasRecientes = atrasoEnSemanas(8, claves(5))!      // 2 etapas faltando
    const unaVieja = atrasoEnSemanas(12, todasMenos('identidad'))!  // 1 etapa faltando
    expect(unaVieja).toBeGreaterThan(muchasRecientes)
  })

  it('al día son cero semanas de atraso', () => {
    expect(atrasoEnSemanas(4, claves(3))).toBe(0)
  })

  it('sin fecha de inicio no hay atraso que medir', () => {
    expect(atrasoEnSemanas(null, new Set())).toBeNull()
  })

  it('nombra la etapa que quedó atrás, para poder decirla', () => {
    const quedo = laQueQuedoAtras(12, todasMenos('identidad'))
    expect(quedo?.nombre).toBe('Identidad')
  })
})

describe('las cinco señales de grave', () => {
  it('una red flag alcanza sola, y dice hace cuánto', () => {
    const s = senalesDeGrave(base({ bandera: 'roja', banderaDesdeHaceSemanas: 5, marcadas: claves(14) }))
    expect(s).toHaveLength(1)
    expect(s[0]!.clave).toBe('red_flag')
    expect(s[0]!.dice).toContain('5 semanas')
  })

  it('una bandera naranja NO es grave por sí sola', () => {
    expect(senalesDeGrave(base({ bandera: 'naranja', marcadas: claves(14) }))).toHaveLength(0)
  })

  it('una queja en una sesión alcanza sola', () => {
    const s = senalesDeGrave(base({ quejaEnSesiones: true, marcadas: claves(14) }))
    expect(s[0]!.clave).toBe('queja')
  })

  it('una queja en la encuesta alcanza sola', () => {
    const s = senalesDeGrave(base({ quejaEnEncuestas: true, marcadas: claves(14) }))
    expect(s[0]!.clave).toBe('encuesta')
  })

  it('no haber vendido pasada la semana 9 alcanza solo, y dice hace cuánto', () => {
    const hitos = [{ hito: { clave: 'primera_venta' }, estado: 'falta', atrasoEnSemanas: 3 }] as unknown as HitoEvaluado[]
    const s = senalesDeGrave(base({ semana: 12, hitos, marcadas: claves(14) }))
    expect(s[0]!.clave).toBe('sin_venta')
    expect(s[0]!.dice).toContain('3 semanas')
  })

  it('antes de la semana de la venta, no haber vendido no es grave', () => {
    const hitos = [{ hito: { clave: 'primera_venta' }, estado: 'falta', atrasoEnSemanas: 0 }] as unknown as HitoEvaluado[]
    expect(senalesDeGrave(base({ semana: 8, hitos, marcadas: claves(14) }))).toHaveLength(0)
  })

  it('tres semanas de atraso alcanzan solas; dos no', () => {
    // La etapa 5 vencía en la semana 4. En la semana 7 son 3 semanas de atraso.
    expect(senalesDeGrave(base({ semana: 7, marcadas: claves(4) }))).toHaveLength(1)
    expect(senalesDeGrave(base({ semana: 6, marcadas: claves(4) }))).toHaveLength(0)
  })

  it('cuando hay varias, se nombran todas: un color sin motivo no sirve', () => {
    const hitos = [{ hito: { clave: 'primera_venta' }, estado: 'falta', atrasoEnSemanas: 3 }] as unknown as HitoEvaluado[]
    const s = senalesDeGrave(base({ semana: 12, hitos, bandera: 'roja', quejaEnEncuestas: true, marcadas: claves(4) }))
    expect(s.map((x) => x.clave).sort()).toEqual(['atraso', 'encuesta', 'red_flag', 'sin_venta'])
    for (const una of s) expect(una.dice.length).toBeGreaterThan(15)
  })

  it('un cliente al día y sin señales no es grave', () => {
    expect(senalesDeGrave(base({ semana: 4, marcadas: claves(3) }))).toHaveLength(0)
  })
})
