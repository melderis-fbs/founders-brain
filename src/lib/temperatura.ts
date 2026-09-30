import { escribir, escribirDevolviendo, filas } from './db'
import {
  esQueja, esTibia, TEMPERATURAS,
  type DeDonde, type DeQue, type LoQueDijo, type Temperatura, type TemperaturaGuardada,
} from './temperatura-tipos'

export * from './temperatura-tipos'

/**
 * LO QUE EL CLIENTE DIJO DE NOSOTROS.
 *
 * Todo lo demás que pinta el semáforo se calcula con fechas. Esto no: sale de
 * una frase que alguien dijo en una sesión o escribió en una encuesta, y por
 * eso cada fila guarda la frase. Sin cita no hay alerta: una consultora no va a
 * tener una conversación incómoda porque un modelo dijo que sí.
 *
 * El modelo propone, una persona confirma o descarta. Lo que escribe la persona
 * no se pisa nunca: volver a analizar la misma sesión corrige lo que dijo el
 * modelo y deja intacta la nota de quien la escribió.
 */

const SELECCION = `
  t.id, t.cliente_id, t.de, t.origen_id, t.temperatura, t.de_que, t.porque, t.citas,
  t.lo_otro, t.que_preguntar, t.detectada_en::text as detectada_en,
  t.descartada_en::text as descartada_en, quien.nombre as descartada_por_nombre,
  t.por_que_se_descarto, t.nota, anoto.nombre as nota_por_nombre, t.nota_en::text as nota_en,
  case when t.de = 'sesion'
       then 'sesión ' || coalesce(s.numero::text, t.origen_id::text)
       else d.titulo end as origen,
  case when t.de = 'sesion' then s.fecha::text else d.fecha::text end as origen_fecha
  from temperaturas t
  left join usuarios quien on quien.id = t.descartada_por
  left join usuarios anoto on anoto.id = t.nota_por
  left join sesiones s on t.de = 'sesion' and s.id = t.origen_id and s.cliente_id = t.cliente_id
  left join documentos d on t.de = 'encuesta' and d.id = t.origen_id and d.cliente_id = t.cliente_id`

/** Todo lo que se detectó de un cliente, lo descartado incluido. */
export async function temperaturasDe(clienteId: number): Promise<TemperaturaGuardada[]> {
  return filas<TemperaturaGuardada>(
    `select ${SELECCION} where t.cliente_id = $1 order by t.detectada_en desc`,
    [clienteId],
  )
}

/**
 * Las que siguen valiendo: nadie las descartó y dicen algo.
 *
 * Un «bien» no se descarta ni se confirma: es la ausencia de señal. Guardarlo
 * igual sirve para saber que esa sesión se leyó y no dio nada, que no es lo
 * mismo que no haberla leído.
 */
export function lasQueValen(guardadas: readonly TemperaturaGuardada[]): TemperaturaGuardada[] {
  return guardadas.filter((t) => t.descartada_en === null && t.temperatura !== 'bien')
}

export function comoLoLeeElSemaforo(guardadas: readonly TemperaturaGuardada[]): LoQueDijo[] {
  return lasQueValen(guardadas).map((t) => ({
    de: t.de,
    temperatura: t.temperatura,
    cita: t.citas[0] ?? null,
  }))
}

/**
 * Lo de toda la cartera, para la lista, la grilla y el tablero.
 *
 * Una fila por cliente y por origen. No se junta acá en un solo valor a
 * propósito: el semáforo necesita saber si el caliente salió de una sesión o de
 * la encuesta, porque son dos señales distintas y se nombran distinto.
 */
export async function loQueDijoLaCartera(): Promise<Map<number, LoQueDijo[]>> {
  const dichos = await filas<{ cliente_id: number; de: DeDonde; temperatura: Temperatura; cita: string | null }>(
    `select cliente_id, de, temperatura, citas[1] as cita
       from temperaturas
      where descartada_en is null and temperatura <> 'bien'`,
  )
  const mapa = new Map<number, LoQueDijo[]>()
  for (const d of dichos) {
    const lista = mapa.get(d.cliente_id) ?? []
    lista.push({ de: d.de, temperatura: d.temperatura, cita: d.cita })
    mapa.set(d.cliente_id, lista)
  }
  return mapa
}

export type LoDetectado = {
  clienteId: number
  de: DeDonde
  origenId: number
  temperatura: Temperatura
  deQue: DeQue | null
  porque: string | null
  citas: string[]
  loOtro: string | null
  quePreguntar: string | null
}

/**
 * Guardar lo que detectó el modelo.
 *
 * Analizar dos veces la misma sesión corrige la fila, no agrega otra (regla 7).
 * La nota de la persona sobrevive siempre (regla 9). El descarte sobrevive
 * mientras la temperatura sea la misma: alguien miró ESA alerta y dijo que no
 * era; si el modelo ahora dice otra cosa, eso es una alerta nueva y vuelve a
 * mostrarse.
 */
export async function guardarTemperatura(lo: LoDetectado): Promise<{ id: number }> {
  if (!(TEMPERATURAS as readonly string[]).includes(lo.temperatura)) {
    throw new Error(`«${lo.temperatura}» no es una temperatura.`)
  }
  // Sin cita no hay temperatura arriba de «bien». Es la regla del prompt, y se
  // vuelve a revisar acá porque el modelo puede no cumplirla y entonces
  // quedaría guardada una alarma que nadie puede discutir.
  const temperatura = lo.temperatura !== 'bien' && lo.citas.length === 0 ? 'bien' : lo.temperatura

  return escribirDevolviendo<{ id: number }>(
    `insert into temperaturas
       (cliente_id, de, origen_id, temperatura, de_que, porque, citas, lo_otro, que_preguntar)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (cliente_id, de, origen_id) do update
        set temperatura = excluded.temperatura,
            de_que = excluded.de_que,
            porque = excluded.porque,
            citas = excluded.citas,
            lo_otro = excluded.lo_otro,
            que_preguntar = excluded.que_preguntar,
            detectada_en = now(),
            descartada_en = case when temperaturas.temperatura = excluded.temperatura
                                 then temperaturas.descartada_en else null end,
            descartada_por = case when temperaturas.temperatura = excluded.temperatura
                                  then temperaturas.descartada_por else null end,
            por_que_se_descarto = case when temperaturas.temperatura = excluded.temperatura
                                       then temperaturas.por_que_se_descarto else null end
     returning id`,
    [lo.clienteId, lo.de, lo.origenId, temperatura, lo.deQue, lo.porque,
     lo.citas, lo.loOtro, lo.quePreguntar],
  )
}

export type Resultado = { ok: true } | { ok: false; error: string }

/**
 * «Esto no era una queja.»
 *
 * No se borra: queda con quién lo descartó y por qué. Lo que se descarta es lo
 * que el modelo leyó mal, y eso hay que poder leerlo después para saber qué
 * está leyendo mal.
 */
export async function descartarTemperatura(datos: {
  id: number
  clienteId: number
  usuarioId: number
  porQue: string
}): Promise<Resultado> {
  const porQue = datos.porQue.trim()
  if (porQue === '') {
    return { ok: false, error: 'Poné por qué no era. Es lo que sirve para que la próxima lo lea mejor.' }
  }
  const tocadas = await escribir(
    `update temperaturas set descartada_en = now(), descartada_por = $3, por_que_se_descarto = $4
      where id = $1 and cliente_id = $2 and descartada_en is null`,
    [datos.id, datos.clienteId, datos.usuarioId, porQue],
    { esperadas: 'cualquiera' },
  )
  return tocadas > 0 ? { ok: true } : { ok: false, error: 'Esa alerta no existe o ya estaba descartada.' }
}

/** Volver a prenderla: alguien la descartó y estaba equivocado. */
export async function volverAPrender(id: number, clienteId: number): Promise<Resultado> {
  const tocadas = await escribir(
    `update temperaturas set descartada_en = null, descartada_por = null, por_que_se_descarto = null
      where id = $1 and cliente_id = $2 and descartada_en is not null`,
    [id, clienteId],
    { esperadas: 'cualquiera' },
  )
  return tocadas > 0 ? { ok: true } : { ok: false, error: 'Esa alerta no existe o ya estaba prendida.' }
}

/**
 * Lo que agrega la consultora.
 *
 * El modelo leyó una transcripción; ella estuvo en la sesión. Lo que escribe acá
 * no lo pisa ningún análisis nuevo.
 */
export async function anotarEnLaTemperatura(datos: {
  id: number
  clienteId: number
  usuarioId: number
  nota: string
}): Promise<Resultado> {
  const nota = datos.nota.trim()
  if (nota === '') return { ok: false, error: 'La nota está vacía.' }
  const tocadas = await escribir(
    `update temperaturas set nota = $4, nota_por = $3, nota_en = now()
      where id = $1 and cliente_id = $2`,
    [datos.id, datos.clienteId, datos.usuarioId, nota],
    { esperadas: 'cualquiera' },
  )
  return tocadas > 0 ? { ok: true } : { ok: false, error: 'Esa alerta no existe.' }
}

/** Cuántas hay prendidas de cada temperatura, para el tablero. */
export async function contarTemperaturas(): Promise<{ tibios: number; quejas: number }> {
  const cuenta = await filas<{ temperatura: Temperatura; n: number }>(
    `select temperatura, count(distinct cliente_id)::int as n
       from temperaturas where descartada_en is null and temperatura <> 'bien'
      group by temperatura`,
  )
  return {
    tibios: cuenta.filter((c) => esTibia(c.temperatura)).reduce((a, c) => a + c.n, 0),
    quejas: cuenta.filter((c) => esQueja(c.temperatura)).reduce((a, c) => a + c.n, 0),
  }
}
