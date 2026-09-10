'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { usuarioActual } from '@/lib/auth'
import { crearCliente } from '@/lib/campos-escritura'

/** Dar de alta un cliente desde la lista, sin pasar por la planilla. */
export async function altaDeCliente(datos: FormData): Promise<{ ok: boolean; error?: string }> {
  const usuario = await usuarioActual()
  if (!usuario) return { ok: false, error: 'Se cerró la sesión. Volvé a entrar.' }

  const r = await crearCliente({
    nombre: String(datos.get('nombre') ?? ''),
    consultora: String(datos.get('consultora') ?? ''),
    programaMeses: String(datos.get('programa_meses') ?? ''),
    fechaInicio: String(datos.get('fecha_inicio') ?? ''),
    estado: String(datos.get('estado') ?? ''),
    usuarioId: usuario.id,
  })

  if (!r.ok) return { ok: false, error: r.error }
  revalidatePath('/clientes')
  redirect(`/clientes/${r.clienteId}`)
}
