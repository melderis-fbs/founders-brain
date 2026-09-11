import { escribir, escribirDevolviendo, fila, filas } from './db'
import type { EstadoSesion, SesionEnLista } from './sesiones-tipos'
import { ESTADOS_SESION } from './sesiones-tipos'
import { leerFecha } from './valores'

export * from './sesiones-tipos'

/**
 * Las sesiones 1:1.
 *
 * Una fila por sesión, con su color. El color no es decoración: dice si esa
 * sesión dejó algo cargado o se perdió. Una sesión hecha sin transcripción es
 * una hora de trabajo de la que no quedó nada.
 */

export async function listarSesiones(clienteId: number): Promise<SesionEnLista[]> {
  return filas<SesionEnLista>(
    `select id, numero, fecha, estado, que_paso,
            (transcripcion is not null and transcripcion <> '') as tiene_transcripcion,
            coalesce(length(transcripcion), 0) as caracteres,
            analizada_en
       from sesiones where cliente_id = $1
      order by fecha desc nulls last, numero desc nulls last, id desc`,
    [clienteId],
  )
}

export type SesionCompleta = SesionEnLista & {
  transcripcion: string | null
  analisis: string | null
  puntos: string[] | null
  compromisos: string[] | null
}

export async function traerSesion(id: number, clienteId: number): Promise<SesionCompleta | null> {
  return fila<SesionCompleta>(
    `select id, numero, fecha, estado, que_paso, transcripcion, analisis, puntos, compromisos, analizada_en,
            (transcripcion is not null and transcripcion <> '') as tiene_transcripcion,
            coalesce(length(transcripcion), 0) as caracteres
       from sesiones where id = $1 and cliente_id = $2`,
    [id, clienteId],
  )
}

export type Resultado = { ok: true; id: number } | { ok: false; error: string }

export async function crearSesion(datos: {
  clienteId: number
  numero?: string | null
  fechaBruta?: string | null
  estado?: string | null
  quePaso?: string | null
}): Promise<Resultado> {
  const estado = (ESTADOS_SESION as readonly string[]).includes(datos.estado ?? '')
    ? (datos.estado as EstadoSesion)
    : 'hecha'

  let fecha: string | null = null
  if (datos.fechaBruta && datos.fechaBruta.trim() !== '') {
    const leida = leerFecha(datos.fechaBruta)
    if (leida.estado === 'error') return { ok: false, error: `La fecha: ${leida.motivo}` }
    if (leida.estado === 'ok') fecha = leida.valor
  }

  let numero: number | null = null
  if (datos.numero && datos.numero.trim() !== '') {
    const n = Number(datos.numero)
    if (!Number.isInteger(n) || n <= 0) return { ok: false, error: 'El número de sesión tiene que ser un entero.' }
    const repetida = await fila<{ id: number }>(
      'select id from sesiones where cliente_id = $1 and numero = $2', [datos.clienteId, n],
    )
    if (repetida) return { ok: false, error: `Ya hay una sesión ${n} de este cliente.` }
    numero = n
  } else {
    const ultima = await fila<{ n: number | null }>(
      'select max(numero) as n from sesiones where cliente_id = $1', [datos.clienteId],
    )
    numero = (ultima?.n ?? 0) + 1
  }

  const creada = await escribirDevolviendo<{ id: number }>(
    `insert into sesiones (cliente_id, numero, fecha, estado, que_paso) values ($1, $2, $3, $4, $5) returning id`,
    [datos.clienteId, numero, fecha, estado, (datos.quePaso ?? '').trim() || null],
  )
  return { ok: true, id: creada.id }
}

/** Pegar o corregir la transcripción. No la analiza: eso es otro botón. */
export async function guardarTranscripcion(id: number, clienteId: number, texto: string): Promise<Resultado> {
  const limpio = texto.trim()
  if (limpio.length < 50) {
    return { ok: false, error: `La transcripción tiene ${limpio.length} caracteres. Con menos de 50 no hay nada que analizar.` }
  }
  await escribir(
    'update sesiones set transcripcion = $3, actualizado_en = now() where id = $1 and cliente_id = $2',
    [id, clienteId, limpio],
  )
  return { ok: true, id }
}

export async function guardarAnalisis(datos: {
  id: number
  clienteId: number
  analisis: string
  puntos: string[]
  compromisos: string[]
  quePaso: string | null
}): Promise<void> {
  await escribir(
    `update sesiones
        set analisis = $3, puntos = $4, compromisos = $5,
            que_paso = coalesce(nullif($6, ''), que_paso),
            analizada_en = now(), actualizado_en = now()
      where id = $1 and cliente_id = $2`,
    [datos.id, datos.clienteId, datos.analisis, datos.puntos, datos.compromisos, datos.quePaso ?? ''],
  )
}

/**
 * ¿Hay alguna sesión cargada en toda la cartera?
 *
 * Regla 2: mientras nadie cargue una sola sesión, «cero sesiones» de un cliente
 * no se puede leer como «no se reunieron». Recién cuando la fuente existe en
 * algún lado, un cero pasa a ser un cero.
 */
export async function hayAlgunaSesionEnLaCartera(): Promise<boolean> {
  const r = await fila<{ hay: boolean }>('select exists(select 1 from sesiones) as hay')
  return r?.hay ?? false
}

export type SesionConAnalisis = {
  numero: number | null
  fecha: string | null
  estado: string
  que_paso: string | null
  puntos: string[] | null
  compromisos: string[] | null
}

/**
 * Las sesiones con lo que salió de cada una, sin la transcripción.
 *
 * Para el expediente: lo que importa de una sesión es qué se decidió y a qué
 * se comprometió, no los cuarenta mil caracteres de cómo se dijo. Eso ya se
 * analizó una vez y quedó guardado; volver a mandarlo entero sería pagar dos
 * veces por lo mismo.
 */
export async function sesionesConAnalisis(clienteId: number): Promise<SesionConAnalisis[]> {
  return filas<SesionConAnalisis>(
    `select numero, fecha::text as fecha, estado, que_paso, puntos, compromisos
       from sesiones where cliente_id = $1
      order by fecha asc nulls last, numero asc nulls last, id asc`,
    [clienteId],
  )
}
