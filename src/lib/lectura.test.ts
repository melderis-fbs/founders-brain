import { describe, expect, it } from 'vitest'
import type { HitoEvaluado } from './hitos'
import { HITOS } from './hitos'
import { bloquesDeLaFicha, leerElCaso } from './lectura'
import type { SesionEnLista } from './sesiones-tipos'

function hito(clave: string, estado: HitoEvaluado['estado'], atraso: number | null = null): HitoEvaluado {
  const h = HITOS.find((x) => x.clave === clave) ?? HITOS[0]!
  return { hito: h, estado, atrasoEnSemanas: atraso, porQueNoSeSabe: estado === 'sin_datos' ? 'todavía no se carga eso' : undefined }
}

const NADA = {
  hitos: [] as HitoEvaluado[],
  valores: {},
  sesiones: [] as SesionEnLista[],
  hayAlgunaSesionEnLaCartera: false,
  hayDiagnostico: false,
}

describe('la lectura del caso, con aritmética', () => {
  it('lo que no tiene datos no cuenta como cero: se reparte su peso', () => {
    // Los hitos dan 100; todo lo demás está sin datos salvo el criterio.
    const l = leerElCaso({
      ...NADA,
      hitos: [hito('onboarding', 'hecho'), hito('cuenta_inversa', 'hecho')],
      hayDiagnostico: true,
    })
    // 30 de hitos + 10 de criterio, los dos en 100 → 100, no 40.
    expect(l.puntaje).toBe(100)
    expect(l.cobertura).toBe(40)
  })

  it('sin nada cargado no hay puntaje, y lo dice', () => {
    const l = leerElCaso({ ...NADA, hayDiagnostico: false })
    // Sólo el criterio se puede medir, y da 0 porque nadie miró el caso.
    expect(l.cobertura).toBe(10)
    expect(l.titular).toContain('el 10% de lo que haría falta')
  })

  it('el titular dice dónde se corta, no el número', () => {
    const l = leerElCaso({ ...NADA, hitos: [hito('oferta', 'falta', 27)] })
    expect(l.titular).toContain('falta hace 27 semanas')
    expect(l.titular).not.toMatch(/^\d+$/)
  })

  it('con poca información el «qué no hacer» frena la conclusión, no la acción', () => {
    const l = leerElCaso({ ...NADA, hitos: [hito('oferta', 'falta', 27)] })
    expect(l.corte?.alcanzaParaConcluir).toBe(false)
    expect(l.corte?.queNoHacer).toContain('Un diagnóstico sin datos es una opinión')
    expect(l.corte?.accion).toContain('próxima sesión')
  })

  it('el hito que bloquea manda, aunque haya otro más viejo', () => {
    const l = leerElCaso({
      ...NADA,
      hitos: [hito('cuenta_inversa', 'falta', 30), hito('oferta', 'falta', 27)],
    })
    // «Oferta y promesa cerradas» bloquea; la cuenta inversa está más atrasada.
    expect(l.corte?.etiqueta).toContain('Oferta')
  })

  it('regla 2 · sin sesiones en toda la cartera, el trabajo de las semanas no opina', () => {
    const l = leerElCaso({ ...NADA, hayAlgunaSesionEnLaCartera: false })
    const ejecucion = l.partes.find((p) => p.clave === 'ejecucion')!
    expect(ejecucion.estado).toBe('sin_datos')
  })

  it('con sesiones en la cartera, cero sesiones de este cliente sí es un cero', () => {
    const l = leerElCaso({ ...NADA, hayAlgunaSesionEnLaCartera: true })
    const ejecucion = l.partes.find((p) => p.clave === 'ejecucion')!
    expect(ejecucion.estado).toBe('medido')
    expect(ejecucion).toMatchObject({ valor: 0 })
  })

  it('la cuenta inversa dice cuántas ventas necesita, no un puntaje suelto', () => {
    const l = leerElCaso({
      ...NADA,
      valores: { meta_mensual: 5400000, precio_actual: 1800000, fecha_cuenta_inversa: '2026-03-01' },
    })
    const cuenta = l.partes.find((p) => p.clave === 'cuenta_inversa')!
    expect(cuenta.estado).toBe('medido')
    expect(cuenta).toMatchObject({ valor: 100 })
    expect((cuenta as { detalle: string }).detalle).toContain('3 ventas por mes')
  })

  it('con los números pero sin hacerla con el cliente, no está hecha', () => {
    const l = leerElCaso({ ...NADA, valores: { meta_mensual: 5400000, precio_actual: 1800000 } })
    const cuenta = l.partes.find((p) => p.clave === 'cuenta_inversa')!
    expect((cuenta as { detalle: string }).detalle).toContain('no está hecha con el cliente')
  })

  it('sin meta no se inventa la cuenta: dice qué falta', () => {
    const l = leerElCaso({ ...NADA, valores: { precio_actual: 1800000 } })
    const cuenta = l.partes.find((p) => p.clave === 'cuenta_inversa')!
    expect(cuenta).toMatchObject({ estado: 'sin_datos', porque: 'falta la meta mensual' })
  })

  it('un precio en cero no es un precio', () => {
    const l = leerElCaso({ ...NADA, valores: { meta_mensual: 5400000, precio_actual: 0 } })
    expect(l.partes.find((p) => p.clave === 'cuenta_inversa')!.estado).toBe('sin_datos')
  })

  it('dice qué habría que cargar para que la lectura valga más', () => {
    const l = leerElCaso(NADA)
    expect(l.paraQueValgaMas.join(' ')).toContain('meta mensual')
    expect(l.paraQueValgaMas.length).toBeGreaterThan(2)
  })

  it('sin ningún hito vencido no inventa un corte', () => {
    const l = leerElCaso({ ...NADA, hitos: [hito('onboarding', 'hecho'), hito('oferta', 'todavia_no')] })
    expect(l.corte).toBeNull()
  })
})

describe('los bloques de la ficha', () => {
  it('seis bloques, y cuenta cuántos tienen algo', () => {
    const e = bloquesDeLaFicha({ oferta: 'algo', meta_mensual: 100 }, { documentos: 0, sesiones: 0 })
    expect(e.bloques).toHaveLength(6)
    expect(e.conAlgo).toBe(2)
    expect(e.bloques.find((b) => b.grupo === 'negocio')!.estado).toBe('a_medias')
    expect(e.bloques.find((b) => b.grupo === 'autoridad')!.estado).toBe('vacio')
  })

  it('sin nada cargado no vale la pena pagar el diagnóstico', () => {
    const e = bloquesDeLaFicha({}, { documentos: 0, sesiones: 0 })
    expect(e.valeLaPena).toBe(false)
    expect(e.queVaAPoder).toContain('no hace falta gastar')
  })

  it('con un documento cargado ya vale la pena, aunque la ficha esté vacía', () => {
    const e = bloquesDeLaFicha({}, { documentos: 1, sesiones: 0 })
    expect(e.valeLaPena).toBe(true)
  })

  it('con ficha y documentos dice que alcanza', () => {
    const e = bloquesDeLaFicha(
      { oferta: 'x', meta_mensual: 1, hace_bien: 'y', que_funciono: 'z' },
      { documentos: 2, sesiones: 1 },
    )
    expect(e.queVaAPoder).toContain('Alcanza para diagnosticar')
  })

  it('un string vacío no es un dato cargado', () => {
    const e = bloquesDeLaFicha({ oferta: '   ' }, { documentos: 0, sesiones: 0 })
    expect(e.bloques.find((b) => b.grupo === 'negocio')!.cargados).toBe(0)
  })
})
