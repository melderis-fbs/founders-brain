/**
 * Crea el usuario con el que se entra.
 *
 *   npm run seed -- admin@foundersbs.com "Mel" laclave
 *
 * Para una consultora, se le pasa de qué consultora es. Con eso ve sus
 * clientes y nada más; el admin ve la cartera entera:
 *
 *   npm run seed -- julieta@foundersbs.com "Julieta Ponce" laclave --consultora "Julieta Ponce"
 *
 * Si no tenés la base a mano desde la terminal, con --sql imprime la sentencia
 * para pegar en el SQL Editor de Supabase, sin conectarse a nada:
 *
 *   npm run seed -- --sql admin@foundersbs.com "Mel" laclave
 *
 * La contraseña nunca se guarda: se guarda su hash (scrypt con sal).
 */
import { hashearClave } from '../src/lib/claves'
import { escribir, fila, pool } from '../src/lib/db'
import { plegado } from '../src/lib/texto'

function comillas(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`
}

/** Saca una opción con valor de la línea de comandos y la devuelve aparte. */
function sacarOpcion(argumentos: string[], nombre: string): string | null {
  const i = argumentos.indexOf(`--${nombre}`)
  if (i === -1) return null
  const valor = argumentos[i + 1]
  argumentos.splice(i, valor === undefined ? 1 : 2)
  return valor ?? null
}

async function main() {
  const argumentos = process.argv.slice(2)
  const consultora = sacarOpcion(argumentos, 'consultora')
  const soloSql = argumentos[0] === '--sql'
  const [email, nombre, clave] = soloSql ? argumentos.slice(1) : argumentos

  if (!email || !nombre || !clave) {
    console.error('Uso: npm run seed -- [--sql] <email> "<nombre>" <clave> [--consultora "<nombre de la consultora>"]')
    process.exit(1)
  }

  // Sin --consultora es admin y ve todo. Con --consultora es consultora y ve
  // lo suyo: el rol sale de si le asignaste una, no de otra bandera que haya
  // que acordarse de poner en el mismo orden.
  const rol = consultora ? 'consultora' : 'admin'
  const hash = await hashearClave(clave)

  if (soloSql) {
    const busca = consultora
      ? `(select id from consultoras where nombre_pleg = ${comillas(plegado(consultora))})`
      : 'null'
    console.log(
      `insert into usuarios (email, nombre, rol, clave_hash, consultora_id)\n` +
        `values (${comillas(email.trim().toLowerCase())}, ${comillas(nombre)}, ${comillas(rol)}, ${comillas(hash)}, ${busca})\n` +
        `on conflict (email) do update\n` +
        `  set nombre = excluded.nombre, clave_hash = excluded.clave_hash, rol = excluded.rol,\n` +
        `      consultora_id = excluded.consultora_id, activo = true;`,
    )
    if (consultora) {
      console.log(`\n-- Ojo: si «${consultora}» no está cargada como consultora, consultora_id queda en null`)
      console.log(`-- y esa persona no va a ver ningún cliente. Comprobalo con:`)
      console.log(`--   select id, nombre from consultoras where nombre_pleg = ${comillas(plegado(consultora))};`)
    }
    return
  }

  let consultoraId: number | null = null
  if (consultora) {
    const encontrada = await fila<{ id: number; nombre: string }>(
      'select id, nombre from consultoras where nombre_pleg = $1', [plegado(consultora)],
    )
    if (!encontrada) {
      console.error(`No hay ninguna consultora que se llame «${consultora}».`)
      console.error('Las consultoras entran con la planilla. Fijate cómo está escrita ahí y usá ese nombre.')
      process.exit(1)
    }
    consultoraId = encontrada.id
  }

  await escribir(
    `insert into usuarios (email, nombre, rol, clave_hash, consultora_id) values ($1, $2, $3, $4, $5)
       on conflict (email) do update
         set nombre = excluded.nombre, clave_hash = excluded.clave_hash, rol = excluded.rol,
             consultora_id = excluded.consultora_id, activo = true`,
    [email.trim().toLowerCase(), nombre, rol, hash, consultoraId],
  )
  console.log(
    consultora
      ? `Listo. ${email} entra como consultora y ve los clientes de ${consultora}.`
      : `Listo. ${email} entra como admin y ve la cartera entera.`,
  )
  await pool().end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
