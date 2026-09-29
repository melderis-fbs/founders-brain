import { escribir, escribirDevolviendo, filas } from './db'
import type { MesDelCliente } from './meses-tipos'

export * from './meses-tipos'

/**
 * LOS NÚMEROS DEL CLIENTE, MES POR MES
 *
 * La ficha guardaba «ventas del último mes» y «facturación de hoy»: un número
 * que se pisa a sí mismo cada vez que alguien lo actualiza. Con eso se puede
 * decir cuánto factura hoy y nada más. No se puede decir si viene creciendo,
 * que es la única pregunta que importa en un programa de cuatro meses.
 *
 * Acá cada mes es una fila y no se pisa nunca. El total se suma; el promedio de
 * ticket se calcula sobre los meses que tienen ticket cargado, no sobre los
 * doce, porque un mes sin cargar no es un mes en cero (regla 1).
 */

export async function mesesDe(clienteId: number): Promise<MesDelCliente[]> {
  return filas<MesDelCliente>(
    `select m.id, m.anio, m.mes, m.ventas, m.ticket::float8 as ticket,
            m.facturacion::float8 as facturacion, m.nota, u.nombre as quien
       from cliente_mes m left join usuarios u on u.id = m.cargado_por
      where m.cliente_id = $1
      order by m.anio, m.mes`,
    [clienteId],
  )
}

export type Resultado = { ok: true; id: number } | { ok: false; error: string }

function leerNumero(bruto: string | null | undefined, que: string, entero = false): number | null | string {
  const limpio = (bruto ?? '').trim()
  if (limpio === '') return null
  const n = Number(limpio.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(n)) return `${que}: «${limpio}» no es un número.`
  if (n < 0) return `${que} no puede ser negativo.`
  if (entero && !Number.isInteger(n)) return `${que} tiene que ser un número entero.`
  return n
}

/**
 * Cargar o corregir un mes.
 *
 * Volver a cargar el mismo mes lo corrige, no lo duplica (regla 7). Es lo que
 * va a pasar: se carga a mitad de mes y se completa al cerrarlo.
 */
export async function guardarMes(datos: {
  clienteId: number
  anio: number
  mes: number
  ventas?: string | null
  ticket?: string | null
  facturacion?: string | null
  nota?: string | null
  usuarioId: number | null
}): Promise<Resultado> {
  if (!Number.isInteger(datos.anio) || datos.anio < 2020 || datos.anio > 2100) {
    return { ok: false, error: 'El año no parece un año.' }
  }
  if (!Number.isInteger(datos.mes) || datos.mes < 1 || datos.mes > 12) {
    return { ok: false, error: 'El mes tiene que ir del 1 al 12.' }
  }

  const ventas = leerNumero(datos.ventas, 'Las ventas', true)
  if (typeof ventas === 'string') return { ok: false, error: ventas }
  const ticket = leerNumero(datos.ticket, 'El ticket')
  if (typeof ticket === 'string') return { ok: false, error: ticket }
  const facturacion = leerNumero(datos.facturacion, 'La facturación')
  if (typeof facturacion === 'string') return { ok: false, error: facturacion }

  const guardado = await escribirDevolviendo<{ id: number }>(
    `insert into cliente_mes (cliente_id, anio, mes, ventas, ticket, facturacion, nota, cargado_por)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (cliente_id, anio, mes) do update set
       ventas = excluded.ventas, ticket = excluded.ticket,
       facturacion = excluded.facturacion, nota = excluded.nota,
       cargado_por = excluded.cargado_por
     returning id`,
    [datos.clienteId, datos.anio, datos.mes, ventas, ticket, facturacion,
     (datos.nota ?? '').trim() || null, datos.usuarioId],
  )
  return { ok: true, id: guardado.id }
}

export async function borrarMes(clienteId: number, id: number): Promise<Resultado> {
  const suyo = await filas<{ id: number }>(
    'select id from cliente_mes where id = $1 and cliente_id = $2', [id, clienteId],
  )
  if (suyo.length === 0) return { ok: false, error: 'Ese mes no es de este cliente.' }
  await escribir('delete from cliente_mes where id = $1 and cliente_id = $2', [id, clienteId], { esperadas: 1 })
  return { ok: true, id }
}
