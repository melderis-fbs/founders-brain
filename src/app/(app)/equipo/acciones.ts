'use server'

import { revalidatePath } from 'next/cache'
import { listarConsultoras } from '@/lib/clientes'
import { quienMira } from '@/lib/quien-mira'
import {
  asignarClientes, cambiarAcceso, cambiarClave, cambiarConsultora, crearConsultora, crearUsuario,
  cuantosAdminsActivos, renombrarConsultora, type Resultado,
} from '@/lib/usuarios'

/**
 * Todo esto lo hace quien administra, y nadie más.
 *
 * La comprobación va del lado del servidor en cada acción, no en la pantalla:
 * esconder un botón no impide que alguien llame a la acción igual.
 */
async function soloAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const quien = await quienMira()
  if (!quien) return { ok: false, error: 'Se cerró la sesión. Volvé a entrar.' }
  if (quien.usuario.rol !== 'admin') return { ok: false, error: 'Esto lo hace quien administra.' }
  return { ok: true }
}

export async function altaDeUsuario(datos: FormData): Promise<Resultado> {
  const puede = await soloAdmin()
  if (!puede.ok) return puede

  const r = await crearUsuario({
    email: String(datos.get('email') ?? ''),
    nombre: String(datos.get('nombre') ?? ''),
    clave: String(datos.get('clave') ?? ''),
    consultora: String(datos.get('consultora') ?? '').trim() || null,
  })
  if (r.ok) revalidatePath('/equipo')
  return r
}

export async function nuevaClave(usuarioId: number, clave: string): Promise<Resultado> {
  const puede = await soloAdmin()
  if (!puede.ok) return puede
  const r = await cambiarClave(usuarioId, clave)
  if (r.ok) revalidatePath('/equipo')
  return r
}

export async function moverDeConsultora(usuarioId: number, consultora: string | null): Promise<Resultado> {
  const puede = await soloAdmin()
  if (!puede.ok) return puede

  // Si el que se está moviendo es el último admin, la aplicación se queda sin
  // nadie que pueda administrarla. Y no hay forma de volver desde adentro.
  if (consultora !== null && (await esElUltimoAdmin(usuarioId))) {
    return { ok: false, error: 'Es el único admin activo. Si lo pasás a una consultora, nadie va a poder administrar la aplicación.' }
  }

  const r = await cambiarConsultora(usuarioId, consultora)
  if (r.ok) revalidatePath('/equipo')
  return r
}

export async function cambiarElAcceso(usuarioId: number, activo: boolean): Promise<Resultado> {
  const puede = await soloAdmin()
  if (!puede.ok) return puede

  if (!activo && (await esElUltimoAdmin(usuarioId))) {
    return { ok: false, error: 'Es el único admin activo. Si lo das de baja, nadie va a poder entrar a administrar.' }
  }

  const r = await cambiarAcceso(usuarioId, activo)
  if (r.ok) revalidatePath('/equipo')
  return r
}

export async function consultorasQueHay(): Promise<string[]> {
  return (await listarConsultoras()).map((c) => c.nombre)
}

async function esElUltimoAdmin(usuarioId: number): Promise<boolean> {
  const { fila } = await import('@/lib/db')
  const suyo = await fila<{ rol: string; activo: boolean }>('select rol, activo from usuarios where id = $1', [usuarioId])
  if (!suyo || suyo.rol !== 'admin' || !suyo.activo) return false
  return (await cuantosAdminsActivos()) <= 1
}

// ── Las consultoras ─────────────────────────────────────────────────────────

export async function altaDeConsultora(nombre: string): Promise<Resultado> {
  const puede = await soloAdmin()
  if (!puede.ok) return puede
  const r = await crearConsultora(nombre)
  if (r.ok) { revalidatePath('/equipo'); revalidatePath('/clientes') }
  return r
}

export async function corregirNombreDeConsultora(id: number, nombre: string): Promise<Resultado> {
  const puede = await soloAdmin()
  if (!puede.ok) return puede
  const r = await renombrarConsultora(id, nombre)
  if (r.ok) { revalidatePath('/equipo'); revalidatePath('/clientes') }
  return r
}

export async function pasarClientes(
  clienteIds: number[], consultoraId: number | null,
): Promise<{ ok: true; movidos: number } | { ok: false; error: string }> {
  const puede = await soloAdmin()
  if (!puede.ok) return puede
  const r = await asignarClientes(clienteIds, consultoraId)
  if (r.ok) { revalidatePath('/clientes'); revalidatePath('/equipo') }
  return r
}
