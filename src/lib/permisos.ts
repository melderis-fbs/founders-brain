import type { Usuario } from './auth'
import { fila } from './db'

/**
 * Quién puede ver qué.
 *
 * Una consultora ve sus clientes. El admin ve todos. No hay un tercer caso.
 *
 * El alcance viaja como argumento obligatorio de cada consulta que toca
 * clientes: si mañana alguien agrega una pantalla nueva y se olvida de
 * filtrar, no compila. Un filtro que depende de acordarse no es un filtro.
 */

export type Alcance =
  /** El admin: la cartera entera. */
  | { todo: true }
  /** Una consultora: sólo los clientes de esa consultora. */
  | { todo: false; consultoraId: number }
  /** Un usuario al que todavía no le asignaron consultora: no ve ninguno. */
  | { todo: false; consultoraId: null }

export function alcanceDe(usuario: Usuario): Alcance {
  if (usuario.rol === 'admin') return { todo: true }
  return { todo: false, consultoraId: usuario.consultoraId }
}

/** Sin consultora asignada no se ve nada. Vacío por permiso, no por falta de datos. */
export function sinConsultoraAsignada(alcance: Alcance): boolean {
  return !alcance.todo && alcance.consultoraId === null
}

/**
 * La condición SQL del alcance, con el número que va aparte.
 *
 * Devuelve el fragmento y el parámetro por separado para que el valor nunca se
 * pegue a la consulta a mano. `false` cuando no hay consultora asignada: es más
 * claro que inventar un id que no existe, y no trae nada igual.
 */
export function condicionDeAlcance(alcance: Alcance, columna: string, siguienteParametro: number):
  { condicion: string; parametro: number | null } {
  if (alcance.todo) return { condicion: 'true', parametro: null }
  if (alcance.consultoraId === null) return { condicion: 'false', parametro: null }
  return { condicion: `${columna} = $${siguienteParametro}`, parametro: alcance.consultoraId }
}

/**
 * ¿Este usuario puede tocar este cliente?
 *
 * Lo usan las rutas que reciben un id de cliente desde el navegador. Un id en
 * el cuerpo de un pedido es lo que escribió cualquiera, no lo que vio en la
 * pantalla, así que se comprueba contra la base y no contra lo que llegó.
 */
export async function puedeVerCliente(clienteId: number, alcance: Alcance): Promise<boolean> {
  if (alcance.todo) {
    const existe = await fila<{ id: number }>('select id from clientes where id = $1', [clienteId])
    return existe !== null
  }
  if (alcance.consultoraId === null) return false

  const encontrado = await fila<{ id: number }>(
    'select id from clientes where id = $1 and consultora_id = $2',
    [clienteId, alcance.consultoraId],
  )
  return encontrado !== null
}
