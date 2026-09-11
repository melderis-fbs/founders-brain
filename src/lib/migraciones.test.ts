import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ESQUEMA_ESPERADO } from './revision'
import { MIGRACIONES, sqlDe } from './migraciones'

const CARPETA = 'supabase/migrations'
const enDisco = readdirSync(CARPETA).filter((f) => f.endsWith('.sql')).sort()

describe('las migraciones metidas en el código', () => {
  it('están todas las que hay en la carpeta, en orden', () => {
    expect(MIGRACIONES.map((m) => m.archivo)).toEqual(enDisco)
  })

  it('el texto es el mismo que el del archivo', () => {
    for (const m of MIGRACIONES) {
      expect(m.sql).toBe(readFileSync(join(CARPETA, m.archivo), 'utf8').trim())
    }
  })

  it('sqlDe devuelve sólo las pedidas, en el orden de la carpeta', () => {
    const sql = sqlDe([enDisco[2]!, enDisco[0]!])
    expect(sql.indexOf(enDisco[0]!)).toBeLessThan(sql.indexOf(enDisco[2]!))
    expect(sql).not.toContain(enDisco[1]!)
  })
})

describe('el chequeo de la base', () => {
  /**
   * La que más importa: una migración nueva sin registrar acá hace que la
   * aplicación diga que la base está bien y reviente después contra una tabla
   * que no existe. Ya pasó una vez.
   */
  it('toda migración de la carpeta está declarada en el chequeo', () => {
    expect(ESQUEMA_ESPERADO.map((e) => e.migracion)).toEqual(enDisco)
  })

  it('cada migración declara algo que se pueda comprobar', () => {
    for (const paso of ESQUEMA_ESPERADO) {
      expect(paso.tablas.length + paso.columnas.length,
             `${paso.migracion} no declara ninguna tabla ni columna`).toBeGreaterThan(0)
    }
  })
})
