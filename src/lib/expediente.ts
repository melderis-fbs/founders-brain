import { CAMPOS, ETIQUETA_DOCUMENTO, ETIQUETA_GRUPO, type Grupo, type TipoDocumento } from './campos'
import { banderaDe } from './banderas'
import { QUE_DICE } from './banderas-tipos'
import { loQueNoSeSostiene } from './campos-escritura'
import { estadoDeLasFases, hechosDe } from './hitos-clave'
import { ETAPAS, nombreDeEtapa } from './modulos'
import { notasDe } from './notas'
import { cambiosDeCoach } from './usuarios'
import { fuentesDeLaCartera, traerCliente } from './clientes'
import { documentosResumidos } from './documentos'
import { leerElCaso } from './lectura'
import { hayAlgunaSesionEnLaCartera, listarSesiones, sesionesConAnalisis } from './sesiones'
import type { Alcance } from './permisos'
import { filas } from './db'
import { evaluarHitos } from './hitos'
import { semanaEnLaQueVa, textoDeSemana } from './programa'
import { semaforoDe } from './semaforo'

/**
 * El expediente de un cliente, en texto, para mandárselo al modelo.
 *
 * Adentro va TODO lo que se sabe del cliente: la ficha, la lectura hecha con
 * aritmética, la comparación etapa por etapa, todos los documentos, todas las
 * sesiones y lo que cambió de opinión por el camino.
 *
 * Que entren todos los documentos es posible por los resúmenes. El texto
 * completo de once documentos no entra en ningún tope razonable, así que antes
 * entraban los más nuevos y el resto se informaba como omitido: el diagnóstico
 * no los había visto. Un resumen de cinco renglones entra siempre, así que
 * ahora entran los once. El texto crudo se manda sólo del que todavía no fue
 * resumido, y sólo si hay lugar.
 *
 * Y se sigue diciendo qué quedó afuera: un expediente que en silencio incluye
 * tres de once es uno en el que nadie puede confiar.
 */

const TOPE_CARACTERES = 60_000

export type Expediente = {
  nombre: string
  texto: string
  incluidos: string[]
  omitidos: string[]
  /** Documentos que entraron sólo por su resumen, sin el texto completo. */
  porResumen: string[]
  /** Documentos que todavía nadie leyó: no tienen resumen y no entró su texto. */
  sinLeer: string[]
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

  const [todosLosDocumentos, conDatos, sesiones, enLista, haySesiones, noSeSostiene,
         bandera, notas, cambios, hechos] = await Promise.all([
    documentosResumidos(clienteId),
    fuentesDeLaCartera(),
    sesionesConAnalisis(clienteId),
    listarSesiones(clienteId),
    hayAlgunaSesionEnLaCartera(),
    loQueNoSeSostiene(clienteId),
    banderaDe(clienteId),
    notasDe(clienteId),
    cambiosDeCoach(clienteId),
    hechosDe(clienteId),
  ])
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
  const lectura = leerElCaso({
    hitos: evaluados,
    valores: cliente.valores,
    sesiones: enLista,
    hayAlgunaSesionEnLaCartera: haySesiones,
    hayDiagnostico: false,
  })

  const partes: string[] = []
  partes.push(`# ${cliente.nombre}`)
  partes.push(
    `Consultora: ${cliente.consultora ?? 'sin asignar'}\n` +
    `Va en: ${textoDeSemana(inicio, cliente.valores.programa_meses as number)}\n` +
    `Cómo va: ${semaforo.palabra} — ${semaforo.porque}`,
  )

  // ── La ficha, bloque por bloque, diciendo qué falta ────────────────────────
  // La bandera va antes que todo lo demás. Es lo único del expediente que no
  // se calcula: lo sabe una persona que estuvo en la sesión, y muchas veces es
  // lo que explica todo lo que sigue.
  if (bandera) {
    partes.push('\n## BANDERA LEVANTADA')
    partes.push(
      `${QUE_DICE[bandera.color]}. La levantó ${bandera.puesta_por_nombre ?? 'alguien del equipo'} ` +
      `el ${bandera.puesta_en.slice(0, 10)}: «${bandera.motivo}»`,
    )
    partes.push(
      'Esto no sale de ningún dato: lo escribió una persona que habló con el cliente. ' +
      'Si lo que dice acá contradice lo que muestran los números, la bandera tiene razón y los números están viejos.',
    )
  }

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

  // ── El programa: en qué fase va y qué quedó hecho ─────────────────────────
  partes.push('\n## El programa')
  const semanaHoy = semanaEnLaQueVa(inicio)
  for (const { fase, estado, hechos: cuantos, total, porque } of estadoDeLasFases(semanaHoy, new Set(hechos.keys()))) {
    const etapas = ETAPAS.filter((e) => e.fase === fase.numero).map(nombreDeEtapa).join(', ')
    partes.push(`\n### Fase ${fase.numero} · ${fase.periodo} · ${estado.replace('_', ' ')}`)
    partes.push(`Se trabaja: ${etapas}.`)
    partes.push(porque)
    for (const h of fase.hitosClave) {
      const marcado = hechos.get(h.clave)
      partes.push(
        `- ${h.etiqueta}${h.cuando ? ` (se espera ${h.cuando})` : ''}: ` +
        (marcado ? `hecho, marcado el ${marcado.hecho_en}` : 'SIN MARCAR'),
      )
    }
  }
  partes.push(
    '\nOJO: «SIN MARCAR» quiere decir que nadie lo marcó, que no es lo mismo que que no haya pasado. ' +
    'Estos hitos los marca la consultora a mano.',
  )

  // ── La comparación con lo esperado ─────────────────────────────────────────
  partes.push('\n## Lo que tendría que estar hecho, y lo que está')
  for (const e of evaluados) {
    const estado = e.estado === 'hecho' ? 'hecho'
      : e.estado === 'falta' ? `FALTA hace ${e.atrasoEnSemanas} semanas`
      : e.estado === 'esta_semana' ? 'ES DE ESTA SEMANA (todavía está a tiempo, no es un atraso)'
      : e.estado === 'todavia_no' ? 'todavía no le toca'
      : `SIN DATOS (${e.porQueNoSeSabe})`
    partes.push(`- semana ${e.hito.semana} · ${e.hito.etiqueta}${e.hito.bloquea ? ' (bloquea lo que sigue)' : ''}: ${estado}`)
  }

  // ── La lectura hecha con aritmética ───────────────────────────────────────
  //
  // Va ANTES que los documentos a propósito: es lo único de todo esto que se
  // sabe con certeza, sin interpretación de nadie. El modelo tiene que partir
  // de ahí y no volver a calcularlo, que es donde se equivoca.
  partes.push('\n## La lectura del caso, hecha con aritmética')
  partes.push(lectura.titular)
  for (const parte of lectura.partes) {
    partes.push(
      parte.estado === 'medido'
        ? `- ${parte.etiqueta} (pesa ${parte.peso}%): ${parte.valor} de 100. ${parte.detalle}`
        : `- ${parte.etiqueta} (pesa ${parte.peso}%): SIN DATOS, no opina. ${parte.porque}.`,
    )
  }
  partes.push(
    lectura.puntaje === null
      ? 'Total: no se puede calcular, no hay nada medible cargado.'
      : `Total: ${lectura.puntaje} de 100, sobre el ${lectura.cobertura}% de la información. Lo que está sin datos no cuenta como cero.`,
  )

  // ── Los documentos: TODOS, por su resumen ─────────────────────────────────
  const incluidos: string[] = []
  const omitidos: string[] = []
  const porResumen: string[] = []
  const sinLeer: string[] = []
  let usados = partes.join('\n').length

  partes.push('\n## Documentos del cliente')
  if (documentos.length === 0) partes.push('\nNo hay ningún documento cargado de este cliente.')

  for (const d of documentos) {
    const que = `${ETIQUETA_DOCUMENTO[d.tipo as TipoDocumento] ?? d.tipo} — ${d.titulo}${d.fecha ? ` (${d.fecha})` : ''}`
    const encabezado = `\n### ${que}\n`

    if (d.resumen) {
      partes.push(`${encabezado}${d.resumen.trim()}`)
      usados += encabezado.length + d.resumen.length
      incluidos.push(d.titulo)
      porResumen.push(d.titulo)
      continue
    }

    // Sin resumen todavía: entra el texto completo si hay lugar.
    if (usados + d.caracteres + encabezado.length > TOPE_CARACTERES) {
      omitidos.push(`${d.titulo} (${d.caracteres.toLocaleString('es-AR')} caracteres, todavía sin resumir)`)
      sinLeer.push(d.titulo)
      continue
    }
    const [fila] = await filas<{ texto: string | null }>('select texto from documentos where id = $1', [d.id])
    if (!fila?.texto) continue
    partes.push(encabezado + fila.texto.trim())
    usados += encabezado.length + fila.texto.length
    incluidos.push(d.titulo)
  }

  if (omitidos.length > 0) {
    partes.push(
      `\n(No entraron por tamaño y todavía nadie los resumió: ${omitidos.join(', ')}. ` +
      'Sobre esos documentos no se puede afirmar nada: no los viste.)',
    )
  }

  // ── Las sesiones y lo que salió de cada una ───────────────────────────────
  if (sesiones.length > 0) {
    partes.push('\n## Las sesiones')
    for (const ses of sesiones) {
      const cuando = ses.fecha ?? 'sin fecha'
      partes.push(`\n### Sesión ${ses.numero ?? '—'} · ${cuando} · ${ses.estado}`)
      if (ses.que_paso) partes.push(`Qué pasó: ${ses.que_paso}`)
      if (ses.puntos && ses.puntos.length > 0) {
        partes.push('Lo que salió:')
        for (const punto of ses.puntos) partes.push(`- ${punto}`)
      }
      if (ses.compromisos && ses.compromisos.length > 0) {
        partes.push('Se comprometió a:')
        for (const c of ses.compromisos) partes.push(`- ${c}`)
      }
      if (!ses.que_paso && (!ses.puntos || ses.puntos.length === 0)) {
        partes.push('Todavía no se analizó: no se sabe qué pasó en esta sesión.')
      }
    }
  }

  // ── Lo que cambió de opinión por el camino ────────────────────────────────
  //
  // Un campo que se reescribió cuatro veces no está mal cargado: está diciendo
  // que esa definición no cerró. Sin el historial eso es invisible, porque en
  // la ficha se ve una sola versión, la última, y parece firme.
  if (noSeSostiene.length > 0) {
    partes.push('\n## Lo que no se sostiene')
    partes.push('Campos que se reescribieron más de una vez. Cuántas veces cambió cada uno:')
    for (const c of noSeSostiene) {
      const etiqueta = CAMPOS.find((x) => x.clave === c.campo)?.etiqueta ?? c.campo
      partes.push(`- ${etiqueta}: cambió ${c.veces} ${c.veces === 1 ? 'vez' : 'veces'}, la última el ${c.ultimo.slice(0, 10)}`)
    }
  }

  // ── Lo que escribió la consultora entre sesiones ──────────────────────────
  if (notas.length > 0) {
    partes.push('\n## Notas de la consultora')
    partes.push('Lo que fue escribiendo entre sesiones, de lo más nuevo a lo más viejo.')
    for (const n of notas.slice(0, 20)) {
      partes.push(`- ${n.creado_en.slice(0, 10)} · ${n.quien ?? 'alguien'}: ${n.texto}`)
    }
  }

  // ── Por cuántas manos pasó ────────────────────────────────────────────────
  if (cambios.length > 0) {
    partes.push('\n## Cambios de consultora')
    partes.push('Un cliente que cambió de manos arranca de nuevo cada vez: eso explica atrasos que no son del cliente.')
    for (const c of cambios) {
      partes.push(`- ${c.creado_en.slice(0, 10)}: de ${c.de ?? 'nadie'} a ${c.a ?? 'nadie'}. Motivo: ${c.motivo}`)
    }
  }

  const texto = partes.join('\n')
  return { nombre: cliente.nombre, texto, incluidos, omitidos, porResumen, sinLeer, caracteres: texto.length }
}
