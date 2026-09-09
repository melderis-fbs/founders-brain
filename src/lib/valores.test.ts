import { describe, expect, it } from 'vitest'
import { leerBooleano, leerEntero, leerFecha, leerNumero, leerOpcion, leerTexto } from './valores'

describe('regla 1 · celda vacía no es cero', () => {
  it('vacío es vacío, no cero', () => {
    for (const bruto of ['', '   ', null, undefined]) {
      expect(leerNumero(bruto)).toEqual({ estado: 'vacio' })
      expect(leerTexto(bruto)).toEqual({ estado: 'vacio' })
      expect(leerFecha(bruto)).toEqual({ estado: 'vacio' })
      expect(leerBooleano(bruto)).toEqual({ estado: 'vacio' })
    }
  })

  it('cero es cero: se midió y dio cero', () => {
    expect(leerNumero('0')).toEqual({ estado: 'ok', valor: 0 })
    expect(leerEntero(0)).toEqual({ estado: 'ok', valor: 0 })
  })

  it('lo que no se entiende da error, nunca cero', () => {
    const r = leerNumero('lo que salga')
    expect(r.estado).toBe('error')
  })
})

describe('números como los escribe la gente', () => {
  const casos: [string, number][] = [
    ['1500', 1500],
    ['1.500', 1500],
    ['1,500', 1500],
    ['1.500,50', 1500.5],
    ['1,500.50', 1500.5],
    ['$ 1.800.000', 1800000],
    ['2500 usd', 2500],
    ['-300', -300],
    ['0,5', 0.5],
  ]
  for (const [texto, esperado] of casos) {
    it(`"${texto}" -> ${esperado}`, () => {
      expect(leerNumero(texto)).toEqual({ estado: 'ok', valor: esperado })
    })
  }

  it('un decimal no pasa por entero', () => {
    expect(leerEntero('4,5').estado).toBe('error')
  })
})

describe('fechas', () => {
  it('acepta dd/mm/aaaa, que es como está la planilla', () => {
    expect(leerFecha('03/02/2025')).toEqual({ estado: 'ok', valor: '2025-02-03' })
    expect(leerFecha('3-2-25')).toEqual({ estado: 'ok', valor: '2025-02-03' })
    expect(leerFecha('2025-02-03')).toEqual({ estado: 'ok', valor: '2025-02-03' })
  })

  it('el 31 de febrero no es una fecha', () => {
    expect(leerFecha('31/02/2025').estado).toBe('error')
  })

  it('lo que no es fecha se informa, no se inventa', () => {
    const r = leerFecha('arrancó en febrero')
    expect(r.estado).toBe('error')
    if (r.estado === 'error') expect(r.motivo).toContain('dd/mm/aaaa')
  })
})

describe('sí y no', () => {
  it('entiende las formas de escribirlo', () => {
    expect(leerBooleano('Sí')).toEqual({ estado: 'ok', valor: true })
    expect(leerBooleano('x')).toEqual({ estado: 'ok', valor: true })
    expect(leerBooleano('NO')).toEqual({ estado: 'ok', valor: false })
    expect(leerBooleano('0')).toEqual({ estado: 'ok', valor: false })
  })
  it('«más o menos» no es ni sí ni no', () => {
    expect(leerBooleano('mas o menos').estado).toBe('error')
  })
})

describe('opciones cerradas', () => {
  const estados = ['activo', 'pausado', 'baja', 'finalizado'] as const
  it('acepta acentos, mayúsculas y alias', () => {
    expect(leerOpcion('ACTIVO', estados)).toEqual({ estado: 'ok', valor: 'activo' })
    expect(leerOpcion('En curso', estados, { 'en curso': 'activo' })).toEqual({ estado: 'ok', valor: 'activo' })
  })
  it('lo que no está en la lista se informa', () => {
    const r = leerOpcion('congelado', estados)
    expect(r.estado).toBe('error')
    if (r.estado === 'error') expect(r.motivo).toContain('activo')
  })
})
