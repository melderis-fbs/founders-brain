import type { PoolClient } from 'pg'
import { CAMPOS_POR_CLAVE, type Campo } from './campos'
import { escribir, escribirDevolviendo, fila, filas } from './db'
import { clave as claveDeNombre, plegado } from './texto'
import {
  leerBooleano, leerEntero, leerFecha, leerNumero, leerOpcion, leerTexto, leerTextoLargo, type Lectura,
} from './valores'

/**
 * Escribir un dato de un cliente, venga de donde venga.
 *
 * Lo usan los dos caminos: la importación de la planilla y la edición a mano en
 * la ficha. Que sea el mismo módulo no es prolijidad: es que la validación no
 * puede ser distinta según por dónde entró el dato, o la ficha termina
 * aceptando cosas que la planilla rechaza.
 *
 * Y toda escritura deja anotado de dónde salió, que es lo que después permite
 * cumplir la regla 9: un análisis automático no pisa lo que escribió una persona.
 */

export const ALIAS_TABLA = {
  clientes: 'c',
  cliente_negocio: 'n',
  cliente_numeros: 'm',
  cliente_comercial: 'k',
  cliente_autoridad: 'a',
  cliente_intentos: 'i',
} as const

export type Origen = 'planilla' | 'persona' | 'documento'

/** Lee una celda o un campo del formulario según el tipo del campo. */
export function leerCampo(campo: Campo, bruto: unknown): Lectura<unknown> {
  switch (campo.tipo) {
    case 'texto': return leerTexto(bruto)
    case 'texto_largo': return leerTextoLargo(bruto)
    case 'numero': return leerNumero(bruto)
    case 'entero': return leerEntero(bruto)
    case 'fecha': return leerFecha(bruto)
    case 'booleano': return leerBooleano(bruto)
    case 'opcion': return leerOpcion(bruto, campo.opciones ?? [], campo.alias)
  }
}

/** Anota de dónde salieron varios campos de un cliente, de una sola vez. */
export async function anotarOrigen(
  claves: readonly string[],
  datos: { clienteId: number; origen: Origen; usuarioId?: number | null; documentoId?: number | null; cita?: string | null },
  cliente?: PoolClient,
): Promise<void> {
  if (claves.length === 0) return
  await escribir(
    `insert into campo_origen (cliente_id, campo, origen, usuario_id, documento_id, cita)
     select $1, c.campo, $2, $3, $4, $5 from unnest($6::text[]) as c(campo)
     on conflict (cliente_id, campo) do update
       set origen = excluded.origen, usuario_id = excluded.usuario_id,
           documento_id = excluded.documento_id, cita = excluded.cita, actualizado_en = now()`,
    [datos.clienteId, datos.origen, datos.usuarioId ?? null, datos.documentoId ?? null, datos.cita ?? null, claves],
    { esperadas: claves.length, cliente },
  )
}

export type OrigenDeCampo = { origen: Origen; cita: string | null; actualizado_en: string }

export async function origenesDe(clienteId: number): Promise<Map<string, OrigenDeCampo>> {
  const anotados = await filas<{ campo: string } & OrigenDeCampo>(
    'select campo, origen, cita, actualizado_en from campo_origen where cliente_id = $1',
    [clienteId],
  )
  return new Map(anotados.map((a) => [a.campo, { origen: a.origen, cita: a.cita, actualizado_en: a.actualizado_en }]))
}

/** Qué campos, de toda la cartera, escribió una persona a mano. */
export async function camposEscritosPorPersonas(cliente?: PoolClient): Promise<Set<string>> {
  const anotados = await filas<{ cliente_id: number; campo: string }>(
    `select cliente_id, campo from campo_origen where origen = 'persona'`, [], cliente,
  )
  return new Set(anotados.map((a) => `${a.cliente_id}:${a.campo}`))
}

// ── Escribir un solo campo, desde la ficha ──────────────────────────────────

export type ResultadoEdicion = { ok: true } | { ok: false; error: string }

export async function guardarUnCampo(datos: {
  clienteId: number
  clave: string
  bruto: string
  usuarioId: number
}): Promise<ResultadoEdicion> {
  const campo = CAMPOS_POR_CLAVE.get(datos.clave)
  if (!campo) return { ok: false, error: 'Ese dato no existe en la ficha.' }

  const lectura = leerCampo(campo, datos.bruto)
  if (lectura.estado === 'error') return { ok: false, error: lectura.motivo }

  // Regla 1 también acá: vaciar un campo lo deja vacío, no en cero.
  const valor = lectura.estado === 'vacio' ? null : lectura.valor

  if (campo.clave === 'nombre') return guardarNombre(datos.clienteId, valor, datos.usuarioId)
  if (campo.clave === 'consultora') return guardarConsultora(datos.clienteId, valor, datos.usuarioId)

  try {
    if (campo.tabla === 'clientes') {
      await escribir(
        `update clientes set ${campo.columna} = $2, actualizado_en = now() where id = $1`,
        [datos.clienteId, valor],
      )
    } else {
      await escribir(
        `insert into ${campo.tabla} (cliente_id, ${campo.columna}) values ($1, $2)
         on conflict (cliente_id) do update set ${campo.columna} = excluded.${campo.columna}`,
        [datos.clienteId, valor],
      )
    }
    await anotarOrigen([campo.clave], { clienteId: datos.clienteId, origen: 'persona', usuarioId: datos.usuarioId })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function guardarNombre(clienteId: number, valor: unknown, usuarioId: number): Promise<ResultadoEdicion> {
  if (typeof valor !== 'string' || valor.trim() === '') {
    return { ok: false, error: 'Un cliente no puede quedarse sin nombre.' }
  }
  const nombreClave = claveDeNombre(valor)
  const nombrePleg = plegado(valor)

  // Regla 3, también al editar: si el nombre nuevo choca con otro cliente, se
  // informa y no se guarda, en vez de fusionar dos casos en silencio.
  const otro = await fila<{ id: number; nombre: string }>(
    'select id, nombre from clientes where nombre_clave = $1 and id <> $2',
    [nombreClave, clienteId],
  )
  if (otro) return { ok: false, error: `Ya hay otro cliente que se llama «${otro.nombre}».` }

  await escribir(
    'update clientes set nombre = $2, nombre_clave = $3, nombre_pleg = $4, actualizado_en = now() where id = $1',
    [clienteId, valor, nombreClave, nombrePleg],
  )
  await anotarOrigen(['nombre'], { clienteId, origen: 'persona', usuarioId })
  return { ok: true }
}

async function guardarConsultora(clienteId: number, valor: unknown, usuarioId: number): Promise<ResultadoEdicion> {
  let consultoraId: number | null = null

  if (typeof valor === 'string' && valor.trim() !== '') {
    const pleg = plegado(valor)
    const existente = await fila<{ id: number }>('select id from consultoras where nombre_pleg = $1', [pleg])
    consultoraId = existente
      ? existente.id
      : (await escribirDevolviendo<{ id: number }>(
          'insert into consultoras (nombre, nombre_pleg) values ($1, $2) returning id', [valor, pleg],
        )).id
  }

  await escribir(
    'update clientes set consultora_id = $2, actualizado_en = now() where id = $1',
    [clienteId, consultoraId],
  )
  await anotarOrigen(['consultora'], { clienteId, origen: 'persona', usuarioId })
  return { ok: true }
}
