import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { claveCoincide } from './claves'
import { escribir, escribirDevolviendo, fila } from './db'

export const COOKIE_SESION = 'fb_sesion'
const DIAS_DE_SESION = 30

export type Usuario = { id: number; email: string; nombre: string; rol: 'admin' | 'consultora' }

export async function entrar(email: string, clave: string): Promise<Usuario | null> {
  const encontrado = await fila<{ id: number; email: string; nombre: string; rol: 'admin' | 'consultora'; clave_hash: string }>(
    'select id, email, nombre, rol, clave_hash from usuarios where lower(email) = lower($1) and activo',
    [email.trim()],
  )
  if (!encontrado) return null
  if (!(await claveCoincide(clave, encontrado.clave_hash))) return null

  const token = randomBytes(32).toString('hex')
  await escribirDevolviendo(
    `insert into sesiones_login (token, usuario_id, expira_en)
     values ($1, $2, now() + ($3 || ' days')::interval)
     returning token`,
    [token, encontrado.id, String(DIAS_DE_SESION)],
  )

  const bolsa = await cookies()
  bolsa.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DIAS_DE_SESION * 24 * 60 * 60,
  })

  return { id: encontrado.id, email: encontrado.email, nombre: encontrado.nombre, rol: encontrado.rol }
}

export async function salir(): Promise<void> {
  const bolsa = await cookies()
  const token = bolsa.get(COOKIE_SESION)?.value
  if (token) {
    // Puede que la sesión ya no exista (expirada, o borrada en otra pestaña):
    // acá borrar cero filas es normal y no es un error de escritura.
    await escribir('delete from sesiones_login where token = $1', [token], { esperadas: 'cualquiera' })
  }
  bolsa.delete(COOKIE_SESION)
}

/** El usuario de esta petición, o null si no hay sesión válida. */
export async function usuarioActual(): Promise<Usuario | null> {
  const bolsa = await cookies()
  const token = bolsa.get(COOKIE_SESION)?.value
  if (!token) return null
  return fila<Usuario>(
    `select u.id, u.email, u.nombre, u.rol
       from sesiones_login s
       join usuarios u on u.id = s.usuario_id
      where s.token = $1 and s.expira_en > now() and u.activo`,
    [token],
  )
}
