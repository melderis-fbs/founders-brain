import Papa from 'papaparse'
import type { PoolClient } from 'pg'
import { CAMPOS, CAMPOS_POR_CLAVE, ETIQUETA_DOCUMENTO, type Campo, type TipoDocumento } from '../campos'
import { ALIAS_TABLA, anotarOrigen, camposEscritosPorPersonas, leerCampo } from '../campos-escritura'
import { conPuntoDeRetorno, enTransaccion, escribir, escribirDevolviendo, filas } from '../db'
import { clave as claveDeNombre, plegado } from '../texto'
import { leerTexto, leerTextoLargo } from '../valores'
import { mapearEncabezados, type Mapeo } from './mapeo'

/**
 * La importación de la planilla madre.
 *
 * Las reglas que manda este archivo:
 *  1 · celda vacía no es cero, y no pisa lo que ya había,
 *  3 · el cliente se busca por nombre exacto; un parecido se informa y no entra,
 *  7 · volver a importar corrige, no duplica,
 *  8 · toda escritura verifica cuántas filas tocó,
 * 10 · lo que se saltea se informa con su motivo y su número de fila.
 */

export type ResultadoFila = 'nuevo' | 'actualizado' | 'sin_cambios' | 'omitida'

export type FilaDelReporte = {
  nroFila: number
  clienteNombre: string | null
  clienteId: number | null
  resultado: ResultadoFila
  motivo: string | null
  avisos: string[]
}

export type Reporte = {
  importacionId: number
  archivo: string
  filasLeidas: number
  nuevos: number
  actualizados: number
  sinCambios: number
  omitidas: number
  columnasIgnoradas: string[]
  errorGeneral: string | null
  filas: FilaDelReporte[]
}

/** Todos los campos menos los dos que se resuelven aparte. */
const CAMPOS_DIRECTOS = CAMPOS.filter((c) => c.clave !== 'nombre' && c.clave !== 'consultora')

type ClienteExistente = {
  id: number
  ref_externa: string | null
  nombre: string
  nombre_clave: string
  nombre_pleg: string
  consultora_id: number | null
} & Record<string, unknown>

/** ¿El valor que trae la planilla dice algo distinto de lo que ya está guardado? */
function esDistinto(guardado: unknown, nuevo: unknown): boolean {
  if (guardado === null || guardado === undefined) return true
  if (typeof nuevo === 'number') return Number(guardado) !== nuevo
  if (typeof nuevo === 'boolean') return Boolean(guardado) !== nuevo
  return String(guardado) !== String(nuevo)
}

function mensajeDeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

// ── El trabajo ───────────────────────────────────────────────────────────────
export async function importarCsv(opciones: {
  contenido: string
  archivo: string
  usuarioId: number | null
}): Promise<Reporte> {
  const { contenido, archivo, usuarioId } = opciones

  const importacion = await escribirDevolviendo<{ id: number }>(
    `insert into importaciones (usuario_id, archivo, origen) values ($1, $2, 'csv') returning id`,
    [usuarioId, archivo],
  )
  const importacionId = importacion.id

  const vacio: Reporte = {
    importacionId, archivo, filasLeidas: 0, nuevos: 0, actualizados: 0, sinCambios: 0,
    omitidas: 0, columnasIgnoradas: [], errorGeneral: null, filas: [],
  }

  const parseado = Papa.parse<Record<string, string>>(contenido, {
    header: true,
    skipEmptyLines: false,
    transformHeader: (h) => h.replace(/^﻿/, '').trim(),
  })

  const encabezados = (parseado.meta.fields ?? []).filter((h) => h !== '')
  if (encabezados.length === 0) {
    return terminarConError(vacio, 'El archivo no tiene encabezados. La primera fila tiene que ser la de los títulos de las columnas.')
  }

  const mapeo = mapearEncabezados(encabezados)
  vacio.columnasIgnoradas = mapeo.ignoradas

  const columnaNombre = mapeo.campos.get('nombre')
  if (!columnaNombre) {
    return terminarConError(
      vacio,
      `Ninguna columna del archivo dice el nombre del cliente. Renombrá una columna a "nombre". ` +
        `Las columnas que traía el archivo: ${encabezados.join(', ')}.`,
    )
  }

  try {
    const resultado = await enTransaccion(async (cli) => procesarFilas(cli, {
      registros: parseado.data,
      encabezados,
      mapeo,
      columnaNombre,
      importacionId,
    }))

    const reporte: Reporte = { ...vacio, ...resultado }
    await escribir(
      `update importaciones
          set filas_leidas = $2, clientes_nuevos = $3, clientes_actualizados = $4,
              filas_sin_cambios = $5, filas_omitidas = $6, columnas_ignoradas = $7
        where id = $1`,
      [importacionId, reporte.filasLeidas, reporte.nuevos, reporte.actualizados,
       reporte.sinCambios, reporte.omitidas, mapeo.ignoradas],
    )
    return reporte
  } catch (error) {
    return terminarConError(vacio, `No se aplicó nada: ${mensajeDeError(error)}`)
  }
}

async function terminarConError(reporte: Reporte, mensaje: string): Promise<Reporte> {
  await escribir(
    `update importaciones set error_general = $2, columnas_ignoradas = $3 where id = $1`,
    [reporte.importacionId, mensaje, reporte.columnasIgnoradas],
  )
  return { ...reporte, errorGeneral: mensaje }
}

async function procesarFilas(
  cli: PoolClient,
  ctx: {
    registros: Record<string, string>[]
    encabezados: string[]
    mapeo: Mapeo
    columnaNombre: string
    importacionId: number
  },
): Promise<Pick<Reporte, 'filasLeidas' | 'nuevos' | 'actualizados' | 'sinCambios' | 'omitidas' | 'filas'>> {
  const { registros, encabezados, mapeo, columnaNombre, importacionId } = ctx

  // Todo lo que ya está cargado, de una sola vez. Los textos de los documentos
  // no se traen: no hacen falta acá y no viajan por gusto.
  const seleccion = [
    'c.id', 'c.ref_externa', 'c.nombre', 'c.nombre_clave', 'c.nombre_pleg', 'c.consultora_id',
    ...CAMPOS_DIRECTOS.map((campo) => `${ALIAS_TABLA[campo.tabla]}.${campo.columna} as "${campo.clave}"`),
  ].join(', ')

  const existentes = await filas<ClienteExistente>(
    `select ${seleccion}
       from clientes c
       left join cliente_negocio n on n.cliente_id = c.id
       left join cliente_numeros m on m.cliente_id = c.id
       left join cliente_comercial k on k.cliente_id = c.id
       left join cliente_autoridad a on a.cliente_id = c.id
       left join cliente_intentos i on i.cliente_id = c.id`,
    [],
    cli,
  )

  const porClave = new Map(existentes.map((c) => [c.nombre_clave, c]))
  const porPleg = new Map<string, ClienteExistente>()
  for (const c of existentes) if (!porPleg.has(c.nombre_pleg)) porPleg.set(c.nombre_pleg, c)
  const porRef = new Map(existentes.filter((c) => c.ref_externa).map((c) => [c.ref_externa as string, c]))

  const consultoras = await filas<{ id: number; nombre: string; nombre_pleg: string }>(
    'select id, nombre, nombre_pleg from consultoras', [], cli,
  )
  const consultorasPorPleg = new Map(consultoras.map((c) => [c.nombre_pleg, c]))

  // Qué datos corrigió alguien a mano en la ficha. La planilla los puede pisar
  // —es la fuente— pero nunca en silencio: se avisa fila por fila.
  const aMano = await camposEscritosPorPersonas(cli)

  // Para no aplicar dos filas del mismo archivo al mismo cliente.
  const vistosEnArchivo = new Map<string, number>()   // nombre_clave -> nro de fila
  const plegadosEnArchivo = new Map<string, { nroFila: number; nombre: string }>()

  const reporte: FilaDelReporte[] = []
  let filasLeidas = 0

  for (let i = 0; i < registros.length; i++) {
    const bruto = registros[i]
    const nroFila = i + 2 // la fila 1 de la planilla es la de los encabezados
    if (!bruto || encabezados.every((h) => (bruto[h] ?? '').trim() === '')) continue
    filasLeidas++

    const salida = await conPuntoDeRetorno(cli, `fila_${i}`, () =>
      procesarUnaFila(cli, {
        bruto, nroFila, mapeo, columnaNombre, aMano,
        porClave, porPleg, porRef, consultorasPorPleg, vistosEnArchivo, plegadosEnArchivo,
      }),
    )

    const fila: FilaDelReporte = salida.ok
      ? salida.valor
      : {
          nroFila,
          clienteNombre: (bruto[columnaNombre] ?? '').trim() || null,
          clienteId: null,
          resultado: 'omitida',
          motivo: mensajeDeError(salida.error),
          avisos: [],
        }
    reporte.push(fila)
  }

  await guardarReporte(cli, importacionId, reporte)

  return {
    filasLeidas,
    nuevos: reporte.filter((f) => f.resultado === 'nuevo').length,
    actualizados: reporte.filter((f) => f.resultado === 'actualizado').length,
    sinCambios: reporte.filter((f) => f.resultado === 'sin_cambios').length,
    omitidas: reporte.filter((f) => f.resultado === 'omitida').length,
    filas: reporte,
  }
}

/**
 * El reporte se guarda por tandas y no fila por fila.
 *
 * Contra Supabase cada ida y vuelta cuesta decenas de milisegundos, y 200
 * inserciones sueltas son 200 idas y vueltas de más. Con la cartera entera eso
 * es la diferencia entre importar y quedarse sin tiempo.
 */
async function guardarReporte(cli: PoolClient, importacionId: number, filasDelReporte: FilaDelReporte[]) {
  const TANDA = 500
  for (let i = 0; i < filasDelReporte.length; i += TANDA) {
    const tanda = filasDelReporte.slice(i, i + TANDA)
    await escribir(
      `insert into importacion_filas (importacion_id, nro_fila, cliente_nombre, cliente_id, resultado, motivo, avisos)
       select $1, f.nro_fila, f.cliente_nombre, f.cliente_id, f.resultado, f.motivo, f.avisos
         from jsonb_to_recordset($2::jsonb)
           as f(nro_fila int, cliente_nombre text, cliente_id bigint, resultado text, motivo text, avisos text[])`,
      [importacionId, JSON.stringify(tanda.map((f) => ({
        nro_fila: f.nroFila,
        cliente_nombre: f.clienteNombre,
        cliente_id: f.clienteId,
        resultado: f.resultado,
        motivo: f.motivo,
        avisos: f.avisos,
      })))],
      { esperadas: tanda.length, cliente: cli },
    )
  }
}

async function procesarUnaFila(
  cli: PoolClient,
  ctx: {
    bruto: Record<string, string>
    nroFila: number
    mapeo: Mapeo
    columnaNombre: string
    aMano: Set<string>
    porClave: Map<string, ClienteExistente>
    porPleg: Map<string, ClienteExistente>
    porRef: Map<string, ClienteExistente>
    consultorasPorPleg: Map<string, { id: number; nombre: string; nombre_pleg: string }>
    vistosEnArchivo: Map<string, number>
    plegadosEnArchivo: Map<string, { nroFila: number; nombre: string }>
  },
): Promise<FilaDelReporte> {
  const { bruto, nroFila, mapeo, columnaNombre, aMano, porClave, porPleg, porRef,
          consultorasPorPleg, vistosEnArchivo, plegadosEnArchivo } = ctx

  const omitir = (motivo: string, nombre: string | null = null): FilaDelReporte => ({
    nroFila, clienteNombre: nombre, clienteId: null, resultado: 'omitida', motivo, avisos: [],
  })

  // ── 1 · Quién es ───────────────────────────────────────────────────────────
  const lecturaNombre = leerTexto(bruto[columnaNombre])
  if (lecturaNombre.estado !== 'ok') {
    return omitir('La fila no trae el nombre del cliente, así que no hay a quién aplicarla.')
  }
  const nombre = lecturaNombre.valor
  const nombreClave = claveDeNombre(nombre)
  const nombrePleg = plegado(nombre)

  const lecturaRef = mapeo.columnaRef ? leerTexto(bruto[mapeo.columnaRef]) : ({ estado: 'vacio' } as const)
  const ref = lecturaRef.estado === 'ok' ? lecturaRef.valor : null

  const repetidaEnArchivo = vistosEnArchivo.get(nombreClave)
  if (repetidaEnArchivo !== undefined) {
    return omitir(`La fila ${repetidaEnArchivo} de este mismo archivo ya trae a «${nombre}». Dejé la primera y no apliqué esta.`, nombre)
  }

  let existente = ref ? porRef.get(ref) : undefined

  if (!existente) {
    const porNombre = porClave.get(nombreClave)
    if (porNombre) {
      if (ref && porNombre.ref_externa && porNombre.ref_externa !== ref) {
        return omitir(
          `«${nombre}» ya está cargado con el id «${porNombre.ref_externa}» y esta fila trae el id «${ref}». ` +
            `No adivino cuál de los dos es: corregí el id en la planilla.`,
          nombre,
        )
      }
      existente = porNombre
    }
  }

  // Regla 3: nunca adivinar el cliente por parecido de nombre.
  // Primero se mira el mismo archivo, porque ahí el aviso puede decir qué fila
  // hay que corregir, que es lo único que le sirve a alguien para arreglarlo.
  if (!existente) {
    const parecidaEnArchivo = plegadosEnArchivo.get(nombrePleg)
    if (parecidaEnArchivo) {
      return omitir(
        `La fila ${parecidaEnArchivo.nroFila} de este mismo archivo trae «${parecidaEnArchivo.nombre}», ` +
          `que se escribe igual salvo acentos o mayúsculas. No los doy por la misma persona: corregí uno de los dos nombres.`,
        nombre,
      )
    }
    const parecido = porPleg.get(nombrePleg)
    if (parecido) {
      return omitir(
        `Ya existe «${parecido.nombre}», que se escribe igual salvo acentos o mayúsculas. ` +
          `No los doy por la misma persona. Corregí el nombre en la planilla, o agregá la columna id_cliente para que no dependa del nombre.`,
        nombre,
      )
    }
  }

  // ── 2 · Qué dice la fila ───────────────────────────────────────────────────
  const avisos: string[] = []
  const valores = new Map<string, unknown>()

  for (const campo of CAMPOS_DIRECTOS) {
    const columna = mapeo.campos.get(campo.clave)
    if (!columna) continue
    const lectura = leerCampo(campo, bruto[columna])
    if (lectura.estado === 'vacio') continue                      // regla 1: vacío no pisa
    if (lectura.estado === 'error') {                             // regla 10
      avisos.push(`${campo.etiqueta}: ${lectura.motivo}. Ese dato quedó como estaba.`)
      continue
    }
    valores.set(campo.clave, lectura.valor)
  }

  // La consultora llega por nombre y se resuelve a una fila.
  let consultoraId: number | null = null
  let cambiaConsultora = false
  const columnaConsultora = mapeo.campos.get('consultora')
  if (columnaConsultora) {
    const lectura = leerTexto(bruto[columnaConsultora])
    if (lectura.estado === 'ok') {
      const pleg = plegado(lectura.valor)
      let consultora = consultorasPorPleg.get(pleg)
      if (!consultora) {
        const creada = await escribirDevolviendo<{ id: number }>(
          'insert into consultoras (nombre, nombre_pleg) values ($1, $2) returning id',
          [lectura.valor, pleg],
          cli,
        )
        consultora = { id: creada.id, nombre: lectura.valor, nombre_pleg: pleg }
        consultorasPorPleg.set(pleg, consultora)
        avisos.push(`Consultora nueva: «${lectura.valor}». Si es un error de tipeo, corregilo en la planilla y volvé a subir.`)
      }
      consultoraId = consultora.id
      cambiaConsultora = !existente || existente.consultora_id !== consultora.id
    }
  }

  // ── 3 · Qué cambia de verdad ───────────────────────────────────────────────
  const cambios = [...valores.entries()].filter(([clave, valor]) => !existente || esDistinto(existente[clave], valor))
  const cambiaNombre = Boolean(existente) && existente!.nombre !== nombre
  const cambiaRef = Boolean(existente) && ref !== null && existente!.ref_externa !== ref

  // ── 4 · Escribir ───────────────────────────────────────────────────────────
  let clienteId: number
  if (!existente) {
    const columnasCliente = cambios.filter(([clave]) => campoDe(clave).tabla === 'clientes')
    const nombresColumnas = ['nombre', 'nombre_clave', 'nombre_pleg', 'ref_externa', 'consultora_id',
      ...columnasCliente.map(([clave]) => campoDe(clave).columna)]
    const parametros: unknown[] = [nombre, nombreClave, nombrePleg, ref, consultoraId,
      ...columnasCliente.map(([, valor]) => valor)]
    const marcas = parametros.map((_, i) => `$${i + 1}`)
    const creado = await escribirDevolviendo<{ id: number }>(
      `insert into clientes (${nombresColumnas.join(', ')}) values (${marcas.join(', ')}) returning id`,
      parametros,
      cli,
    )
    clienteId = creado.id
  } else {
    clienteId = existente.id
    const asignaciones: string[] = []
    const parametros: unknown[] = [clienteId]
    const agregar = (columna: string, valor: unknown) => {
      parametros.push(valor)
      asignaciones.push(`${columna} = $${parametros.length}`)
    }
    if (cambiaNombre) {
      agregar('nombre', nombre)
      agregar('nombre_clave', nombreClave)
      agregar('nombre_pleg', nombrePleg)
    }
    if (cambiaRef) agregar('ref_externa', ref)
    if (cambiaConsultora && consultoraId !== null) agregar('consultora_id', consultoraId)
    for (const [clave, valor] of cambios) {
      const campo = campoDe(clave)
      if (campo.tabla === 'clientes') agregar(campo.columna, valor)
    }
    if (asignaciones.length > 0) {
      await escribir(
        `update clientes set ${asignaciones.join(', ')}, actualizado_en = now() where id = $1`,
        parametros, { esperadas: 1, cliente: cli },
      )
    }
  }

  // Los bloques de la ficha: se tocan sólo las columnas que la fila trae.
  for (const tabla of ['cliente_negocio', 'cliente_numeros', 'cliente_comercial', 'cliente_autoridad', 'cliente_intentos'] as const) {
    const delBloque = cambios.filter(([clave]) => campoDe(clave).tabla === tabla)
    if (delBloque.length === 0) continue
    const columnas = delBloque.map(([clave]) => campoDe(clave).columna)
    const parametros = [clienteId, ...delBloque.map(([, valor]) => valor)]
    const marcas = parametros.map((_, i) => `$${i + 1}`)
    await escribir(
      `insert into ${tabla} (cliente_id, ${columnas.join(', ')}) values (${marcas.join(', ')})
       on conflict (cliente_id) do update set ${columnas.map((c) => `${c} = excluded.${c}`).join(', ')}`,
      parametros, { esperadas: 1, cliente: cli },
    )
  }

  // Regla 10, también acá: si la planilla cambia un dato que alguien había
  // corregido en la ficha, el reporte lo dice. La planilla manda, pero no calla.
  for (const [clave] of cambios) {
    if (aMano.has(`${clienteId}:${clave}`)) {
      const campo = campoDe(clave)
      avisos.push(`${campo.etiqueta}: la planilla pisó lo que alguien había corregido a mano en la ficha.`)
    }
  }

  // De dónde salió cada dato que se escribió.
  const clavesEscritas = cambios.map(([clave]) => clave)
  if (cambiaNombre) clavesEscritas.push('nombre')
  if (cambiaConsultora) clavesEscritas.push('consultora')
  await anotarOrigen(clavesEscritas, { clienteId, origen: 'planilla' }, cli)

  // ── 5 · Los textos que la planilla trae en columnas ────────────────────────
  let cambiaAlgunDocumento = false
  for (const [tipo, columna] of mapeo.documentos) {
    const lectura = leerTextoLargo(bruto[columna])
    if (lectura.estado !== 'ok') continue
    const texto = lectura.valor
    // Regla 7: un documento por (cliente, tipo) para lo que viene de la planilla.
    // Devuelve fila sólo si el texto cambió, así el reporte no dice «actualizado»
    // cuando no se movió nada.
    const r = await cli.query(
      `insert into documentos (cliente_id, tipo, titulo, texto, caracteres, origen)
       values ($1, $2, $3, $4, $5, 'planilla')
       on conflict (cliente_id, tipo) where origen = 'planilla'
       do update set texto = excluded.texto, caracteres = excluded.caracteres, titulo = excluded.titulo
       where documentos.texto is distinct from excluded.texto
       returning id`,
      [clienteId, tipo, ETIQUETA_DOCUMENTO[tipo as TipoDocumento], texto, texto.length],
    )
    if ((r.rowCount ?? 0) > 0) cambiaAlgunDocumento = true
  }

  // ── 6 · Anotar y contar ────────────────────────────────────────────────────
  vistosEnArchivo.set(nombreClave, nroFila)
  plegadosEnArchivo.set(nombrePleg, { nroFila, nombre })

  const registro: ClienteExistente = {
    ...(existente ?? ({} as ClienteExistente)),
    id: clienteId,
    ref_externa: ref ?? existente?.ref_externa ?? null,
    nombre,
    nombre_clave: nombreClave,
    nombre_pleg: nombrePleg,
    consultora_id: consultoraId ?? existente?.consultora_id ?? null,
  }
  for (const [clave, valor] of valores) registro[clave] = valor
  porClave.set(nombreClave, registro)
  porPleg.set(nombrePleg, registro)
  if (registro.ref_externa) porRef.set(registro.ref_externa, registro)

  const hubo = cambios.length > 0 || cambiaNombre || cambiaRef || cambiaConsultora || cambiaAlgunDocumento
  return {
    nroFila,
    clienteNombre: nombre,
    clienteId,
    resultado: !existente ? 'nuevo' : hubo ? 'actualizado' : 'sin_cambios',
    motivo: null,
    avisos,
  }
}

function campoDe(clave: string): Campo {
  const campo = CAMPOS_POR_CLAVE.get(clave)
  if (!campo) throw new Error(`Campo desconocido: ${clave}`)
  return campo
}
