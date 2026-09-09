import { CAMPOS, type Campo } from './campos'
import { fila, filas } from './db'

const ALIAS = { clientes: 'c', cliente_negocio: 'n', cliente_numeros: 'm', cliente_comercial: 'k' } as const

const CAMPOS_QUE_CUENTAN = CAMPOS.filter((c) => c.cuenta)

/**
 * En la lista no se traen los textos: sólo si el dato está o no está.
 * Un «oferta» de 900 caracteres no tiene nada que hacer en una fila que se
 * escanea, y multiplicado por 194 clientes es lo que hace lenta una pantalla.
 */
function seleccionDeTenencia(): string {
  return CAMPOS_QUE_CUENTAN.map((campo) => {
    // La consultora se guarda como id, no como texto: acá alcanza con que esté.
    if (campo.clave === 'consultora') return `(c.consultora_id is not null) as "tiene_consultora"`
    const columna = `${ALIAS[campo.tabla]}.${campo.columna}`
    const esTexto = campo.tipo === 'texto' || campo.tipo === 'texto_largo' || campo.tipo === 'opcion'
    const noVacio = esTexto
      ? `(${columna} is not null and ${columna} <> '')`
      : `(${columna} is not null)`
    return `${noVacio} as "tiene_${campo.clave}"`
  }).join(', ')
}

const UNIONES = `
  from clientes c
  left join cliente_negocio n on n.cliente_id = c.id
  left join cliente_numeros m on m.cliente_id = c.id
  left join cliente_comercial k on k.cliente_id = c.id
  left join consultoras co on co.id = c.consultora_id`

export type FilaDeLista = {
  id: number
  nombre: string
  consultora: string | null
  estado: string | null
  fecha_inicio: string | null
  programa_meses: number | null
  documentos: number
} & Record<string, unknown>

export type ClienteDeLista = {
  id: number
  nombre: string
  consultora: string | null
  estado: string | null
  fechaInicio: string | null
  programaMeses: number | null
  documentos: number
  faltan: Campo[]
}

export async function listarClientes(filtros: { consultoraId?: number | null; estado?: string | null } = {}): Promise<ClienteDeLista[]> {
  const condiciones: string[] = []
  const parametros: unknown[] = []
  if (filtros.consultoraId) {
    parametros.push(filtros.consultoraId)
    condiciones.push(`c.consultora_id = $${parametros.length}`)
  }
  if (filtros.estado) {
    parametros.push(filtros.estado)
    condiciones.push(`c.estado = $${parametros.length}`)
  }
  const donde = condiciones.length > 0 ? `where ${condiciones.join(' and ')}` : ''

  const encontrados = await filas<FilaDeLista>(
    `select c.id, c.nombre, co.nombre as consultora, c.estado, c.fecha_inicio, c.programa_meses,
            (select count(*)::int from documentos d where d.cliente_id = c.id) as documentos,
            ${seleccionDeTenencia()}
     ${UNIONES}
     ${donde}
     order by c.nombre`,
    parametros,
  )

  return encontrados.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    consultora: f.consultora,
    estado: f.estado,
    fechaInicio: f.fecha_inicio,
    programaMeses: f.programa_meses,
    documentos: f.documentos,
    faltan: CAMPOS_QUE_CUENTAN.filter((campo) => f[`tiene_${campo.clave}`] !== true),
  }))
}

export type ClienteCompleto = {
  id: number
  nombre: string
  refExterna: string | null
  consultora: string | null
  creadoEn: string
  actualizadoEn: string
  valores: Record<string, unknown>
  faltan: Campo[]
}

export async function traerCliente(id: number): Promise<ClienteCompleto | null> {
  const seleccion = CAMPOS
    .filter((c) => c.clave !== 'nombre' && c.clave !== 'consultora')
    .map((campo) => `${ALIAS[campo.tabla]}.${campo.columna} as "${campo.clave}"`)
    .join(', ')

  const encontrado = await fila<Record<string, unknown>>(
    `select c.id, c.nombre, c.ref_externa, c.creado_en, c.actualizado_en,
            co.nombre as consultora, ${seleccion}
     ${UNIONES}
     where c.id = $1`,
    [id],
  )
  if (!encontrado) return null

  const valores: Record<string, unknown> = { nombre: encontrado.nombre, consultora: encontrado.consultora }
  for (const campo of CAMPOS) if (campo.clave in encontrado) valores[campo.clave] = encontrado[campo.clave]

  const faltan = CAMPOS_QUE_CUENTAN.filter((campo) => {
    const v = valores[campo.clave]
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
  })

  return {
    id: encontrado.id as number,
    nombre: encontrado.nombre as string,
    refExterna: (encontrado.ref_externa as string) ?? null,
    consultora: (encontrado.consultora as string) ?? null,
    creadoEn: String(encontrado.creado_en),
    actualizadoEn: String(encontrado.actualizado_en),
    valores,
    faltan,
  }
}

/** Los documentos del cliente, sin el texto: título, tipo, fecha y tamaño. */
export async function documentosDe(clienteId: number) {
  return filas<{ id: number; tipo: string; titulo: string; fecha: string | null; caracteres: number; origen: string; creado_en: string }>(
    `select id, tipo, titulo, fecha, caracteres, origen, creado_en
       from documentos where cliente_id = $1 order by creado_en desc`,
    [clienteId],
  )
}

export async function listarConsultoras() {
  return filas<{ id: number; nombre: string; clientes: number }>(
    `select co.id, co.nombre, (select count(*)::int from clientes c where c.consultora_id = co.id) as clientes
       from consultoras co order by co.nombre`,
  )
}
