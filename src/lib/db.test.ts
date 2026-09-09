import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { opcionesDePool } from './db'

// Se carga como lo carga `pg` internamente: es la pieza que decide el TLS.
const require_ = createRequire(import.meta.url)
const ConnectionParameters = require_('pg/lib/connection-parameters.js') as new (config: unknown) => {
  host: string; port: number; user: string; ssl: unknown
}

/**
 * Estas pruebas existen porque `pg` hace algo que no se ve leyendo el código:
 * cuando hay `connectionString`, lo que diga la cadena PISA las opciones que le
 * pasamos. Si eso cambia, o si alguien vuelve a poner un `ssl` fijo, acá se
 * rompe en vez de fallar recién al publicar.
 */
const POOLER = 'postgresql://postgres.abc:clave@aws-0-us-east-1.pooler.supabase.com:6543/postgres'

function tlsEfectivo(url: string) {
  return new ConnectionParameters(opcionesDePool(url)).ssl
}

describe('cómo se abre la conexión', () => {
  it('sin sslmode en la cadena, cifra sin validar el certificado', () => {
    expect(tlsEfectivo(POOLER)).toEqual({ rejectUnauthorized: false })
  })

  it('con sslmode en la cadena, decide la cadena', () => {
    // pg lo traduce a validación completa; lo importante es que no queda el
    // rejectUnauthorized: false nuestro, que sería silenciosamente más flojo.
    expect(tlsEfectivo(`${POOLER}?sslmode=require`)).not.toEqual({ rejectUnauthorized: false })
  })

  it('contra el Postgres local no se pide TLS', () => {
    expect(tlsEfectivo('postgresql://founders:founders@127.0.0.1:5432/founders_brain')).toBeFalsy()
  })

  it('un parámetro de otra herramienta, como pgbouncer=true, no molesta', () => {
    const p = new ConnectionParameters(opcionesDePool(`${POOLER}?pgbouncer=true`))
    expect(p.host).toBe('aws-0-us-east-1.pooler.supabase.com')
    expect(p.port).toBe(6543)
    expect(p.user).toBe('postgres.abc')
  })
})
