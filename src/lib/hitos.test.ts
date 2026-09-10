import { describe, expect, it } from 'vitest'
import { dondeSeCorta, estadoDeEtapas, evaluarHitos, fuentesConDatos, queNecesita, HITOS } from './hitos'

const SIN_DOCUMENTOS = new Set<string>()
// En estas pruebas la cartera tiene fichas cargadas pero ningún onboarding.
const CARTERA = fuentesConDatos({ algunClienteConDatosDeFicha: true, algunOnboardingCargado: false })

function evaluar(semana: number | null, valores: Record<string, unknown> = {}, docs = SIN_DOCUMENTOS) {
  return evaluarHitos({ semana, valores, tiposDeDocumento: docs, conDatos: CARTERA })
}

const FICHA_COMPLETA = {
  fecha_cuenta_inversa: '2025-02-10', meta_mensual: 5400000, ticket: 1800000,
  cliente_ideal: 'Dueños de PyME', problema: 'No vende seguido',
  oferta: 'Programa de 8 semanas', promesa: 'Duplicar conversaciones',
  mensaje: 'Dejá de vender por referidos', canal: 'Instagram',
}

describe('la comparación con lo esperado', () => {
  it('regla 2 · lo que se mide contra una tabla que no existe dice «sin datos», no «falta»', () => {
    const evaluados = evaluar(40, FICHA_COMPLETA)   // semana 40: todo está vencidísimo
    const venta = evaluados.find((e) => e.hito.clave === 'primera_venta')!

    expect(venta.estado).toBe('sin_datos')
    expect(venta.porQueNoSeSabe).toContain('ventas')
    // Y nunca miente diciendo que falta:
    expect(evaluados.filter((e) => e.estado === 'falta')).toHaveLength(0)
  })

  it('un hito que la ficha sí puede contestar se marca hecho', () => {
    const evaluados = evaluar(10, FICHA_COMPLETA)
    expect(evaluados.find((e) => e.hito.clave === 'oferta')!.estado).toBe('hecho')
    expect(evaluados.find((e) => e.hito.clave === 'mensaje')!.estado).toBe('hecho')
  })

  it('exige un hito sólo cuando ya le tocaba', () => {
    const enLaSemana2 = evaluar(2, {})
    expect(enLaSemana2.find((e) => e.hito.clave === 'oferta')!.estado).toBe('todavia_no')

    const enLaSemana10 = evaluar(10, {})
    const oferta = enLaSemana10.find((e) => e.hito.clave === 'oferta')!
    expect(oferta.estado).toBe('falta')
    expect(oferta.atrasoEnSemanas).toBe(6)   // vencía en la 4
  })

  it('sin fecha de inicio no inventa un atraso', () => {
    const evaluados = evaluar(null, {})
    expect(evaluados.every((e) => e.estado === 'sin_datos')).toBe(true)
  })

  it('regla 2 · si en toda la cartera no hay ni un onboarding, ese hito tampoco opina', () => {
    const sinNada = fuentesConDatos({ algunClienteConDatosDeFicha: true, algunOnboardingCargado: false })
    const conAlguno = fuentesConDatos({ algunClienteConDatosDeFicha: true, algunOnboardingCargado: true })

    const cuandoNoHayNinguno = evaluarHitos({ semana: 10, valores: {}, tiposDeDocumento: SIN_DOCUMENTOS, conDatos: sinNada })
    expect(cuandoNoHayNinguno.find((e) => e.hito.clave === 'onboarding')!.estado).toBe('sin_datos')

    // En cuanto alguien cargó uno, la regla ya tiene con qué comparar y sí opina.
    const cuandoYaHayAlguno = evaluarHitos({ semana: 10, valores: {}, tiposDeDocumento: SIN_DOCUMENTOS, conDatos: conAlguno })
    expect(cuandoYaHayAlguno.find((e) => e.hito.clave === 'onboarding')!.estado).toBe('falta')
  })

  it('dice dónde se corta: el primero que falta, no el último', () => {
    const evaluados = evaluar(10, { cliente_ideal: 'x', problema: 'y' })
    const corte = dondeSeCorta(evaluados)!
    expect(corte.hito.clave).toBe('cuenta_inversa')   // vencía en la semana 1
  })

  it('la línea de qué necesita se lee como habla el equipo', () => {
    const evaluados = evaluar(10, { ...FICHA_COMPLETA, oferta: '', promesa: '' })
    expect(queNecesita(evaluados, [])).toBe('oferta y promesa cerradas: 6 semanas de atraso')
  })

  it('cuando no falta nada exigible, no dice que va bien si no se sabe', () => {
    expect(queNecesita(evaluar(null, {}), [])).toBe('no hay datos para saber cómo va')
    expect(queNecesita(evaluar(2, FICHA_COMPLETA), [])).toBe('va en tiempo')
  })

  it('las cinco etapas quedan con un estado cada una', () => {
    const etapas = estadoDeEtapas(evaluar(10, FICHA_COMPLETA))
    expect(etapas.definicion).toBe('hecho')
    expect(etapas.mensaje).toBe('hecho')
    expect(etapas.conversion).toBe('sin_datos')   // no hay ventas ni llamadas cargadas
  })

  it('el catálogo es el del método, en orden y sin inventar hitos', () => {
    expect(HITOS.map((h) => h.semana)).toEqual([1, 1, 3, 4, 5, 6, 6, 7, 8, 9, 13, 14])
    expect(HITOS.filter((h) => h.bloquea).map((h) => h.clave)).toEqual(['oferta', 'primera_venta', 'segunda_venta'])
  })
})
