'use server'

import { revalidatePath } from 'next/cache'
import { usuarioActual } from '@/lib/auth'
import { guardarUnCampo, type ResultadoEdicion } from '@/lib/campos-escritura'
import { guardarDocumento } from '@/lib/documentos'
import { aceptar, rechazar } from '@/lib/propuestas'
import { crearSesion, guardarTranscripcion } from '@/lib/sesiones'

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


/**
 * Pegar un documento como texto.
 *
 * Este sí puede ir por una acción de servidor: es texto, no un archivo. Es el
 * camino principal y el que siempre funciona, incluso cuando el documento
 * original está en un Google Doc que nadie va a exportar.
 */
export async function pegarDocumento(clienteId: number, datos: FormData): Promise<{ ok: boolean; error?: string }> {
  const usuario = await usuarioActual()
  if (!usuario) return { ok: false, error: 'Se cerró la sesión. Volvé a entrar.' }

  const guardado = await guardarDocumento({
    clienteId,
    tipo: String(datos.get('tipo') ?? 'otro'),
    fechaBruta: String(datos.get('fecha') ?? ''),
    titulo: String(datos.get('titulo') ?? ''),
    texto: String(datos.get('texto') ?? ''),
    origen: 'pegado',
  })

  if (!guardado.ok) return { ok: false, error: guardado.error }
  revalidatePath(`/clientes/${clienteId}`)
  return { ok: true }
}

// ── Sesiones ────────────────────────────────────────────────────────────────

export async function nuevaSesion(clienteId: number, datos: FormData): Promise<{ ok: boolean; error?: string }> {
  const usuario = await usuarioActual()
  if (!usuario) return { ok: false, error: 'Se cerró la sesión. Volvé a entrar.' }

  const r = await crearSesion({
    clienteId,
    numero: String(datos.get('numero') ?? ''),
    fechaBruta: String(datos.get('fecha') ?? ''),
    estado: String(datos.get('estado') ?? 'hecha'),
    quePaso: String(datos.get('que_paso') ?? ''),
  })
  if (!r.ok) return { ok: false, error: r.error }
  revalidatePath(`/clientes/${clienteId}`)
  return { ok: true }
}

export async function pegarTranscripcion(
  clienteId: number, sesionId: number, texto: string,
): Promise<{ ok: boolean; error?: string }> {
  const usuario = await usuarioActual()
  if (!usuario) return { ok: false, error: 'Se cerró la sesión. Volvé a entrar.' }

  const r = await guardarTranscripcion(sesionId, clienteId, texto)
  if (!r.ok) return { ok: false, error: r.error }
  revalidatePath(`/clientes/${clienteId}`)
  return { ok: true }
}

// ── Propuestas de la ficha ──────────────────────────────────────────────────

export async function decidirPropuesta(
  clienteId: number, propuestaId: number, decision: 'aceptar' | 'rechazar',
): Promise<{ ok: boolean; error?: string }> {
  const usuario = await usuarioActual()
  if (!usuario) return { ok: false, error: 'Se cerró la sesión. Volvé a entrar.' }

  const r = decision === 'aceptar'
    ? await aceptar(propuestaId, clienteId, usuario.id)
    : await rechazar(propuestaId, clienteId, usuario.id)

  revalidatePath(`/clientes/${clienteId}`)
  return r.ok ? { ok: true } : { ok: false, error: r.error }
}
