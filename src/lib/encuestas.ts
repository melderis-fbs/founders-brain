import { filas } from './db'
import { condicionDeAlcance, type Alcance } from './permisos'

/**
 * LAS ENCUESTAS DE SATISFACCIÓN DE TODA LA CARTERA
 *
 * Una encuesta sola dice si ese cliente está conforme. Leídas juntas dicen otra
 * cosa, que es la que nadie está mirando: qué se repite. Una queja dicha por una
 * persona es un caso; dicha por ocho es un problema nuestro.
 *
 * Esto junta los textos; el modelo busca los patrones, y sólo cuando alguien
 * aprieta el botón.
 */

export type EncuestaDeLaCartera = {
  id: number
  cliente_id: number
  cliente: string
  consultora: string | null
  titulo: string
  fecha: string | null
  caracteres: number
  texto: string | null
}

export async function encuestasDeLaCartera(alcance: Alcance, tope = 60): Promise<EncuestaDeLaCartera[]> {
  const suyo = condicionDeAlcance(alcance, 'c.consultora_id', 1)
  const parametros: unknown[] = suyo.parametro === null ? [] : [suyo.parametro]
  parametros.push(tope)

  return filas<EncuestaDeLaCartera>(
    `select d.id, d.cliente_id, c.nombre as cliente, co.nombre as consultora,
            d.titulo, d.fecha::text as fecha, d.caracteres, d.texto
       from documentos d
       join clientes c on c.id = d.cliente_id
       left join consultoras co on co.id = c.consultora_id
      where d.tipo = 'encuesta' and ${suyo.condicion}
      order by coalesce(d.fecha, d.creado_en::date) desc
      limit $${parametros.length}`,
    parametros,
  )
}

/**
 * El texto que se le manda al modelo, con quién dijo cada cosa.
 *
 * Va el nombre del cliente y su consultora porque un patrón que aparece sólo en
 * los clientes de una consultora no es un patrón del programa: es otra cosa, y
 * hay que poder verla.
 */
export function juntarEncuestas(encuestas: readonly EncuestaDeLaCartera[]): string {
  const partes = [`Hay ${encuestas.length} encuestas de satisfacción cargadas.\n`]
  for (const e of encuestas) {
    if (!e.texto || e.texto.trim() === '') continue
    partes.push(
      `\n### ${e.cliente}${e.consultora ? ` · consultora: ${e.consultora}` : ' · sin consultora'}` +
      `${e.fecha ? ` · ${e.fecha}` : ''}\n${e.texto.trim()}`,
    )
  }
  return partes.join('\n')
}

export function cuantasConTexto(encuestas: readonly EncuestaDeLaCartera[]): number {
  return encuestas.filter((e) => e.texto !== null && e.texto.trim() !== '').length
}
