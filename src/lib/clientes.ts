import { CAMPOS, type Campo } from './campos'
import { fila, filas } from './db'
import { fuentesConDatos, type FuentesConDatos } from './hitos'
import { plegado } from './texto'

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
  tiene_onboarding: boolean
} & Record<string, unknown>

export type ClienteDeLista = {
  id: number
  nombre: string
  consultora: string | null
  estado: string | null
  fechaInicio: string | null
  programaMeses: number | null
  documentos: number
  tieneOnboarding: boolean
  /** Presencia de cada dato, sin traer el texto: alcanza para comparar. */
  presencia: Record<string, unknown>
  faltan: Campo[]
}

export async function listarClientes(
  filtros: { consultoraId?: number | null; estado?: string | null; buscar?: string | null } = {},
): Promise<ClienteDeLista[]> {
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
  if (filtros.buscar && filtros.buscar.trim() !== '') {
    // Buscar sí pliega acentos y mayúsculas: acá no se decide de quién es un
    // dato, sólo se filtra una lista. La regla 3 rige para lo otro.
    parametros.push(`%${plegado(filtros.buscar)}%`)
    condiciones.push(`c.nombre_pleg like $${parametros.length}`)
  }
  const donde = condiciones.length > 0 ? `where ${condiciones.join(' and ')}` : ''

  const encontrados = await filas<FilaDeLista>(
    `select c.id, c.nombre, co.nombre as consultora, c.estado, c.fecha_inicio, c.programa_meses,
            (select count(*)::int from documentos d where d.cliente_id = c.id) as documentos,
            exists(select 1 from documentos d where d.cliente_id = c.id and d.tipo = 'onboarding') as tiene_onboarding,
            ${seleccionDeTenencia()}
     ${UNIONES}
     ${donde}
     order by c.nombre`,
    parametros,
  )

  return encontrados.map((f) => {
    // La comparación necesita saber si el dato está, no qué dice. Así una lista
    // de 194 clientes no arrastra al navegador 194 ofertas de 900 caracteres.
    const presencia: Record<string, unknown> = {}
    for (const campo of CAMPOS_QUE_CUENTAN) presencia[campo.clave] = f[`tiene_${campo.clave}`] === true ? true : null

    return {
      id: f.id,
      nombre: f.nombre,
      consultora: f.consultora,
      estado: f.estado,
      fechaInicio: f.fecha_inicio,
      programaMeses: f.programa_meses,
      documentos: f.documentos,
      tieneOnboarding: f.tiene_onboarding,
      presencia,
      faltan: CAMPOS_QUE_CUENTAN.filter((campo) => f[`tiene_${campo.clave}`] !== true),
    }
  })
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

/**
 * La cartera entera con todos sus valores, para bajarla como planilla.
 *
 * Acá sí viajan los textos largos, y está bien: el archivo ES el texto. Lo que
 * no se hace nunca es traerlos a una pantalla que se escanea.
 */
export async function exportarClientes() {
  const seleccion = CAMPOS
    .filter((c) => c.clave !== 'nombre' && c.clave !== 'consultora')
    .map((campo) => `${ALIAS[campo.tabla]}.${campo.columna} as "${campo.clave}"`)
    .join(', ')

  return filas<{ ref_externa: string | null; consultora: string | null } & Record<string, unknown>>(
    `select c.ref_externa, c.nombre, co.nombre as consultora, ${seleccion}
     ${UNIONES}
     order by c.nombre`,
  )
}

/** Los documentos del cliente, sin el texto: título, tipo, fecha y tamaño. */
export async function documentosDe(clienteId: number) {
  return filas<{ id: number; tipo: string; titulo: string; fecha: string | null; caracteres: number; origen: string; creado_en: string }>(
    `select id, tipo, titulo, fecha, caracteres, origen, creado_en
       from documentos where cliente_id = $1 order by creado_en desc`,
    [clienteId],
  )
}

/**
 * Qué fuentes tienen datos en toda la cartera (regla 2).
 * Se calcula una vez por pantalla, no una vez por cliente.
 */
export async function fuentesDeLaCartera(): Promise<FuentesConDatos> {
  const r = await fila<{ fichas: boolean; onboardings: boolean }>(
    `select
       exists(select 1 from cliente_negocio where oferta is not null or cliente_ideal is not null or mensaje is not null)
         or exists(select 1 from cliente_numeros where meta_mensual is not null or ticket is not null) as fichas,
       exists(select 1 from documentos where tipo = 'onboarding') as onboardings`,
  )
  return fuentesConDatos({
    algunClienteConDatosDeFicha: r?.fichas ?? false,
    algunOnboardingCargado: r?.onboardings ?? false,
  })
}

export async function listarConsultoras() {
  return filas<{ id: number; nombre: string; clientes: number }>(
    `select co.id, co.nombre, (select count(*)::int from clientes c where c.consultora_id = co.id) as clientes
       from consultoras co order by co.nombre`,
  )
}
