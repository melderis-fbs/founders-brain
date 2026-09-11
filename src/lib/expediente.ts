import { CAMPOS, ETIQUETA_DOCUMENTO, ETIQUETA_GRUPO, type Grupo, type TipoDocumento } from './campos'
import { documentosDe, fuentesDeLaCartera, traerCliente } from './clientes'
import type { Alcance } from './permisos'
import { filas } from './db'
import { evaluarHitos } from './hitos'
import { semanaEnLaQueVa, textoDeSemana } from './programa'
import { semaforoDe } from './semaforo'

/**
 * El expediente de un cliente, en texto, para mandárselo al modelo.
 *
 * Dos decisiones sobre el tamaño, las dos deliberadas:
 *
 *  - **Tiene tope.** Mandar todos los documentos de un cliente son decenas de
 *    miles de palabras por pregunta, y eso se paga en plata y en segundos de
 *    espera. Entra lo que entra, de lo más nuevo a lo más viejo.
 *  - **Se dice qué quedó afuera.** Un expediente que en silencio incluye tres
 *    de once documentos es un expediente en el que nadie puede confiar: la
 *    respuesta parecería completa y no lo estaría.
 */

const TOPE_CARACTERES = 60_000

export type Expediente = {
  nombre: string
  texto: string
  incluidos: string[]
  omitidos: string[]
  caracteres: number
}

/**
 * El expediente del cliente: la ficha, la comparación y los documentos.
 *
 * Con `soloDocumento` entra uno solo. Eso es lo que se usa para completar la
 * ficha leyendo un documento a la vez: la cita queda atada a un documento
 * conocido, el modelo no mezcla lo que dijo en la venta con lo que escribió en
 * el onboarding, y cada tipo se lee con el criterio que le corresponde.
 */
export async function armarExpediente(
  clienteId: number,
  alcance: Alcance,
  soloDocumento?: number,
): Promise<Expediente | null> {
  const cliente = await traerCliente(clienteId, alcance)
  if (!cliente) return null

  const [todosLosDocumentos, conDatos] = await Promise.all([documentosDe(clienteId), fuentesDeLaCartera()])
  const documentos = soloDocumento === undefined
    ? todosLosDocumentos
    : todosLosDocumentos.filter((d) => d.id === soloDocumento)
  const inicio = cliente.valores.fecha_inicio as string
  const evaluados = evaluarHitos({
    semana: semanaEnLaQueVa(inicio),
    valores: cliente.valores,
    tiposDeDocumento: new Set(todosLosDocumentos.map((d) => d.tipo)),
    conDatos,
  })
  const semaforo = semaforoDe(evaluados)

  const partes: string[] = []
  partes.push(`# ${cliente.nombre}`)
  partes.push(
    `Consultora: ${cliente.consultora ?? 'sin asignar'}\n` +
    `Va en: ${textoDeSemana(inicio, cliente.valores.programa_meses as number)}\n` +
    `Cómo va: ${semaforo.palabra} — ${semaforo.porque}`,
  )

  // ── La ficha, bloque por bloque, diciendo qué falta ────────────────────────
  partes.push('\n## La ficha')
  const grupos = [...new Set(CAMPOS.map((c) => c.grupo))] as Grupo[]
  for (const grupo of grupos) {
    const lineas = CAMPOS.filter((c) => c.grupo === grupo).map((campo) => {
      const valor = cliente.valores[campo.clave]
      const vacio = valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '')
      return `- ${campo.etiqueta}: ${vacio ? 'NO CARGADO' : String(valor)}`
    })
    partes.push(`\n### ${ETIQUETA_GRUPO[grupo]}\n${lineas.join('\n')}`)
  }

  // ── La comparación con lo esperado ─────────────────────────────────────────
  partes.push('\n## Lo que tendría que estar hecho, y lo que está')
  for (const e of evaluados) {
    const estado = e.estado === 'hecho' ? 'hecho'
      : e.estado === 'falta' ? `FALTA hace ${e.atrasoEnSemanas} semanas`
      : e.estado === 'todavia_no' ? 'todavía no le toca'
      : `SIN DATOS (${e.porQueNoSeSabe})`
    partes.push(`- semana ${e.hito.semana} · ${e.hito.etiqueta}${e.hito.bloquea ? ' (bloquea lo que sigue)' : ''}: ${estado}`)
  }

  // ── Los documentos, de lo más nuevo a lo más viejo, hasta el tope ──────────
  const incluidos: string[] = []
  const omitidos: string[] = []
  let usados = partes.join('\n').length

  partes.push('\n## Documentos del cliente')
  for (const d of documentos) {
    const encabezado = `\n### ${ETIQUETA_DOCUMENTO[d.tipo as TipoDocumento] ?? d.tipo} — ${d.titulo}${d.fecha ? ` (${d.fecha})` : ''}\n`
    if (usados + d.caracteres + encabezado.length > TOPE_CARACTERES) {
      omitidos.push(`${d.titulo} (${d.caracteres.toLocaleString('es-AR')} caracteres)`)
      continue
    }
    const [fila] = await filas<{ texto: string | null }>('select texto from documentos where id = $1', [d.id])
    if (!fila?.texto) continue
    partes.push(encabezado + fila.texto.trim())
    usados += encabezado.length + fila.texto.length
    incluidos.push(d.titulo)
  }
  if (documentos.length === 0) partes.push('\nNo hay ningún documento cargado de este cliente.')

  if (omitidos.length > 0) {
    partes.push(`\n(No entraron por tamaño: ${omitidos.join(', ')}.)`)
  }

  const texto = partes.join('\n')
  return { nombre: cliente.nombre, texto, incluidos, omitidos, caracteres: texto.length }
}
