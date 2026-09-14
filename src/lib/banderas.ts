import { COLORES, type Bandera, type BanderaEnLaLista, type ColorDeBandera } from './banderas-tipos'
import { escribir, escribirDevolviendo, fila, filas } from './db'

/**
 * Las banderas: lo que sabe una persona y no sale de ningún dato.
 *
 * Todo lo demás que muestra la aplicación se calcula: fechas, campos
 * cargados, hitos. Pero una consultora que sale de una sesión sabiendo que el
 * cliente está por irse no tiene ningún campo donde poner eso, y mientras
 * tanto la ficha lo muestra en verde porque los datos están al día.
 *
 * La bandera es ese lugar. La levanta una persona, dice por qué, y se baja
 * cuando se resolvió, diciendo cómo. Nunca se levanta ni se baja sola: si un
 * cálculo pudiera ponerla, sería un cálculo, no una bandera.
 */

const SELECCION = `
  b.id, b.cliente_id, b.color, b.motivo, b.puesta_en::text as puesta_en,
  puso.nombre as puesta_por_nombre,
  b.resuelta_en::text as resuelta_en, resolvio.nombre as resuelta_por_nombre, b.como_se_resolvio
  from banderas b
  left join usuarios puso on puso.id = b.puesta_por
  left join usuarios resolvio on resolvio.id = b.resuelta_por`

/** La bandera abierta de un cliente, si tiene. */
export async function banderaDe(clienteId: number): Promise<Bandera | null> {
  return fila<Bandera>(
    `select ${SELECCION} where b.cliente_id = $1 and b.resuelta_en is null`,
    [clienteId],
  )
}

/** Todas las de un cliente, incluidas las que ya se resolvieron. */
export async function historialDeBanderas(clienteId: number): Promise<Bandera[]> {
  return filas<Bandera>(
    `select ${SELECCION} where b.cliente_id = $1 order by b.puesta_en desc`,
    [clienteId],
  )
}

export type Resultado = { ok: true } | { ok: false; error: string }

/**
 * Levantar una bandera, o cambiarle el color a la que ya está.
 *
 * El motivo es obligatorio. Una bandera sin motivo es un color que dentro de
 * dos semanas nadie va a saber por qué está: ni para bajarla ni para actuar.
 */
export async function ponerBandera(datos: {
  clienteId: number
  color: ColorDeBandera
  motivo: string
  usuarioId: number
}): Promise<Resultado> {
  const motivo = datos.motivo.trim()
  if (motivo === '') return { ok: false, error: 'Poné por qué la levantás. Sin eso, en dos semanas nadie va a saber qué mirar.' }
  if (!COLORES.includes(datos.color)) return { ok: false, error: 'Ese color no existe.' }

  await escribirDevolviendo(
    `insert into banderas (cliente_id, color, motivo, puesta_por) values ($1, $2, $3, $4)
     on conflict (cliente_id) where resuelta_en is null
     do update set color = excluded.color, motivo = excluded.motivo,
                   puesta_por = excluded.puesta_por, puesta_en = now()
     returning id`,
    [datos.clienteId, datos.color, motivo, datos.usuarioId],
  )
  return { ok: true }
}

/**
 * Bajarla cuando se resolvió.
 *
 * No se borra: queda con su fecha y con cómo se resolvió. La próxima vez que
 * alguien levante una bandera sobre el mismo cliente, lo de antes está ahí.
 */
export async function bajarBandera(datos: {
  clienteId: number
  comoSeResolvio: string
  usuarioId: number
}): Promise<Resultado> {
  const como = datos.comoSeResolvio.trim()
  if (como === '') return { ok: false, error: 'Poné cómo se resolvió. Es lo que va a servir la próxima vez que pase algo parecido.' }

  const bajadas = await escribir(
    `update banderas set resuelta_en = now(), resuelta_por = $2, como_se_resolvio = $3
      where cliente_id = $1 and resuelta_en is null`,
    [datos.clienteId, datos.usuarioId, como],
    { esperadas: 'cualquiera' },
  )
  return bajadas > 0 ? { ok: true } : { ok: false, error: 'Ese cliente no tiene ninguna bandera levantada.' }
}

/** Cuántas hay levantadas de cada color, para el tablero. */
export async function contarBanderas(consultoraId: number | null): Promise<Record<ColorDeBandera, number>> {
  const cuenta = await filas<{ color: ColorDeBandera; n: number }>(
    `select b.color, count(*)::int as n
       from banderas b join clientes c on c.id = b.cliente_id
      where b.resuelta_en is null and ($1::bigint is null or c.consultora_id = $1)
      group by b.color`,
    [consultoraId],
  )
  const salida: Record<ColorDeBandera, number> = { roja: 0, naranja: 0, amarilla: 0 }
  for (const c of cuenta) salida[c.color] = c.n
  return salida
}

/**
 * Las banderas levantadas, con su cliente, para el tablero.
 *
 * Primero las rojas: el orden es el de a quién llamar hoy, no el alfabético.
 */
export async function banderasLevantadas(consultoraId: number | null): Promise<BanderaEnLaLista[]> {
  return filas<BanderaEnLaLista>(
    `select b.id, b.cliente_id, b.color, b.motivo, b.puesta_en::text as puesta_en,
            puso.nombre as puesta_por_nombre,
            b.resuelta_en::text as resuelta_en, resolvio.nombre as resuelta_por_nombre,
            b.como_se_resolvio,
            c.nombre as cliente, co.nombre as consultora
       from banderas b
       join clientes c on c.id = b.cliente_id
       left join consultoras co on co.id = c.consultora_id
       left join usuarios puso on puso.id = b.puesta_por
       left join usuarios resolvio on resolvio.id = b.resuelta_por
      where b.resuelta_en is null and ($1::bigint is null or c.consultora_id = $1)
      order by case b.color when 'roja' then 1 when 'naranja' then 2 else 3 end, b.puesta_en`,
    [consultoraId],
  )
}

export { COLORES, QUE_DICE } from './banderas-tipos'
export type { Bandera, BanderaEnLaLista, ColorDeBandera } from './banderas-tipos'
