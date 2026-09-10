import { escribirDevolviendo, fila } from './db'
import type { Diagnostico } from './modelo'

/**
 * El diagnóstico guardado.
 *
 * Se guarda cada uno con su fecha y se muestra el último: si ya se hizo, no se
 * vuelve a hacer solo. Los anteriores quedan, porque comparar el diagnóstico de
 * hace dos meses con el de hoy dice más que cualquiera de los dos suelto.
 */

export type DiagnosticoGuardado = {
  id: number
  texto: string
  donde_se_corta: string | null
  de_quien_es: string | null
  acciones: string[] | null
  falta_cargar: string[] | null
  creado_en: string
}

export async function ultimoDiagnostico(clienteId: number): Promise<DiagnosticoGuardado | null> {
  return fila<DiagnosticoGuardado>(
    `select id, texto, donde_se_corta, de_quien_es, acciones, falta_cargar, creado_en
       from diagnosticos where cliente_id = $1 order by creado_en desc limit 1`,
    [clienteId],
  )
}

export async function guardarDiagnostico(datos: {
  clienteId: number
  usuarioId: number | null
  partido: Diagnostico
}): Promise<number> {
  const creado = await escribirDevolviendo<{ id: number }>(
    `insert into diagnosticos (cliente_id, usuario_id, texto, donde_se_corta, de_quien_es, acciones, falta_cargar)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [datos.clienteId, datos.usuarioId, datos.partido.texto, datos.partido.dondeSeCorta,
     datos.partido.deQuienEs, datos.partido.acciones, datos.partido.faltaCargar],
  )
  return creado.id
}
