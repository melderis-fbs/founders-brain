import { escribir, escribirDevolviendo, filas } from './db'

/**
 * Las notas de la consultora sobre un cliente.
 *
 * Lo que se escribe entre sesiones y no es ni un dato de la ficha ni una
 * bandera: «llamé y no atendió», «pidió mover la del jueves», «está con un
 * tema familiar». Hoy eso vive en el WhatsApp de cada una y se pierde el día
 * que el cliente cambia de mano.
 *
 * No se editan. Si algo cambió, se escribe abajo: una nota editada pierde lo
 * único que la hace útil, que es qué se sabía en ese momento.
 */

export type Nota = {
  id: number
  texto: string
  quien: string | null
  usuario_id: number | null
  creado_en: string
}

export async function notasDe(clienteId: number): Promise<Nota[]> {
  return filas<Nota>(
    `select n.id, n.texto, u.nombre as quien, n.usuario_id, n.creado_en::text as creado_en
       from notas n left join usuarios u on u.id = n.usuario_id
      where n.cliente_id = $1 order by n.creado_en desc`,
    [clienteId],
  )
}

export type Resultado = { ok: true } | { ok: false; error: string }

export async function escribirNota(datos: {
  clienteId: number
  texto: string
  usuarioId: number
}): Promise<Resultado> {
  const texto = datos.texto.trim()
  if (texto === '') return { ok: false, error: 'La nota está vacía.' }

  await escribirDevolviendo(
    'insert into notas (cliente_id, texto, usuario_id) values ($1, $2, $3) returning id',
    [datos.clienteId, texto, datos.usuarioId],
  )
  return { ok: true }
}

/**
 * Borrar una nota propia.
 *
 * Sólo la suya: una nota de otra persona no se toca, ni para borrarla. Es lo
 * que ella sabía y escribió, no un dato compartido.
 */
export async function borrarNota(notaId: number, clienteId: number, usuarioId: number): Promise<Resultado> {
  const borradas = await escribir(
    'delete from notas where id = $1 and cliente_id = $2 and usuario_id = $3',
    [notaId, clienteId, usuarioId],
    { esperadas: 'cualquiera' },
  )
  return borradas > 0
    ? { ok: true }
    : { ok: false, error: 'Esa nota no es tuya, o ya no está. Las notas de otra persona no se borran.' }
}
