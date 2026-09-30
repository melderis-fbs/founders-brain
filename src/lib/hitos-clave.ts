import { escribir, escribirDevolviendo, filas } from './db'
import { ETAPAS, etapasDeLaSemana, FASES, faseDeLaSemana, hitosDeLaFase, HITOS_CLAVE, type Etapa, type Fase } from './modulos'

/**
 * Los hitos clave del programa, marcados por cliente.
 *
 * Lo que tiene que quedar hecho en cada fase y no sale de ningún campo ni de
 * ningún documento: lo sabe la consultora. La fila existe cuando está hecho;
 * pendiente es la ausencia de fila, así no hay dos lugares que puedan decir
 * cosas distintas.
 */

export type HechoPorCliente = { clave: string; hecho_en: string; quien: string | null }

export async function hechosDe(clienteId: number): Promise<Map<string, HechoPorCliente>> {
  const marcados = await filas<HechoPorCliente>(
    `select h.clave, h.hecho_en::text as hecho_en, u.nombre as quien
       from hitos_clave h left join usuarios u on u.id = h.usuario_id
      where h.cliente_id = $1`,
    [clienteId],
  )
  return new Map(marcados.map((m) => [m.clave, m]))
}

export type Resultado = { ok: true } | { ok: false; error: string }

export async function marcarHito(datos: {
  clienteId: number
  clave: string
  usuarioId: number
}): Promise<Resultado> {
  if (!HITOS_CLAVE.some((h) => h.clave === datos.clave)) {
    return { ok: false, error: 'Ese hito no es del programa.' }
  }
  await escribirDevolviendo(
    `insert into hitos_clave (cliente_id, clave, usuario_id) values ($1, $2, $3)
     on conflict (cliente_id, clave) do update set usuario_id = excluded.usuario_id
     returning id`,
    [datos.clienteId, datos.clave, datos.usuarioId],
  )
  return { ok: true }
}

export async function desmarcarHito(clienteId: number, clave: string): Promise<Resultado> {
  await escribir('delete from hitos_clave where cliente_id = $1 and clave = $2', [clienteId, clave], { esperadas: 'cualquiera' })
  return { ok: true }
}

export type EstadoDeFase = 'terminada' | 'en_curso' | 'pendiente' | 'quedo_a_medias'

export type FaseConEstado = {
  fase: Fase
  estado: EstadoDeFase
  hechos: number
  total: number
  /** Qué decir del estado, en una línea. */
  porque: string
}

/**
 * Cómo está cada fase para este cliente.
 *
 * El estado sale de dos cosas: en qué día va, y cuántos hitos clave marcó.
 * Una fase que ya pasó con hitos sin marcar no es «terminada» ni «pendiente»:
 * quedó a medias, y eso es lo que hay que ver.
 */
export function estadoDeLasFases(semana: number | null, hechos: ReadonlySet<string>): FaseConEstado[] {
  const laDeHoy = faseDeLaSemana(semana)

  return FASES.map((fase) => {
    const suyos = hitosDeLaFase(fase.numero)
    const total = suyos.length
    const cuantos = suyos.filter((h) => hechos.has(h.clave)).length
    const yaPaso = semana !== null && semana > fase.hastaSemana
    const esLaDeHoy = laDeHoy?.numero === fase.numero

    if (cuantos === total && total > 0) {
      return { fase, estado: 'terminada' as const, hechos: cuantos, total, porque: 'Todo lo de esta fase está hecho.' }
    }
    if (esLaDeHoy) {
      return { fase, estado: 'en_curso' as const, hechos: cuantos, total, porque: `Es la fase de ahora: van ${cuantos} de ${total}.` }
    }
    if (yaPaso) {
      return {
        fase, estado: 'quedo_a_medias' as const, hechos: cuantos, total,
        porque: `Esta fase terminó en la semana ${fase.hastaSemana} y quedaron ${total - cuantos} sin hacer.`,
      }
    }
    if (semana === null) {
      return { fase, estado: 'pendiente' as const, hechos: cuantos, total, porque: 'Sin fecha de inicio no se sabe si ya le tocaba.' }
    }
    return { fase, estado: 'pendiente' as const, hechos: cuantos, total, porque: `Arranca en la semana ${fase.desdeSemana}.` }
  })
}

export type EtapaConEstado = {
  etapa: Etapa
  estado: 'pasada' | 'es_la_de_ahora' | 'todavia_no' | 'elegida'
  porque: string
}

/**
 * Las catorce etapas, con dónde va el cliente.
 *
 * Dos marcas distintas y las dos importan: la que le tocaría por calendario y
 * la que eligió la consultora. Cuando no coinciden, eso es la conversación —y
 * por eso no se elige una y se esconde la otra.
 */
export function estadoDeLasEtapas(semana: number | null, elegida: string | null): EtapaConEstado[] {
  const laDeAhora = etapasDeLaSemana(semana)

  return ETAPAS.map((etapa) => {
    if (elegida && etapa.nombre === elegida) {
      return { etapa, estado: 'elegida' as const, porque: 'Acá dice la consultora que está.' }
    }
    if (laDeAhora.some((e) => e.clave === etapa.clave)) {
      return { etapa, estado: 'es_la_de_ahora' as const, porque: 'Es la que le toca por calendario.' }
    }
    if (semana === null) {
      return { etapa, estado: 'todavia_no' as const, porque: 'Sin fecha de inicio no se sabe si ya le tocaba.' }
    }
    if (semana > etapa.hastaSemana) {
      return { etapa, estado: 'pasada' as const, porque: `Le tocaba en la semana ${etapa.desdeSemana}.` }
    }
    return { etapa, estado: 'todavia_no' as const, porque: `Le toca en la semana ${etapa.desdeSemana}.` }
  })
}

/**
 * LAS CATORCE ETAPAS, MARCADAS A MANO
 *
 * Qué etapas del programa dio por cumplidas la consultora. Es lo que la
 * planilla tildaba a mano, y es lo único con lo que se puede decir «dónde está
 * y dónde tendría que estar»: el calendario dice qué le tocaría, esto dice qué
 * tiene.
 *
 * Viven en la misma tabla que los hitos clave, con la clave prefijada. Podrían
 * tener tabla propia, pero es la misma forma —cliente, clave, cuándo, quién— y
 * una tabla más es una migración más que alguien tiene que correr a mano en
 * producción antes de que la pantalla ande.
 */

const PREFIJO = 'etapa:'

/**
 * Todo lo marcado de este cliente, con las claves como las espera el cálculo.
 *
 * Las etapas se guardan con el prefijo «etapa:» y los hitos sin prefijo, pero el
 * avance las necesita a las dos juntas y sin prefijo: una etapa está hecha si
 * está marcada ELLA o si están marcados todos SUS hitos.
 *
 * Existe porque no tenerla costó un bug entero: se le pasaba al cálculo sólo las
 * etapas, así que marcar «Primera venta» guardaba bien en la base y no movía el
 * avance ni un punto. Exactamente lo que se veía en la pantalla.
 */
export function todoLoMarcado(hechos: ReadonlyMap<string, HechoPorCliente>): Set<string> {
  const salida = new Set<string>()
  for (const clave of hechos.keys()) {
    salida.add(clave.startsWith(PREFIJO) ? clave.slice(PREFIJO.length) : clave)
  }
  return salida
}

export function etapasHechasDe(hechos: ReadonlyMap<string, HechoPorCliente>): Set<string> {
  const salida = new Set<string>()
  for (const clave of hechos.keys()) {
    if (clave.startsWith(PREFIJO)) salida.add(clave.slice(PREFIJO.length))
  }
  return salida
}

/** Quién marcó cada etapa y cuándo, para poder discutirlo con un nombre al lado. */
export function quienMarcoLaEtapa(
  hechos: ReadonlyMap<string, HechoPorCliente>,
  clave: string,
): HechoPorCliente | null {
  return hechos.get(PREFIJO + clave) ?? null
}

export async function marcarEtapa(datos: {
  clienteId: number
  clave: string
  usuarioId: number
}): Promise<Resultado> {
  if (!ETAPAS.some((e) => e.clave === datos.clave)) {
    return { ok: false, error: `«${datos.clave}» no es una etapa del programa.` }
  }
  await escribirDevolviendo(
    `insert into hitos_clave (cliente_id, clave, usuario_id) values ($1, $2, $3)
     on conflict (cliente_id, clave) do update set usuario_id = excluded.usuario_id
     returning id`,
    [datos.clienteId, PREFIJO + datos.clave, datos.usuarioId],
  )
  return { ok: true }
}

export async function desmarcarEtapa(clienteId: number, clave: string): Promise<Resultado> {
  await escribir(
    'delete from hitos_clave where cliente_id = $1 and clave = $2',
    [clienteId, PREFIJO + clave],
    { esperadas: 'cualquiera' },
  )
  return { ok: true }
}

/**
 * Lo marcado de TODA la cartera, de una sola consulta.
 *
 * La lista de clientes necesita saber en qué va cada uno, y pedirlo cliente por
 * cliente serían ciento noventa y cuatro consultas para dibujar una pantalla.
 */
export async function marcadasDeLaCartera(): Promise<Map<number, Set<string>>> {
  const todo = await filas<{ cliente_id: number; clave: string }>(
    'select cliente_id, clave from hitos_clave',
  )
  const salida = new Map<number, Set<string>>()
  for (const { cliente_id, clave } of todo) {
    const suyas = salida.get(cliente_id) ?? new Set<string>()
    suyas.add(clave.startsWith(PREFIJO) ? clave.slice(PREFIJO.length) : clave)
    salida.set(cliente_id, suyas)
  }
  return salida
}
