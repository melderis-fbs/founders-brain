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


export type Cambio = { campo: string; anterior: unknown; nuevo: unknown }

/**
 * Guardar qué decía antes cada dato que cambió.
 *
 * `campo_origen` dice de dónde salió el valor de HOY. Esto dice qué decía
 * ayer. Sin el historial no se puede ver que el cliente ideal cambió tres
 * veces en dos meses, y eso —que la definición no se sostiene— es más
 * importante que cualquiera de las tres versiones por separado.
 *
 * Sólo entra lo que efectivamente cambió: una importación que reescribe el
 * mismo valor no es un cambio y no ensucia el historial.
 */
export async function anotarCambios(
  cambios: readonly Cambio[],
  datos: { clienteId: number; origen: Origen; usuarioId?: number | null; cita?: string | null },
  cliente?: PoolClient,
): Promise<void> {
  const reales = cambios.filter((c) => textoDe(c.anterior) !== textoDe(c.nuevo))
  if (reales.length === 0) return

  await escribir(
    `insert into campo_historial (cliente_id, campo, valor_anterior, valor_nuevo, origen, usuario_id, cita)
     select $1, x.campo, x.anterior, x.nuevo, $2, $3, $4
       from jsonb_to_recordset($5::jsonb) as x(campo text, anterior text, nuevo text)`,
    [
      datos.clienteId, datos.origen, datos.usuarioId ?? null, datos.cita ?? null,
      JSON.stringify(reales.map((c) => ({ campo: c.campo, anterior: textoDe(c.anterior), nuevo: textoDe(c.nuevo) }))),
    ],
    { esperadas: reales.length, cliente },
  )
}

export type EnElHistorial = {
  campo: string
  valor_anterior: string | null
  valor_nuevo: string | null
  origen: Origen
  cita: string | null
  creado_en: string
}

/** Todo lo que cambió en esta ficha, de lo más nuevo a lo más viejo. */
export async function historialDe(clienteId: number, campo?: string): Promise<EnElHistorial[]> {
  return campo
    ? filas<EnElHistorial>(
        `select campo, valor_anterior, valor_nuevo, origen, cita, creado_en from campo_historial
          where cliente_id = $1 and campo = $2 order by creado_en desc`, [clienteId, campo])
    : filas<EnElHistorial>(
        `select campo, valor_anterior, valor_nuevo, origen, cita, creado_en from campo_historial
          where cliente_id = $1 order by creado_en desc`, [clienteId])
}

/**
 * Cuántas veces cambió cada campo, para poder mirar lo que no se sostiene.
 *
 * Un campo que cambió cuatro veces no está «mal cargado»: está diciendo que
 * esa definición todavía no cerró.
 */
export async function loQueNoSeSostiene(clienteId: number, desdeCambios = 2): Promise<{ campo: string; veces: number; ultimo: string }[]> {
  return filas<{ campo: string; veces: number; ultimo: string }>(
    `select campo, count(*)::int as veces, max(creado_en)::text as ultimo
       from campo_historial
      where cliente_id = $1 and valor_anterior is not null
      group by campo having count(*) >= $2
      order by count(*) desc, max(creado_en) desc`,
    [clienteId, desdeCambios],
  )
}

function textoDe(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const t = String(v)
  return t.trim() === '' ? null : t
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
    // Se lee lo que había antes de pisarlo: si no, el historial se pierde en el
    // mismo momento en que se produce.
    const antes = await valorGuardado(datos.clienteId, campo)

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
    await anotarCambios([{ campo: campo.clave, anterior: antes, nuevo: valor }],
                        { clienteId: datos.clienteId, origen: 'persona', usuarioId: datos.usuarioId })
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

// ── Un cliente nuevo, cargado a mano ────────────────────────────────────────

export type Alta = { ok: true; clienteId: number } | { ok: false; error: string; campo?: string }

/**
 * Dar de alta un cliente sin pasar por la planilla.
 *
 * Pide lo mínimo para que la comparación tenga sentido —nombre y, si se sabe,
 * consultora, programa y fecha de inicio— y el resto se completa en la ficha.
 * Un formulario de 51 campos no lo llena nadie.
 *
 * La regla 3 rige igual que en la importación: un nombre que ya existe, o que
 * sólo se diferencia por acentos o mayúsculas, no entra y se dice contra cuál
 * choca. Es peor tener dos fichas de la misma persona que ninguna.
 */
export async function crearCliente(datos: {
  nombre: string
  consultora?: string | null
  programaMeses?: string | null
  fechaInicio?: string | null
  estado?: string | null
  usuarioId: number
}): Promise<Alta> {
  const lecturaNombre = leerTexto(datos.nombre)
  if (lecturaNombre.estado !== 'ok') return { ok: false, error: 'Poné el nombre del cliente.', campo: 'nombre' }

  const nombre = lecturaNombre.valor
  const nombreClave = claveDeNombre(nombre)
  const nombrePleg = plegado(nombre)

  const exacto = await fila<{ id: number; nombre: string }>(
    'select id, nombre from clientes where nombre_clave = $1', [nombreClave],
  )
  if (exacto) return { ok: false, error: `«${exacto.nombre}» ya está cargado.`, campo: 'nombre' }

  const parecido = await fila<{ id: number; nombre: string }>(
    'select id, nombre from clientes where nombre_pleg = $1 limit 1', [nombrePleg],
  )
  if (parecido) {
    return {
      ok: false,
      campo: 'nombre',
      error: `Ya existe «${parecido.nombre}», que se escribe igual salvo acentos o mayúsculas. Si es la misma persona, abrí esa ficha; si es otra, escribí el nombre completo para distinguirlas.`,
    }
  }

  // Los tres datos opcionales pasan por la misma lectura que la planilla.
  const opcionales: [string, string | null | undefined][] = [
    ['programa_meses', datos.programaMeses],
    ['fecha_inicio', datos.fechaInicio],
    ['estado', datos.estado],
  ]
  const valores = new Map<string, unknown>()
  for (const [clave, bruto] of opcionales) {
    const campo = CAMPOS_POR_CLAVE.get(clave)!
    const lectura = leerCampo(campo, bruto ?? '')
    if (lectura.estado === 'error') return { ok: false, error: `${campo.etiqueta}: ${lectura.motivo}`, campo: clave }
    if (lectura.estado === 'ok') valores.set(clave, lectura.valor)
  }

  const columnas = ['nombre', 'nombre_clave', 'nombre_pleg']
  const parametros: unknown[] = [nombre, nombreClave, nombrePleg]
  for (const [clave, valor] of valores) {
    columnas.push(CAMPOS_POR_CLAVE.get(clave)!.columna)
    parametros.push(valor)
  }

  const creado = await escribirDevolviendo<{ id: number }>(
    `insert into clientes (${columnas.join(', ')}) values (${parametros.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    parametros,
  )

  const puestos = ['nombre', ...valores.keys()]
  if (datos.consultora && datos.consultora.trim() !== '') {
    const r = await guardarConsultora(creado.id, datos.consultora.trim(), datos.usuarioId)
    if (!r.ok) return { ok: false, error: r.error, campo: 'consultora' }
  } else {
    await anotarOrigen(puestos, { clienteId: creado.id, origen: 'persona', usuarioId: datos.usuarioId })
    return { ok: true, clienteId: creado.id }
  }

  await anotarOrigen(puestos, { clienteId: creado.id, origen: 'persona', usuarioId: datos.usuarioId })
  return { ok: true, clienteId: creado.id }
}

/** Lo que hay guardado hoy en un campo, para poder comparar antes de pisarlo. */
export async function valorGuardado(clienteId: number, campo: Campo): Promise<unknown> {
  const r = await fila<Record<string, unknown>>(
    `select ${campo.columna} as valor from ${campo.tabla}
      where ${campo.tabla === 'clientes' ? 'id' : 'cliente_id'} = $1`,
    [clienteId],
  )
  return r?.valor ?? null
}
