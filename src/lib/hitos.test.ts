import { describe, expect, it } from 'vitest'
import { dondeSeCorta, faltaCargar, fasesSegunLosHitos, evaluarHitos, fuentesConDatos, queNecesita, HITOS } from './hitos'

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

    // Ya le tocaba, pero la oferta no está cargada: no se dice que falta —eso
    // sería afirmar algo del cliente—, se dice qué hay que cargar.
    const enLaSemana10 = evaluar(10, {})
    const oferta = enLaSemana10.find((e) => e.hito.clave === 'oferta')!
    expect(oferta.estado).toBe('sin_datos')
    expect(oferta.porQue).toBe('no_cargado')
    expect(oferta.porQueNoSeSabe).toContain('oferta')
    expect(oferta.atrasoEnSemanas).toBeNull()
  })

  /**
   * LA REGLA 2, PERO POR CLIENTE.
   *
   * Era el agujero que ponía a media cartera en grave. `conDatos` miraba si la
   * fuente tenía datos en ALGÚN cliente: como alguien había subido un
   * onboarding, el hito opinaba sobre los 114 clientes a los que nadie les
   * subió el suyo, y decía que estaban atrasados desde la semana 1.
   */
  it('sin el onboarding DE ESTE CLIENTE, el hito no dice que falta: dice que no está cargado', () => {
    const conAlguno = fuentesConDatos({ algunClienteConDatosDeFicha: true, algunOnboardingCargado: true })
    const sinElSuyo = evaluarHitos({ semana: 13, valores: FICHA_COMPLETA, tiposDeDocumento: SIN_DOCUMENTOS, conDatos: conAlguno })
    const onboarding = sinElSuyo.find((e) => e.hito.clave === 'onboarding')!
    expect(onboarding.estado).toBe('sin_datos')
    expect(onboarding.porQueNoSeSabe).toContain('de este cliente')
    expect(onboarding.atrasoEnSemanas).toBeNull()
  })

  it('con la ficha en blanco, ningún hito de ficha dice que falta', () => {
    const enBlanco = evaluar(13, {})
    const deFicha = enBlanco.filter((e) => e.hito.fuente === 'ficha')
    expect(deFicha.every((e) => e.estado === 'sin_datos')).toBe(true)
    expect(enBlanco.filter((e) => e.estado === 'falta')).toHaveLength(0)
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

    // Y con el suyo cargado, ahí sí queda hecho.
    const conElSuyo = evaluarHitos({ semana: 10, valores: {}, tiposDeDocumento: new Set(['onboarding']), conDatos: conAlguno })
    expect(conElSuyo.find((e) => e.hito.clave === 'onboarding')!.estado).toBe('hecho')
  })

  // Con la ficha a medias ya no hay «corte»: no sabemos dónde se cortó. Lo que
  // hay es una lista de lo que falta cargar, y lo primero es lo más viejo.
  it('dice qué falta cargar primero: lo más viejo', () => {
    const evaluados = evaluar(10, { cliente_ideal: 'x', problema: 'y' })
    expect(dondeSeCorta(evaluados)).toBeNull()
    expect(faltaCargar(evaluados)[0]!.hito.clave).toBe('cuenta_inversa')   // vencía en la semana 1
  })

  it('la línea de qué necesita empieza por lo que hay que cargar', () => {
    const evaluados = evaluar(10, { ...FICHA_COMPLETA, oferta: '', promesa: '' })
    expect(queNecesita(evaluados, [])).toContain('cargar oferta y promesa cerradas')
  })

  it('cuando no falta nada exigible, no dice que va bien si no se sabe', () => {
    expect(queNecesita(evaluar(null, {}), [])).toBe('no hay datos para saber cómo va')
    expect(queNecesita(evaluar(2, FICHA_COMPLETA), [])).toBe('va en tiempo')
  })

  it('una fase no está hecha si sólo está hecho uno de sus hitos', () => {
    // La fase 2 tiene el mensaje hecho y tres hitos que no se pueden medir.
    // Eso no es una fase hecha: es una fase que no se sabe.
    expect(fasesSegunLosHitos(evaluar(10, FICHA_COMPLETA))[2]).toBe('sin_datos')
  })

  it('las cuatro fases quedan con un estado cada una', () => {
    const fases = fasesSegunLosHitos(evaluar(10, FICHA_COMPLETA))
    // Tres de los cuatro hitos de la fase 1 están hechos, pero el onboarding
    // no se puede evaluar: en esta cartera no hay ninguno cargado. La fase no
    // está hecha ni falta: no se sabe.
    expect(fases[1]).toBe('sin_datos')
    expect(fases[2]).toBe('sin_datos')   // semanas 5 a 8: el mensaje está, pero el tracker no se carga
    expect(fases[3]).toBe('sin_datos')   // semanas 9 a 12: no se cargan las ventas
    expect(fases[4]).toBe('sin_datos')   // semanas 13 a 16: tampoco
  })

  it('el catálogo es el del método, en orden y sin inventar hitos', () => {
    expect(HITOS.map((h) => h.semana)).toEqual([1, 1, 3, 4, 5, 6, 6, 7, 8, 9, 13, 14])
    expect(HITOS.filter((h) => h.bloquea).map((h) => h.clave)).toEqual(['oferta', 'primera_venta', 'segunda_venta'])
  })
})
