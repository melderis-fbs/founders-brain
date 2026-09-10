'use server'

import { revalidatePath } from 'next/cache'
import { usuarioActual } from '@/lib/auth'
import { guardarUnCampo, type ResultadoEdicion } from '@/lib/campos-escritura'

/**
 * Guardar un dato editado en la ficha.
 *
 * Esto sí puede ser una acción de servidor: es un texto corto. Lo que nunca va
 * por acá es un archivo, que tiene tope de 1 MB y se traba sin avisar.
 */
export async function guardarCampo(clienteId: number, clave: string, bruto: string): Promise<ResultadoEdicion> {
  const usuario = await usuarioActual()
  if (!usuario) return { ok: false, error: 'Se cerró la sesión. Volvé a entrar y probá de nuevo.' }

  const resultado = await guardarUnCampo({ clienteId, clave, bruto, usuarioId: usuario.id })
  if (resultado.ok) revalidatePath(`/clientes/${clienteId}`)
  return resultado
}
