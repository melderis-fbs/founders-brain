/**
 * Crea el usuario con el que se entra.
 *
 *   npm run seed -- admin@foundersbs.com "Mel" laclave
 *
 * Si no tenés la base a mano desde la terminal, con --sql imprime la sentencia
 * para pegar en el SQL Editor de Supabase, sin conectarse a nada:
 *
 *   npm run seed -- --sql admin@foundersbs.com "Mel" laclave
 *
 * La contraseña nunca se guarda: se guarda su hash (scrypt con sal).
 */
import { hashearClave } from '../src/lib/claves'
import { escribir, pool } from '../src/lib/db'

const SENTENCIA = `insert into usuarios (email, nombre, rol, clave_hash) values ($1, $2, 'admin', $3)
     on conflict (email) do update set nombre = excluded.nombre, clave_hash = excluded.clave_hash, activo = true`

function comillas(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`
}

async function main() {
  const argumentos = process.argv.slice(2)
  const soloSql = argumentos[0] === '--sql'
  const [email, nombre, clave] = soloSql ? argumentos.slice(1) : argumentos

  if (!email || !nombre || !clave) {
    console.error('Uso: npm run seed -- [--sql] <email> "<nombre>" <clave>')
    process.exit(1)
  }

  const hash = await hashearClave(clave)

  if (soloSql) {
    console.log(
      `insert into usuarios (email, nombre, rol, clave_hash)\n` +
        `values (${comillas(email.trim().toLowerCase())}, ${comillas(nombre)}, 'admin', ${comillas(hash)})\n` +
        `on conflict (email) do update\n` +
        `  set nombre = excluded.nombre, clave_hash = excluded.clave_hash, activo = true;`,
    )
    return
  }

  await escribir(SENTENCIA, [email.trim().toLowerCase(), nombre, hash])
  console.log(`Listo. Entrá con ${email}`)
  await pool().end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
