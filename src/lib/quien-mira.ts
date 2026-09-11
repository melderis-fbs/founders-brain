import { usuarioActual, type Usuario } from './auth'
import { alcanceDe, type Alcance } from './permisos'

/**
 * Quién está mirando esta pantalla, y hasta dónde llega.
 *
 * Vive aparte de permisos.ts a propósito: acá se leen las cookies, y eso ata
 * el archivo al servidor de Next. permisos.ts queda sin esa atadura, así se
 * puede probar la regla de quién ve qué sin levantar medio framework.
 */
export async function quienMira(): Promise<{ usuario: Usuario; alcance: Alcance } | null> {
  const usuario = await usuarioActual()
  if (!usuario) return null
  return { usuario, alcance: alcanceDe(usuario) }
}
