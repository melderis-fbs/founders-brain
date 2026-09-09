import { describe, expect, it } from 'vitest'
import { mapearEncabezados } from './mapeo'

describe('los encabezados de la planilla', () => {
  it('entiende acentos, mayúsculas y sinónimos', () => {
    const m = mapearEncabezados(['Nombre', 'CONSULTORA', 'Meta Mensual', 'fecha de inicio', 'Ticket promedio'])
    expect(m.campos.get('nombre')).toBe('Nombre')
    expect(m.campos.get('consultora')).toBe('CONSULTORA')
    expect(m.campos.get('meta_mensual')).toBe('Meta Mensual')
    expect(m.campos.get('fecha_inicio')).toBe('fecha de inicio')
    expect(m.campos.get('ticket')).toBe('Ticket promedio')
    expect(m.ignoradas).toEqual([])
  })

  it('informa las columnas que no reconoce en vez de tragárselas', () => {
    const m = mapearEncabezados(['nombre', 'color favorito'])
    expect(m.ignoradas).toEqual(['color favorito'])
  })

  it('reconoce el id del cliente y las columnas de texto', () => {
    const m = mapearEncabezados(['id_cliente', 'nombre', 'texto_onboarding', 'llamada de venta'])
    expect(m.columnaRef).toBe('id_cliente')
    expect(m.documentos.get('onboarding')).toBe('texto_onboarding')
    expect(m.documentos.get('llamada_venta')).toBe('llamada de venta')
  })

  it('con dos columnas para lo mismo usa la primera y avisa de la otra', () => {
    const m = mapearEncabezados(['nombre', 'meta', 'meta mensual'])
    expect(m.campos.get('meta_mensual')).toBe('meta')
    expect(m.repetidas).toEqual(['meta mensual'])
  })
})
