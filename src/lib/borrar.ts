import { escribir, filas } from './db'
import type { QueSeVa } from './borrar-tipos'

export type { QueSeVa }

/**
 * BORRAR LO QUE SE CARGÓ MAL
 *
 * Todo lo que se carga a mano se carga mal alguna vez: un cliente duplicado de
 * la planilla, una bandera levantada en la ficha equivocada, un análisis que
 * salió cualquier cosa. Sin forma de deshacerlo, eso queda para siempre y —peor
 * que quedar— el diagnóstico lo lee como si fuera cierto.
 *
 * Dos criterios acá:
 *
 * 1. Lo que se borra, se borra de verdad. Nada de marcar «inactivo» y seguir
 *    contándolo en el tablero: eso es justo lo que hace que un tablero mienta.
 * 2. Antes de borrar se dice qué se lleva puesto, con números. «¿Seguro?» no es
 *    una pregunta: «se van 12 documentos, 8 sesiones y 3 meses cargados» sí.
 */


/**
 * Qué se lleva puesto borrar este cliente.
 *
 * Se cuenta antes y se muestra. Nadie puede decidir si borrar algo sin saber
 * cuánto es ese algo.
 */
export async function queSeVaConElCliente(clienteId: number): Promise<QueSeVa | null> {
  const [c] = await filas<{ nombre: string }>('select nombre from clientes where id = $1', [clienteId])
  if (!c) return null

  const [n] = await filas<Omit<QueSeVa, 'nombre'>>(
    `select
       (select count(*) from documentos      where cliente_id = $1)::int as documentos,
       (select count(*) from sesiones        where cliente_id = $1)::int as sesiones,
       (select count(*) from cliente_mes     where cliente_id = $1)::int as meses,
       (select count(*) from notas           where cliente_id = $1)::int as notas,
       (select count(*) from banderas        where cliente_id = $1)::int as banderas,
       (select count(*) from diagnosticos    where cliente_id = $1)::int as diagnosticos,
       (select count(*) from propuestas_campo where cliente_id = $1)::int as propuestas,
       (select count(*) from campo_origen    where cliente_id = $1)::int as "datosCargados"`,
    [clienteId],
  )
  return { nombre: c.nombre, ...n! }
}

export type Resultado = { ok: true } | { ok: false; error: string }

/**
 * Borrar un cliente entero.
 *
 * Se lleva todo lo suyo, porque todo lo suyo cuelga de él en la base. Lo único
 * que queda es el registro de lo que se le gastó al modelo: esa plata se gastó
 * igual, y borrar el gasto porque se borró el cliente sería falsear la cuenta.
 *
 * Pide el nombre escrito a mano. No es burocracia: es la diferencia entre un
 * click de más y perder el expediente entero de un cliente real.
 */
export async function borrarCliente(clienteId: number, nombreEscrito: string): Promise<Resultado> {
  const [c] = await filas<{ nombre: string }>('select nombre from clientes where id = $1', [clienteId])
  if (!c) return { ok: false, error: 'Ese cliente no existe.' }

  const igual = (t: string) => t.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')
  if (igual(nombreEscrito) !== igual(c.nombre)) {
    return { ok: false, error: `Para borrarlo hay que escribir su nombre tal cual: «${c.nombre}».` }
  }

  await escribir('delete from clientes where id = $1', [clienteId], { esperadas: 1 })
  return { ok: true }
}

/**
 * Borrar el análisis de una sesión, dejando la transcripción.
 *
 * Cuando el análisis salió mal, lo que hay que poder tirar es el análisis, no la
 * sesión: la transcripción es lo que dijo la gente y eso no se toca. Después se
 * vuelve a analizar, que cuesta plata pero cuesta menos que volver a pegar todo.
 */
export async function borrarAnalisis(sesionId: number, clienteId: number): Promise<Resultado> {
  const [s] = await filas<{ id: number; analisis: string | null }>(
    'select id, analisis from sesiones where id = $1 and cliente_id = $2', [sesionId, clienteId],
  )
  if (!s) return { ok: false, error: 'Esa sesión no es de este cliente.' }
  if (s.analisis === null) return { ok: false, error: 'Esa sesión no tiene análisis: no hay nada que borrar.' }

  await escribir(
    `update sesiones set analisis = null, puntos = null, compromisos = null,
                         analizada_en = null, actualizado_en = now()
      where id = $1 and cliente_id = $2`,
    [sesionId, clienteId], { esperadas: 1 },
  )
  return { ok: true }
}

/**
 * Borrar el diagnóstico guardado.
 *
 * Es una foto de un momento: si se hizo con la ficha a medio cargar, lo que dice
 * ya no es cierto, y tenerlo ahí es peor que no tenerlo. Se borra y se vuelve a
 * pedir cuando el caso esté completo.
 */
export async function borrarDiagnostico(diagnosticoId: number, clienteId: number): Promise<Resultado> {
  const [d] = await filas<{ id: number }>(
    'select id from diagnosticos where id = $1 and cliente_id = $2', [diagnosticoId, clienteId],
  )
  if (!d) return { ok: false, error: 'Ese diagnóstico no es de este cliente.' }

  await escribir('delete from diagnosticos where id = $1 and cliente_id = $2',
                 [diagnosticoId, clienteId], { esperadas: 1 })
  return { ok: true }
}

/**
 * Borrar una bandera levantada por error.
 *
 * Es distinto de bajarla. Bajarla dice «pasó y se resolvió», y eso queda en el
 * historial porque es cierto. Borrarla dice «esto nunca pasó», y es lo que hace
 * falta cuando se levantó en la ficha equivocada: dejarla resuelta ahí sería
 * dejar escrito que ese cliente tuvo un problema que no tuvo.
 */
export async function borrarBandera(banderaId: number, clienteId: number): Promise<Resultado> {
  const [b] = await filas<{ id: number }>(
    'select id from banderas where id = $1 and cliente_id = $2', [banderaId, clienteId],
  )
  if (!b) return { ok: false, error: 'Esa bandera no es de este cliente.' }

  await escribir('delete from banderas where id = $1 and cliente_id = $2',
                 [banderaId, clienteId], { esperadas: 1 })
  return { ok: true }
}
