import { readFileSync } from 'node:fs'

/**
 * Las pruebas de base corren SOBRE UNA BASE APARTE, nunca sobre la de trabajo.
 *
 * Hacen `truncate`. Si alguien corre `npm test` con DATABASE_URL apuntando a
 * Supabase, se lleva puesta la cartera entera. Por eso el interruptor es otra
 * variable, `DATABASE_URL_PRUEBAS`: si no está, esas pruebas se saltean solas
 * y las demás corren igual.
 */
try {
  for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch {
  // sin .env.local, se usa lo que haya en el entorno
}

const deLasPruebas = process.env.DATABASE_URL_PRUEBAS
if (deLasPruebas) {
  process.env.DATABASE_URL = deLasPruebas
} else {
  // Sin base de pruebas declarada no se toca ninguna base: las pruebas que la
  // necesitan se saltean, y las que no la necesitan corren igual.
  delete process.env.DATABASE_URL
  console.warn(
    '\n  Sin DATABASE_URL_PRUEBAS: las pruebas que escriben en la base se saltean.\n' +
    '  Poné una base aparte en .env.local para correrlas. Nunca la de trabajo: hacen truncate.\n',
  )
}
