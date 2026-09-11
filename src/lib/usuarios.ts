import { hashearClave } from './claves'
import { escribir, escribirDevolviendo, fila, filas } from './db'
import { plegado } from './texto'

/**
 * Quién puede entrar, y qué ve.
 *
 * Hasta acá los usuarios se creaban con un comando desde una terminal con el
 * repositorio al lado. Eso alcanza para el primero; para los siete
 * consultores no, y termina siendo yo el que crea cada cuenta.
 *
 * El rol sale de si tiene consultora asignada o no: con consultora ve lo suyo,
 * sin consultora ve todo. Una sola decisión en vez de dos que se pueden
 * contradecir.
 */

export type UsuarioDelEquipo = {
  id: number
  email: string
  nombre: string
  rol: 'admin' | 'consultora'
  consultora_id: number | null
  consultora: string | null
  activo: boolean
  creado_en: string
  /** Cuántos clientes ve hoy. Cero con consultora asignada es un dato, no un error. */
  clientes: number
  ultima_entrada: string | null
}

export async function listarEquipo(): Promise<UsuarioDelEquipo[]> {
  return filas<UsuarioDelEquipo>(
    `select u.id, u.email, u.nombre, u.rol, u.consultora_id, co.nombre as consultora,
            u.activo, u.creado_en::text as creado_en,
            case when u.rol = 'admin' then (select count(*)::int from clientes)
                 else (select count(*)::int from clientes c where c.consultora_id = u.consultora_id) end as clientes,
            (select max(s.creado_en)::text from sesiones_login s where s.usuario_id = u.id) as ultima_entrada
       from usuarios u
       left join consultoras co on co.id = u.consultora_id
      order by u.activo desc, u.nombre`,
  )
}

export type Resultado = { ok: true; id?: number } | { ok: false; error: string }

const LARGO_MINIMO = 8

/**
 * Crear a alguien del equipo.
 *
 * La consultora se busca por nombre plegado para que «Julieta Ponce» y
 * «julieta ponce» sean la misma. Si no existe se crea: es lo mismo que hace la
 * importación de la planilla, y no tiene sentido que acá sea distinto.
 */
export async function crearUsuario(datos: {
  email: string
  nombre: string
  clave: string
  consultora: string | null
}): Promise<Resultado> {
  const email = datos.email.trim().toLowerCase()
  const nombre = datos.nombre.trim()

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Ese email no parece un email.' }
  if (nombre === '') return { ok: false, error: 'Falta el nombre.' }
  if (datos.clave.length < LARGO_MINIMO) {
    return { ok: false, error: `La clave tiene que tener al menos ${LARGO_MINIMO} caracteres.` }
  }

  const yaEsta = await fila<{ nombre: string }>('select nombre from usuarios where lower(email) = $1', [email])
  if (yaEsta) return { ok: false, error: `Ese email ya es de ${yaEsta.nombre}. Si le querés cambiar la clave, usá «Cambiar la clave».` }

  const consultoraId = await idDeConsultora(datos.consultora)
  const hash = await hashearClave(datos.clave)

  const creado = await escribirDevolviendo<{ id: number }>(
    `insert into usuarios (email, nombre, rol, clave_hash, consultora_id)
     values ($1, $2, $3, $4, $5) returning id`,
    [email, nombre, consultoraId === null ? 'admin' : 'consultora', hash, consultoraId],
  )
  return { ok: true, id: creado.id }
}

export async function cambiarClave(usuarioId: number, clave: string): Promise<Resultado> {
  if (clave.length < LARGO_MINIMO) {
    return { ok: false, error: `La clave tiene que tener al menos ${LARGO_MINIMO} caracteres.` }
  }
  await escribir('update usuarios set clave_hash = $2 where id = $1', [usuarioId, await hashearClave(clave)])
  // Las sesiones abiertas se cortan: cambiar la clave y que la sesión vieja
  // siga andando es no haberla cambiado.
  await escribir('delete from sesiones_login where usuario_id = $1', [usuarioId], { esperadas: 'cualquiera' })
  return { ok: true }
}

/** Cambiar de qué consultora es. Sin consultora pasa a ver todo. */
export async function cambiarConsultora(usuarioId: number, consultora: string | null): Promise<Resultado> {
  const consultoraId = await idDeConsultora(consultora)
  await escribir(
    'update usuarios set consultora_id = $2, rol = $3 where id = $1',
    [usuarioId, consultoraId, consultoraId === null ? 'admin' : 'consultora'],
  )
  return { ok: true }
}

/**
 * Dar de baja a alguien, o volver a darle acceso.
 *
 * No se borra: un usuario borrado se lleva puesto de dónde salió cada dato que
 * cargó. Se desactiva, y sus sesiones abiertas se cierran en el acto.
 */
export async function cambiarAcceso(usuarioId: number, activo: boolean): Promise<Resultado> {
  await escribir('update usuarios set activo = $2 where id = $1', [usuarioId, activo])
  if (!activo) await escribir('delete from sesiones_login where usuario_id = $1', [usuarioId], { esperadas: 'cualquiera' })
  return { ok: true }
}

/** Que no quede la casa sin llaves. */
export async function cuantosAdminsActivos(): Promise<number> {
  const r = await fila<{ n: number }>(`select count(*)::int as n from usuarios where rol = 'admin' and activo`)
  return r?.n ?? 0
}

async function idDeConsultora(nombre: string | null): Promise<number | null> {
  const limpio = (nombre ?? '').trim()
  if (limpio === '') return null

  const existe = await fila<{ id: number }>('select id from consultoras where nombre_pleg = $1', [plegado(limpio)])
  if (existe) return existe.id

  const creada = await escribirDevolviendo<{ id: number }>(
    'insert into consultoras (nombre, nombre_pleg) values ($1, $2) returning id',
    [limpio, plegado(limpio)],
  )
  return creada.id
}

// ── Las consultoras ─────────────────────────────────────────────────────────

export type ConsultoraDelEquipo = {
  id: number
  nombre: string
  clientes: number
  /** Cuántas personas entran a la aplicación viendo esta cartera. */
  usuarios: number
}

/**
 * Las consultoras, con o sin clientes.
 *
 * Una consultora recién creada tiene cero clientes y tiene que verse igual:
 * si sólo aparecieran las que ya tienen gente asignada, no habría forma de
 * crear una y después pasarle su cartera.
 */
export async function listarConsultorasDelEquipo(): Promise<ConsultoraDelEquipo[]> {
  return filas<ConsultoraDelEquipo>(
    `select co.id, co.nombre,
            (select count(*)::int from clientes c where c.consultora_id = co.id) as clientes,
            (select count(*)::int from usuarios u where u.consultora_id = co.id and u.activo) as usuarios
       from consultoras co order by co.nombre`,
  )
}

export async function crearConsultora(nombre: string): Promise<Resultado> {
  const limpio = nombre.trim()
  if (limpio === '') return { ok: false, error: 'Falta el nombre.' }

  const existe = await fila<{ nombre: string }>('select nombre from consultoras where nombre_pleg = $1', [plegado(limpio)])
  if (existe) return { ok: false, error: `«${existe.nombre}» ya está.` }

  const creada = await escribirDevolviendo<{ id: number }>(
    'insert into consultoras (nombre, nombre_pleg) values ($1, $2) returning id',
    [limpio, plegado(limpio)],
  )
  return { ok: true, id: creada.id }
}

/**
 * Corregirle el nombre a una consultora.
 *
 * Sirve para el caso real: la planilla la escribió de una forma y en la
 * aplicación quedó de otra. Se corrige el nombre y los clientes se quedan
 * donde están, porque cuelgan del id y no del texto.
 */
export async function renombrarConsultora(id: number, nombre: string): Promise<Resultado> {
  const limpio = nombre.trim()
  if (limpio === '') return { ok: false, error: 'Falta el nombre.' }

  const choca = await fila<{ id: number; nombre: string }>(
    'select id, nombre from consultoras where nombre_pleg = $1 and id <> $2', [plegado(limpio), id],
  )
  if (choca) return { ok: false, error: `Ya hay otra que se llama «${choca.nombre}». Si son la misma, pasale los clientes en vez de renombrarla.` }

  await escribir('update consultoras set nombre = $2, nombre_pleg = $3 where id = $1', [id, limpio, plegado(limpio)])
  return { ok: true }
}

/**
 * Pasarle clientes a una consultora.
 *
 * Devuelve cuántos se movieron de verdad: los que ya estaban en esa consultora
 * no se cuentan, así «moví 12» no dice 25 cuando 13 ya estaban ahí.
 */
export async function asignarClientes(clienteIds: readonly number[], consultoraId: number | null): Promise<{ ok: true; movidos: number } | { ok: false; error: string }> {
  if (clienteIds.length === 0) return { ok: false, error: 'No elegiste ningún cliente.' }

  if (consultoraId !== null) {
    const existe = await fila<{ id: number }>('select id from consultoras where id = $1', [consultoraId])
    if (!existe) return { ok: false, error: 'Esa consultora ya no existe.' }
  }

  const movidos = await escribir(
    `update clientes set consultora_id = $2, actualizado_en = now()
      where id = any($1::bigint[]) and consultora_id is distinct from $2`,
    [clienteIds, consultoraId],
    { esperadas: 'cualquiera' },
  )
  return { ok: true, movidos }
}
