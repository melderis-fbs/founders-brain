// Imprime todas las migraciones, en orden, para pegar de una sola vez en el
// SQL Editor de Supabase cuando no hay una terminal con acceso a la base.
//   npm run esquema > esquema.sql
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const carpeta = 'supabase/migrations'
const archivos = readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort()

console.log('-- FOUNDERS BRAIN · todas las migraciones, en orden.')
console.log('-- Son idempotentes: volver a correr una que ya está aplicada no rompe nada.')
for (const archivo of archivos) {
  console.log(`\n-- ${'='.repeat(70)}\n-- ${archivo}\n-- ${'='.repeat(70)}\n`)
  console.log(readFileSync(join(carpeta, archivo), 'utf8').trim())
}
