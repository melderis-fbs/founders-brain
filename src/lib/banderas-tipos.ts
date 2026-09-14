/**
 * Lo de las banderas que también necesita el navegador.
 *
 * Vive aparte de `banderas.ts` a propósito: ese módulo habla con la base, y un
 * componente de cliente que lo importe se lleva el driver de Postgres al
 * navegador. El build lo detecta, pero es más sano que no pueda pasar.
 */

export const COLORES = ['roja', 'naranja', 'amarilla'] as const
export type ColorDeBandera = (typeof COLORES)[number]

export const QUE_DICE: Record<ColorDeBandera, string> = {
  roja: 'Red flag',
  naranja: 'Orange flag',
  amarilla: 'Yellow flag',
}

/** Lo que significa cada una, para el que la va a levantar. */
export const CUANDO_SE_LEVANTA: Record<ColorDeBandera, string> = {
  roja: 'se puede caer',
  naranja: 'hay un problema sin resolver',
  amarilla: 'algo para tener a la vista',
}

export type Bandera = {
  id: number
  cliente_id: number
  color: ColorDeBandera
  motivo: string
  puesta_en: string
  puesta_por_nombre: string | null
  resuelta_en: string | null
  resuelta_por_nombre: string | null
  como_se_resolvio: string | null
}

export type BanderaEnLaLista = Bandera & { cliente: string; consultora: string | null }
