/**
 * Lo de las sesiones que también necesita el navegador.
 *
 * Vive aparte de `sesiones.ts` a propósito: ese módulo habla con la base, y un
 * componente de cliente que lo importe se lleva el driver de Postgres al
 * navegador. El build lo detecta, pero es más sano que no pueda pasar.
 */

export const ESTADOS_SESION = ['agendada', 'hecha', 'cancelada', 'no_asistio'] as const
export type EstadoSesion = (typeof ESTADOS_SESION)[number]

export const ETIQUETA_ESTADO: Record<EstadoSesion, string> = {
  agendada: 'agendada',
  hecha: 'hecha',
  cancelada: 'cancelada',
  no_asistio: 'no asistió',
}

export type SesionEnLista = {
  id: number
  numero: number | null
  fecha: string | null
  estado: EstadoSesion
  que_paso: string | null
  tiene_transcripcion: boolean
  caracteres: number
  analizada_en: string | null
}

export type Color = 'verde' | 'amarillo' | 'rojo' | 'gris'

/** Qué color le corresponde a una sesión, y por qué. */
export function colorDeSesion(s: SesionEnLista): { color: Color; palabra: string; porque: string } {
  if (s.estado === 'cancelada' || s.estado === 'no_asistio') {
    return { color: 'rojo', palabra: ETIQUETA_ESTADO[s.estado], porque: 'La sesión no llegó a pasar.' }
  }
  if (s.estado === 'agendada') {
    return { color: 'gris', palabra: 'agendada', porque: 'Todavía no pasó.' }
  }
  if (!s.tiene_transcripcion) {
    return { color: 'amarillo', palabra: 'sin transcripción', porque: 'La sesión se hizo, pero no quedó cargado lo que se habló.' }
  }
  if (!s.analizada_en) {
    return { color: 'amarillo', palabra: 'sin analizar', porque: 'Está la transcripción, pero todavía nadie apretó Analizar.' }
  }
  return { color: 'verde', palabra: 'analizada', porque: 'Se hizo, quedó la transcripción y está analizada.' }
}

/**
 * En qué semana del programa cayó una sesión.
 *
 * La fecha de la sesión contra la fecha de inicio del cliente. Con eso una
 * transcripción cargada se ubica sola en la semana que le toca, y se puede
 * mirar contra lo que tendría que haber pasado esa semana.
 *
 * Sin fecha de sesión o sin inicio del programa, null: no se inventa una
 * semana. Una sesión en la semana equivocada es peor que una sesión sin
 * semana.
 */
export function semanaDeLaSesion(fechaInicio: string | null, fechaSesion: string | null): number | null {
  if (!fechaInicio || !fechaSesion) return null
  const a = Date.parse(`${fechaInicio.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${fechaSesion.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const dias = Math.floor((b - a) / 86_400_000)
  if (dias < 0) return null  // la sesión es anterior al programa
  return Math.floor(dias / 7) + 1
}
