import { fila, filas, pool } from './db'

/**
 * Qué tiene que existir en la base, y qué migración lo crea.
 *
 * Alcanzaba con mirar si estaba la tabla `usuarios`, y eso dejó pasar el caso
 * real: la base tenía la primera migración y no las siguientes, así que la
 * aplicación conectaba bien y después reventaba contra una tabla que no
 * existía. Un chequeo que sólo mira la primera puerta no sirve.
 */
const ESQUEMA_ESPERADO: { migracion: string; tablas: string[]; columnas: [string, string][] }[] = [
  {
    migracion: '0001_estructura.sql',
    tablas: ['usuarios', 'sesiones_login', 'consultoras', 'clientes', 'cliente_negocio',
             'cliente_numeros', 'cliente_comercial', 'documentos', 'importaciones', 'importacion_filas'],
    columnas: [],
  },
  { migracion: '0002_origen_de_los_datos.sql', tablas: ['campo_origen'], columnas: [] },
  {
    migracion: '0003_autoridad_e_intentos.sql',
    tablas: ['cliente_autoridad', 'cliente_intentos'],
    columnas: [['clientes', 'horas_por_semana'], ['cliente_negocio', 'mecanismo']],
  },
  { migracion: '0004_llamadas_al_modelo.sql', tablas: ['llamadas_modelo'], columnas: [] },
  { migracion: '0005_sesiones.sql', tablas: ['sesiones'], columnas: [] },
  { migracion: '0006_diagnosticos.sql', tablas: ['diagnosticos'], columnas: [] },
  { migracion: '0007_propuestas.sql', tablas: ['propuestas_campo'], columnas: [] },
  { migracion: '0008_cada_consultora_ve_lo_suyo.sql', tablas: [], columnas: [['usuarios', 'consultora_id']] },
]

/**
 * Por qué la aplicación no puede arrancar, dicho en una pantalla.
 *
 * Una excepción del servidor en Vercel se ve como «Application error» y un
 * digest, que no le sirve a nadie para arreglarlo. Esto revisa lo que puede
 * fallar al publicarla y devuelve el motivo con los pasos, igual que el reporte
 * de importación dice qué fila no entró y por qué.
 *
 * Nunca devuelve la cadena de conexión ni la contraseña.
 */

export type Revision =
  | { ok: true }
  | { ok: false; titulo: string; detalle: string; pasos: string[] }

export async function revisarBase(): Promise<Revision> {
  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      titulo: 'Falta la cadena de conexión a la base',
      detalle: 'La variable DATABASE_URL no está definida en este entorno.',
      pasos: [
        'En Vercel: Settings → Environment Variables → agregar DATABASE_URL.',
        'Usá la cadena del pooler de Supabase (puerto 6543), no la conexión directa del 5432.',
        'Después de agregarla hay que volver a desplegar: una variable nueva no entra en un despliegue ya hecho.',
      ],
    }
  }

  try {
    await pool().query('select 1')
  } catch (error) {
    return noSePudoConectar(error)
  }

  try {
    const faltante = await queMigracionFalta()
    if (faltante) return faltante

    const cuantos = await fila<{ n: number }>('select count(*)::int as n from usuarios where activo')
    if (!cuantos || cuantos.n === 0) {
      return {
        ok: false,
        titulo: 'No hay ningún usuario para entrar',
        detalle: 'Las tablas están, pero todavía no se creó nadie.',
        pasos: [
          'Corré `npm run seed -- --sql <email> "<nombre>" <clave>` y pegá la sentencia en el SQL Editor de Supabase.',
          'O corré `npm run seed -- <email> "<nombre>" <clave>` desde tu máquina, con la misma DATABASE_URL.',
        ],
      }
    }
  } catch (error) {
    return noSePudoConectar(error)
  }

  return { ok: true }
}

/**
 * A dónde está intentando conectarse, para poder decirlo en la pantalla.
 * Sólo el servidor y el puerto: el usuario y la contraseña no salen nunca.
 */
function aDondeVa(): { host: string; puerto: string; base: string } | null {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '')
    return { host: url.hostname, puerto: url.port || '5432', base: url.pathname.replace(/^\//, '') || 'postgres' }
  } catch {
    return null
  }
}

/**
 * Contra qué base está mirando, dicho para comparar de un vistazo.
 *
 * Sin esto, «corrí la migración y sigue igual» no se puede resolver: puede ser
 * que no haya corrido, o que haya corrido en otro proyecto de Supabase. Esta
 * línea separa los dos casos sin tener que preguntar nada. Nunca sale el
 * usuario ni la contraseña.
 */
function contraQueBase(): string {
  const d = aDondeVa()
  return d ? `Estoy mirando la base «${d.base}» en ${d.host}:${d.puerto}.` : ''
}

const PLACEHOLDERS = ['REGION', 'PROYECTO', 'PROJECT', 'YOUR', 'CLAVE', 'PASSWORD']

/**
 * Todas las migraciones que faltan, con lo que le falta a cada una.
 *
 * Nombrar sólo la primera ya hizo tropezar dos veces: se corre esa, se vuelve
 * a desplegar y aparece la misma pantalla con la siguiente. Si faltan cuatro,
 * la pantalla dice cuatro y se corren las cuatro de una.
 */
async function queMigracionFalta(): Promise<Revision | null> {
  const columnas = await filas<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns where table_schema = 'public'`,
  )
  const tablas = new Set(columnas.map((c) => c.table_name))
  const conColumna = new Set(columnas.map((c) => `${c.table_name}.${c.column_name}`))

  // information_schema sólo muestra lo que el usuario puede ver. Cero tablas
  // puede ser una base vacía, pero también un usuario sin permisos, y decir lo
  // primero cuando pasa lo segundo manda a arreglar lo que no está roto.
  if (tablas.size === 0) {
    return {
      ok: false,
      titulo: 'No veo ninguna tabla',
      detalle: `La conexión funciona, pero en el esquema public no aparece nada. ${contraQueBase()}`,
      pasos: [
        'Si la base es nueva: corré las migraciones de supabase/migrations/ en orden, o `npm run esquema` y pegá todo junto en el SQL Editor.',
        'Si ya las corriste: el usuario de la cadena de conexión no tiene permisos sobre el esquema public. En Supabase la cadena tiene que ser la del usuario postgres.',
      ],
    }
  }

  const faltantes: { migracion: string; queFalta: string; cuantas: number }[] = []

  for (const paso of ESQUEMA_ESPERADO) {
    const tablasQueFaltan = paso.tablas.filter((t) => !tablas.has(t))
    const columnasQueFaltan = paso.columnas
      .filter(([t, c]) => tablas.has(t) && !conColumna.has(`${t}.${c}`))
      .map(([t, c]) => `${t}.${c}`)

    if (tablasQueFaltan.length === 0 && columnasQueFaltan.length === 0) continue

    const queFalta = [
      tablasQueFaltan.length > 0 ? `${tablasQueFaltan.length === 1 ? 'la tabla' : 'las tablas'} ${tablasQueFaltan.join(', ')}` : null,
      columnasQueFaltan.length > 0 ? `${columnasQueFaltan.length === 1 ? 'la columna' : 'las columnas'} ${columnasQueFaltan.join(', ')}` : null,
    ].filter(Boolean).join(' y ')

    faltantes.push({ migracion: paso.migracion, queFalta, cuantas: tablasQueFaltan.length + columnasQueFaltan.length })
  }

  if (faltantes.length === 0) return null

  const desdeCero = faltantes.length === ESQUEMA_ESPERADO.length
  const unaSola = faltantes.length === 1

  // «La corrí y sigue igual» casi siempre es que corrió en otra base. Decir a
  // cuál estamos mirando y qué tablas hay ahí lo resuelve de un vistazo, sin
  // que nadie tenga que ir a comparar cadenas de conexión a mano.
  const dondeMiro = `${contraQueBase()} Las tablas que veo ahí son: ${[...tablas].sort().join(', ')}.`

  return {
    ok: false,
    titulo: desdeCero
      ? 'La base está conectada pero vacía'
      : unaSola ? 'A la base le falta una migración' : `A la base le faltan ${faltantes.length} migraciones`,
    detalle: desdeCero
      ? 'Conecté bien, pero las tablas no están creadas.'
      : unaSola
        ? `Conecté bien, pero ${faltantes[0]!.cuantas === 1 ? 'falta' : 'faltan'} ${faltantes[0]!.queFalta}.`
        : `Conecté bien, pero faltan ${faltantes.map((f) => f.queFalta).join('; ')}.`,
    pasos: desdeCero
      ? [
          'Corré `npm run esquema` y pegá todo lo que imprime en el SQL Editor de Supabase.',
          'O corré `npm run migrar` desde tu máquina con la misma DATABASE_URL.',
        ]
      : [
          unaSola
            ? `Pegá supabase/migrations/${faltantes[0]!.migracion} en el SQL Editor de Supabase y ejecutalo.`
            : `Faltan estas ${faltantes.length}, en este orden: ${faltantes.map((f) => f.migracion).join(', ')}.`,
          `Para sacarlas todas juntas: \`npm run esquema -- --desde ${faltantes[0]!.migracion.slice(0, 4)}\`, y pegás lo que imprime en el SQL Editor de Supabase.`,
          'Volver a correr una que ya está no rompe nada: son idempotentes.',
          'O corré `npm run migrar` desde tu máquina con la misma DATABASE_URL, que las aplica todas en orden.',
          `Si ya las corriste y sigue igual, corriste en otra base: ${dondeMiro} Comparalo con el proyecto de Supabase donde pegaste el SQL.`,
        ],
  }
}

function noSePudoConectar(error: unknown): Revision {
  const codigo = (error as { code?: string })?.code ?? ''
  const destino = aDondeVa()

  if (codigo === '28P01' || codigo === '28000') {
    return {
      ok: false,
      titulo: 'La base rechazó el usuario o la contraseña',
      detalle: `Postgres contestó ${codigo}: la contraseña de la cadena de conexión no es la de esta base.`,
      pasos: [
        'Copiá la cadena de nuevo desde Supabase → Project Settings → Database → Connection string.',
        'Si la contraseña tiene símbolos, tienen que ir escapados en la URL (por ejemplo @ como %40).',
      ],
    }
  }

  if (codigo === '3D000') {
    return {
      ok: false,
      titulo: 'Esa base de datos no existe',
      detalle: 'El servidor respondió, pero el nombre de base de la cadena de conexión no está.',
      pasos: ['Revisá el final de la cadena: en Supabase la base se llama `postgres`.'],
    }
  }

  const dePlomeria: Record<string, string> = {
    ENOTFOUND: 'no se resuelve el nombre del servidor',
    EAI_AGAIN: 'no se resuelve el nombre del servidor',
    ECONNREFUSED: 'el servidor rechazó la conexión',
    ETIMEDOUT: 'la conexión se quedó esperando',
    ENETUNREACH: 'no hay ruta hasta el servidor',
    EHOSTUNREACH: 'no hay ruta hasta el servidor',
  }

  if (codigo in dePlomeria) {
    const aDonde = destino ? ` a ${destino.host}:${destino.puerto}` : ''
    return {
      ok: false,
      titulo: 'No se puede llegar a la base',
      detalle: `Al conectar${aDonde}, ${dePlomeria[codigo]} (${codigo}).`,
      pasos: pasosSegunElHost(destino),
    }
  }

  return {
    ok: false,
    titulo: 'No se puede hablar con la base',
    detalle: codigo ? `Postgres contestó ${codigo}.` : 'La conexión falló antes de poder consultar nada.',
    pasos: [
      'Revisá DATABASE_URL en Vercel: tiene que ser la cadena del pooler de Supabase (puerto 6543).',
      'Revisá que las tablas estén creadas (supabase/migrations/0001_estructura.sql).',
      'Después de cambiar una variable de entorno hay que volver a desplegar.',
    ],
  }
}


/** Los pasos cambian según a dónde esté apuntando: el host dice cuál es el error. */
function pasosSegunElHost(destino: { host: string; puerto: string } | null): string[] {
  const volverADesplegar = 'Después de cambiar la variable en Vercel hay que volver a desplegar: el despliegue que está corriendo tiene el valor viejo.'

  if (destino && PLACEHOLDERS.some((p) => destino.host.includes(p))) {
    return [
      `El servidor dice «${destino.host}»: quedó el texto de ejemplo sin reemplazar.`,
      'Copiá la cadena entera desde Supabase → botón Connect → Direct · Connection string → Transaction pooler, y pegala tal cual.',
      volverADesplegar,
    ]
  }

  if (destino && /^db\..*\.supabase\.co$/.test(destino.host)) {
    return [
      `Estás usando la conexión directa (${destino.host}), que va sólo por IPv6: desde Vercel no se llega.`,
      'Cambiala por la del pooler en modo transacción: el servidor termina en .pooler.supabase.com y el puerto es 6543.',
      volverADesplegar,
    ]
  }

  if (destino && destino.host.endsWith('.pooler.supabase.com') && destino.puerto !== '6543') {
    return [
      `El servidor está bien, pero el puerto es ${destino.puerto}.`,
      'El pooler en modo transacción, que es el que sirve en Vercel, escucha en el 6543.',
      volverADesplegar,
    ]
  }

  return [
    'Revisá que el servidor de la cadena sea el del pooler: termina en .pooler.supabase.com, puerto 6543.',
    'La conexión directa (db.PROYECTO.supabase.co, puerto 5432) va sólo por IPv6 y desde Vercel no se llega.',
    volverADesplegar,
  ]
}
