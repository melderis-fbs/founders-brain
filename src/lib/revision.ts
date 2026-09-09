import { fila, pool } from './db'

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
    const tabla = await fila<{ existe: string | null }>(`select to_regclass('public.usuarios')::text as existe`)
    if (!tabla?.existe) {
      return {
        ok: false,
        titulo: 'La base está conectada pero vacía',
        detalle: 'Conecté bien, pero las tablas no están creadas.',
        pasos: [
          'Pegá supabase/migrations/0001_estructura.sql en el SQL Editor de Supabase y ejecutalo.',
          'O corré `npm run migrar` desde tu máquina, con la misma DATABASE_URL.',
        ],
      }
    }

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
function aDondeVa(): { host: string; puerto: string } | null {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '')
    return { host: url.hostname, puerto: url.port || '5432' }
  } catch {
    return null
  }
}

const PLACEHOLDERS = ['REGION', 'PROYECTO', 'PROJECT', 'YOUR', 'CLAVE', 'PASSWORD']

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
