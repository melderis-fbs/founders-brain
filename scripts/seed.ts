/**
 * Crea el usuario con el que se entra la primera vez.
 *   npm run seed -- admin@foundersbs.com "Tu Nombre" tuclave
 */
import { hashearClave } from '../src/lib/claves'
import { escribir, pool } from '../src/lib/db'

async function main() {
  const [email, nombre, clave] = process.argv.slice(2)
  if (!email || !nombre || !clave) {
    console.error('Uso: npm run seed -- <email> "<nombre>" <clave>')
    process.exit(1)
  }
  const hash = await hashearClave(clave)
  await escribir(
    `insert into usuarios (email, nombre, rol, clave_hash) values ($1, $2, 'admin', $3)
     on conflict (email) do update set nombre = excluded.nombre, clave_hash = excluded.clave_hash, activo = true`,
    [email.trim().toLowerCase(), nombre, hash],
  )
  console.log(`Listo. Entrá con ${email}`)
  await pool().end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
