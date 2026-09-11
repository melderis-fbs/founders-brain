'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { quienMira } from '@/lib/quien-mira'
import { nombreDeConsultora } from '@/lib/clientes'
import { crearCliente } from '@/lib/campos-escritura'

/** Dar de alta un cliente desde la lista, sin pasar por la planilla. */
export async function altaDeCliente(datos: FormData): Promise<{ ok: boolean; error?: string }> {
  const quien = await quienMira()
  if (!quien) return { ok: false, error: 'Se cerró la sesión. Volvé a entrar.' }

  // Una consultora da de alta en su propia consultora, elija lo que elija en
  // el formulario. Si no, podría crear un cliente a nombre de otra y después
  // no verlo, que es la peor combinación: existe y no lo puede tocar nadie.
  let consultora = String(datos.get('consultora') ?? '')
  if (!quien.alcance.todo) {
    if (quien.alcance.consultoraId === null) {
      return { ok: false, error: 'Todavía no te asignaron una consultora, así que no podés dar de alta clientes. Pedíselo a quien administra.' }
    }
    consultora = (await nombreDeConsultora(quien.alcance.consultoraId)) ?? ''
  }

  const r = await crearCliente({
    nombre: String(datos.get('nombre') ?? ''),
    consultora,
    programaMeses: String(datos.get('programa_meses') ?? ''),
    fechaInicio: String(datos.get('fecha_inicio') ?? ''),
    estado: String(datos.get('estado') ?? ''),
    usuarioId: quien.usuario.id,
  })

  if (!r.ok) return { ok: false, error: r.error }
  revalidatePath('/clientes')
  redirect(`/clientes/${r.clienteId}`)
}
