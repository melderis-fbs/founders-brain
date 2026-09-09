import pg, { Pool, type PoolClient, type QueryResultRow } from 'pg'

// Cómo llegan los valores de Postgres a JavaScript.
// Sin esto, un `numeric` llega como texto y una `date` llega como Date en la
// zona horaria del servidor, que es de donde salen los errores de un día.
pg.types.setTypeParser(20, (v) => Number(v))            // int8
pg.types.setTypeParser(1700, (v) => Number(v))          // numeric
pg.types.setTypeParser(1082, (v) => v)                  // date: se queda en aaaa-mm-dd

/**
 * La conexión a Postgres (Supabase).
 *
 * Se entra por conexión directa del lado del servidor, no por supabase-js.
 * Es a propósito y es la regla 8: supabase-js devuelve el error y sigue, así
 * que un permiso mal puesto termina en «155 filas aplicadas» sobre una base
 * vacía. `pg` tira excepción, y además acá toda escritura declara cuántas
 * filas tenía que tocar y se verifica.
 */

export class ErrorDeEscritura extends Error {
  constructor(
    mensaje: string,
    readonly detalle: { sql: string; esperadas: number; tocadas: number },
  ) {
    super(mensaje)
    this.name = 'ErrorDeEscritura'
  }
}

function crearPool(): Pool {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'Falta DATABASE_URL. Copiá .env.example a .env.local y poné la cadena de conexión de Supabase ' +
        '(Project Settings → Database → Connection string → URI).',
    )
  }
  const esLocal = /@(localhost|127\.0\.0\.1)/.test(url)
  return new Pool({
    connectionString: url,
    // Supabase exige TLS; en el Postgres local no hay certificado que validar.
    ssl: esLocal ? undefined : { rejectUnauthorized: false },
    // En Vercel cada instancia es un proceso corto y Supabase tiene un tope de
    // conexiones para todos: pocas por instancia. En un servidor propio, más.
    max: Number(process.env.DB_MAX_CONEXIONES ?? (process.env.VERCEL ? 3 : 10)),
    idleTimeoutMillis: 30_000,
  })
}

const global_ = globalThis as unknown as { __poolFounders?: Pool }
export function pool(): Pool {
  if (!global_.__poolFounders) global_.__poolFounders = crearPool()
  return global_.__poolFounders
}

/** Lectura. Devuelve las filas. */
export async function filas<T extends QueryResultRow>(
  sql: string,
  parametros: readonly unknown[] = [],
  cliente?: PoolClient,
): Promise<T[]> {
  const ejecutor = cliente ?? pool()
  const r = await ejecutor.query<T>(sql, parametros as unknown[])
  return r.rows
}

/** Lectura de una sola fila, o null. */
export async function fila<T extends QueryResultRow>(
  sql: string,
  parametros: readonly unknown[] = [],
  cliente?: PoolClient,
): Promise<T | null> {
  const r = await filas<T>(sql, parametros, cliente)
  return r[0] ?? null
}

/**
 * Escritura verificada (regla 8).
 *
 * `esperadas` dice cuántas filas tiene que tocar la sentencia. Si toca otra
 * cantidad, esto no sigue de largo: rompe. Una escritura que no escribió no se
 * puede contar como aplicada.
 */
export async function escribir(
  sql: string,
  parametros: readonly unknown[] = [],
  opciones: { esperadas?: number | 'cualquiera'; cliente?: PoolClient } = {},
): Promise<number> {
  const { esperadas = 1, cliente } = opciones
  const ejecutor = cliente ?? pool()
  const r = await ejecutor.query(sql, parametros as unknown[])
  const tocadas = r.rowCount ?? 0
  if (esperadas !== 'cualquiera' && tocadas !== esperadas) {
    throw new ErrorDeEscritura(
      `La escritura tocó ${tocadas} fila(s) y tenía que tocar ${esperadas}.`,
      { sql: sql.trim().split('\n')[0], esperadas, tocadas },
    )
  }
  return tocadas
}

/**
 * Escritura verificada que además devuelve la fila (para los RETURNING).
 * Si no vuelve nada, rompe: no hay forma de que un INSERT ... RETURNING
 * exitoso no devuelva su fila.
 */
export async function escribirDevolviendo<T extends QueryResultRow>(
  sql: string,
  parametros: readonly unknown[] = [],
  cliente?: PoolClient,
): Promise<T> {
  const ejecutor = cliente ?? pool()
  const r = await ejecutor.query<T>(sql, parametros as unknown[])
  const primera = r.rows[0]
  if (!primera) {
    throw new ErrorDeEscritura('La escritura no devolvió ninguna fila.', {
      sql: sql.trim().split('\n')[0],
      esperadas: 1,
      tocadas: 0,
    })
  }
  return primera
}

/** Todo o nada. */
export async function enTransaccion<T>(trabajo: (cliente: PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool().connect()
  try {
    await cliente.query('begin')
    const resultado = await trabajo(cliente)
    await cliente.query('commit')
    return resultado
  } catch (error) {
    await cliente.query('rollback').catch(() => {})
    throw error
  } finally {
    cliente.release()
  }
}

/** Un punto de retorno dentro de una transacción, para aislar una fila que falla. */
export async function conPuntoDeRetorno<T>(
  cliente: PoolClient,
  nombre: string,
  trabajo: () => Promise<T>,
): Promise<{ ok: true; valor: T } | { ok: false; error: unknown }> {
  await cliente.query(`savepoint ${nombre}`)
  try {
    const valor = await trabajo()
    await cliente.query(`release savepoint ${nombre}`)
    return { ok: true, valor }
  } catch (error) {
    await cliente.query(`rollback to savepoint ${nombre}`)
    return { ok: false, error }
  }
}
