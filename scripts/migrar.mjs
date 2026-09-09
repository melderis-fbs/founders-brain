// Aplica supabase/migrations/*.sql en orden, cada una en su transacción.
// Las migraciones son idempotentes (create ... if not exists), así que correr
// esto de nuevo no rompe nada.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

try {
  for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch { /* sin .env.local se usa lo que haya en el entorno */ }

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Falta DATABASE_URL. Copiá .env.example a .env.local y poné la cadena de Supabase.')
  process.exit(1)
}

const esLocal = /@(localhost|127\.0\.0\.1)/.test(url)
const cliente = new pg.Client({ connectionString: url, ssl: esLocal ? undefined : { rejectUnauthorized: false } })
await cliente.connect()

const carpeta = 'supabase/migrations'
for (const archivo of readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort()) {
  process.stdout.write(`${archivo} ... `)
  try {
    await cliente.query('begin')
    await cliente.query(readFileSync(join(carpeta, archivo), 'utf8'))
    await cliente.query('commit')
    console.log('ok')
  } catch (error) {
    await cliente.query('rollback')
    console.log('falló')
    console.error(error.message)
    process.exit(1)
  }
}

await cliente.end()
console.log('Las tablas están.')
