import { CAMPOS_POR_CLAVE, type Campo } from './campos'
import { anotarCambios, anotarOrigen, leerCampo, valorGuardado } from './campos-escritura'
import { escribir, escribirDevolviendo, fila, filas } from './db'
import type { PropuestaCruda } from './modelo'

/**
 * Las propuestas de la ficha.
 *
 * Regla 4: la inteligencia artificial propone, una persona confirma. Nada de
 * esto se aplica solo. Cada propuesta guarda la frase del documento de donde
 * salió, y esa frase queda pegada al dato cuando se acepta.
 */

export type Propuesta = {
  id: number
  campo: string
  valor: string
  cita: string | null
  creada_en: string
  /** De qué documento salió, para poder decirlo al lado de la cita. */
  documento: string | null
}

export async function pendientesDe(clienteId: number): Promise<Propuesta[]> {
  return filas<Propuesta>(
    `select p.id, p.campo, p.valor, p.cita, p.creada_en, d.titulo as documento
       from propuestas_campo p
       left join documentos d on d.id = p.documento_id
      where p.cliente_id = $1 and p.estado = 'pendiente' order by p.id`,
    [clienteId],
  )
}

/**
 * Guardar lo que propuso el modelo.
 *
 * Se descarta lo que no pasa la validación del campo: si propone «dos palos»
 * para un número, eso no queda como propuesta, queda como descarte informado.
 * Es mejor que la consultora vea tres propuestas buenas que doce a revisar.
 */
export async function guardarPropuestas(datos: {
  clienteId: number
  crudas: readonly PropuestaCruda[]
  /** De qué documento salieron, cuando se leyó uno solo. */
  documentoId?: number | null
}): Promise<{ guardadas: number; descartadas: string[] }> {
  const descartadas: string[] = []
  let guardadas = 0

  // Si propuso el mismo campo dos veces, es una sola propuesta: vale la última.
  // Si no, diríamos «3 datos para confirmar» y abajo se verían dos.
  const unaPorCampo = new Map(datos.crudas.map((c) => [c.campo, c]))

  for (const cruda of unaPorCampo.values()) {
    const campo = CAMPOS_POR_CLAVE.get(cruda.campo)
    if (!campo) { descartadas.push(`${cruda.campo}: no existe en la ficha`); continue }

    const lectura = leerCampo(campo, cruda.valor)
    if (lectura.estado !== 'ok') {
      descartadas.push(`${campo.etiqueta}: «${cruda.valor}» ${lectura.estado === 'error' ? lectura.motivo : 'quedó vacío'}`)
      continue
    }

    await escribirDevolviendo(
      `insert into propuestas_campo (cliente_id, campo, valor, cita, documento_id)
       values ($1, $2, $3, $4, $5)
       on conflict (cliente_id, campo) where estado = 'pendiente'
       do update set valor = excluded.valor, cita = excluded.cita,
                     documento_id = excluded.documento_id, creada_en = now()
       returning id`,
      [datos.clienteId, cruda.campo, cruda.valor, cruda.cita, datos.documentoId ?? null],
    )
    guardadas++
  }

  return { guardadas, descartadas }
}

export type Decision = { ok: true } | { ok: false; error: string }

/**
 * Aceptar una propuesta: recién acá el dato entra a la ficha.
 *
 * Se vuelve a comprobar que el campo siga vacío. Entre que se propuso y que se
 * confirma pudo pasar media hora, y en el medio alguien pudo escribirlo a mano:
 * lo que escribió una persona no lo pisa un análisis automático (regla 9).
 */
export async function aceptar(propuestaId: number, clienteId: number, usuarioId: number): Promise<Decision> {
  const p = await fila<Propuesta>(
    `select id, campo, valor, cita, creada_en, null as documento from propuestas_campo
      where id = $1 and cliente_id = $2 and estado = 'pendiente'`,
    [propuestaId, clienteId],
  )
  if (!p) return { ok: false, error: 'Esa propuesta ya no está pendiente.' }

  const campo = CAMPOS_POR_CLAVE.get(p.campo)
  if (!campo) return { ok: false, error: 'Ese campo ya no existe en la ficha.' }

  if (await yaTieneValor(clienteId, campo)) {
    await marcar(propuestaId, 'rechazada', usuarioId)
    return { ok: false, error: `Mientras tanto alguien cargó «${campo.etiqueta}» a mano. No se pisa: la propuesta queda descartada.` }
  }

  const lectura = leerCampo(campo, p.valor)
  if (lectura.estado !== 'ok') return { ok: false, error: `«${p.valor}» no es un valor válido para ${campo.etiqueta}.` }

  const antes = await valorGuardado(clienteId, campo)

  if (campo.tabla === 'clientes') {
    await escribir(`update clientes set ${campo.columna} = $2, actualizado_en = now() where id = $1`, [clienteId, lectura.valor])
  } else {
    await escribir(
      `insert into ${campo.tabla} (cliente_id, ${campo.columna}) values ($1, $2)
       on conflict (cliente_id) do update set ${campo.columna} = excluded.${campo.columna}`,
      [clienteId, lectura.valor],
    )
  }

  // La cita queda pegada al dato: de acá en adelante se puede ver de dónde salió.
  await anotarOrigen([campo.clave], { clienteId, origen: 'documento', usuarioId, cita: p.cita })
  await anotarCambios([{ campo: campo.clave, anterior: antes, nuevo: lectura.valor }],
                      { clienteId, origen: 'documento', usuarioId, cita: p.cita })
  await marcar(propuestaId, 'aceptada', usuarioId)
  return { ok: true }
}

export async function rechazar(propuestaId: number, clienteId: number, usuarioId: number): Promise<Decision> {
  const tocadas = await escribir(
    `update propuestas_campo set estado = 'rechazada', decidida_por = $3, decidida_en = now()
      where id = $1 and cliente_id = $2 and estado = 'pendiente'`,
    [propuestaId, clienteId, usuarioId],
    { esperadas: 'cualquiera' },
  )
  return tocadas > 0 ? { ok: true } : { ok: false, error: 'Esa propuesta ya no está pendiente.' }
}

async function marcar(id: number, estado: 'aceptada' | 'rechazada', usuarioId: number): Promise<void> {
  await escribir(
    `update propuestas_campo set estado = $2, decidida_por = $3, decidida_en = now() where id = $1`,
    [id, estado, usuarioId],
  )
}

async function yaTieneValor(clienteId: number, campo: Campo): Promise<boolean> {
  const r = await fila<{ lleno: boolean }>(
    `select (${campo.columna} is not null${campo.tipo === 'texto' || campo.tipo === 'texto_largo' || campo.tipo === 'opcion' ? ` and ${campo.columna} <> ''` : ''}) as lleno
       from ${campo.tabla} where ${campo.tabla === 'clientes' ? 'id' : 'cliente_id'} = $1`,
    [clienteId],
  )
  return r?.lleno === true
}
