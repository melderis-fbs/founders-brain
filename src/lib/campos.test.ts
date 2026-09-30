import { describe, expect, it } from 'vitest'
import { CAMPOS, CAMPOS_POR_CLAVE, PROGRAMAS, sigueElRoadMap, TOTAL_BASE, TOTAL_CAMPOS } from './campos'

describe('el registro de campos', () => {
  /**
   * Dos campos que aceptan el mismo encabezado de planilla es un bug silencioso:
   * la columna «programa» se iba a los meses del programa en vez de a Growth o
   * Elite, y nadie se enteraba hasta ver los datos mal.
   */
  it('ningún encabezado de planilla lo reclaman dos campos', () => {
    const dueno = new Map<string, string>()
    const choques: string[] = []
    for (const c of CAMPOS) {
      for (const s of c.sinonimos) {
        if (dueno.has(s)) choques.push(`«${s}»: ${dueno.get(s)} y ${c.clave}`)
        dueno.set(s, c.clave)
      }
    }
    expect(choques).toEqual([])
  })

  it('ninguna clave está repetida', () => {
    expect(CAMPOS_POR_CLAVE.size).toBe(CAMPOS.length)
  })

  it('los campos base son pocos y son de los que cuentan', () => {
    expect(TOTAL_BASE).toBeLessThan(TOTAL_CAMPOS / 4)
    for (const c of CAMPOS.filter((x) => x.base)) expect(c.cuenta).toBe(true)
  })
})

describe('los dos programas', () => {
  it('son Growth y Elite, y nada más', () => {
    expect([...PROGRAMAS]).toEqual(['growth', 'elite'])
  })

  it('sólo Growth se compara contra el Road Map', () => {
    expect(sigueElRoadMap('growth')).toBe(true)
    expect(sigueElRoadMap('elite')).toBe(false)
  })

  it('sin programa elegido se lo compara igual: no se le regala el semáforo a nadie', () => {
    expect(sigueElRoadMap(null)).toBe(true)
    expect(sigueElRoadMap(undefined)).toBe(true)
  })

  it('los nombres viejos se entienden: M1 es Growth, M1+ y M2 son Elite', () => {
    const campo = CAMPOS_POR_CLAVE.get('programa')!
    expect(campo.alias).toMatchObject({ m1: 'growth', 'm1+': 'elite', m2: 'elite' })
  })
})
