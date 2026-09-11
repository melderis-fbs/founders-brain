// Imprime las migraciones, en orden, para pegar de una sola vez en el SQL
// Editor de Supabase cuando no hay una terminal con acceso a la base.
//
//   npm run esquema                    → todas
//   npm run esquema -- --desde 0004    → de la 0004 en adelante
//
// La segunda forma es para cuando la pantalla de revisión dice qué migraciones
// faltan: se copia el número de la primera y sale exactamente lo que hay que
// pegar, sin armarlo a mano ni dejar un archivo suelto que al mes queda viejo.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const carpeta = 'supabase/migrations'
const todas = readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort()

const i = process.argv.indexOf('--desde')
const desde = i === -1 ? null : process.argv[i + 1]

if (i !== -1 && !desde) {
  console.error('Uso: npm run esquema -- --desde 0004')
  process.exit(1)
}

const archivos = desde ? todas.filter((f) => f >= desde) : todas

if (archivos.length === 0) {
  console.error(`No hay ninguna migración desde «${desde}». Las que hay: ${todas.join(', ')}`)
  process.exit(1)
}

console.log(desde
  ? `-- FOUNDERS BRAIN · las ${archivos.length} migraciones desde ${desde}, en orden.`
  : '-- FOUNDERS BRAIN · todas las migraciones, en orden.')
console.log('-- Son idempotentes: volver a correr una que ya está aplicada no rompe nada.')
for (const archivo of archivos) {
  console.log(`\n-- ${'='.repeat(70)}\n-- ${archivo}\n-- ${'='.repeat(70)}\n`)
  console.log(readFileSync(join(carpeta, archivo), 'utf8').trim())
}
