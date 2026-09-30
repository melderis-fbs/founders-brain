/**
 * LA TEMPERATURA DE UN CLIENTE: cómo viene la relación CON NOSOTROS.
 *
 * Esto vive aparte de `temperatura.ts` a propósito: ese módulo habla con la
 * base, y un componente de navegador que lo importe se lleva el driver de
 * Postgres puesto.
 *
 * La distinción que sostiene todo lo de acá: estar frustrado con SU NEGOCIO no
 * es estar disconforme con NOSOTROS. Un cliente que dice «estoy hace tres meses
 * y no vendo nada, estoy podrido» está frustrado con su negocio —es el problema
 * que vino a resolver— y tratarlo como queja llena el tablero de rojos que no
 * son rojos.
 */

export const TEMPERATURAS = ['bien', 'tibio', 'caliente', 'quemando'] as const
export type Temperatura = (typeof TEMPERATURAS)[number]

export const QUE_ES: Record<Temperatura, string> = {
  bien: 'No dijo nada en contra nuestro',
  tibio: 'Algo le molesta y lo dice de costado',
  caliente: 'Se queja de nosotros con todas las letras',
  quemando: 'Habla de irse, de la plata o de la garantía',
}

/** El color con el que se pinta la alerta en la ficha. */
export const COLOR_DE: Record<Temperatura, 'verde' | 'amarillo' | 'naranja' | 'rojo'> = {
  bien: 'verde',
  tibio: 'amarillo',
  caliente: 'naranja',
  quemando: 'rojo',
}

/**
 * CALIENTE Y QUEMANDO SON GRAVES. TIBIO NO.
 *
 * Tibio es un yellow flag: algo para tener a la vista. Si un tibio pintara
 * rojo volveríamos a lo de antes —media cartera en grave y la palabra sin
 * significar nada— y encima por lo más frágil que tenemos, que es la lectura
 * de un tono.
 */
export function esQueja(t: Temperatura): boolean {
  return t === 'caliente' || t === 'quemando'
}

export function esTibia(t: Temperatura): boolean {
  return t === 'tibio'
}

/** De qué se queja, cuando se queja. Cambiarlas obliga a recategorizar lo guardado. */
export const DE_QUE = [
  'tiempo', 'material', 'acompanamiento', 'resultados',
  'precio', 'lo_que_le_vendieron', 'la_consultora', 'otra',
] as const
export type DeQue = (typeof DE_QUE)[number]

export const NOMBRE_DE_QUE: Record<DeQue, string> = {
  tiempo: 'el tiempo que le lleva',
  material: 'el material',
  acompanamiento: 'el acompañamiento',
  resultados: 'los resultados',
  precio: 'el precio',
  lo_que_le_vendieron: 'lo que le vendieron',
  la_consultora: 'la consultora',
  otra: 'otra cosa',
}

export type DeDonde = 'sesion' | 'encuesta'

export const DE_DONDE_SE_DICE: Record<DeDonde, string> = {
  sesion: 'una sesión',
  encuesta: 'la encuesta de satisfacción',
}

export type TemperaturaGuardada = {
  id: number
  cliente_id: number
  de: DeDonde
  origen_id: number
  temperatura: Temperatura
  de_que: DeQue | null
  porque: string | null
  citas: string[]
  lo_otro: string | null
  que_preguntar: string | null
  detectada_en: string
  descartada_en: string | null
  descartada_por_nombre: string | null
  por_que_se_descarto: string | null
  nota: string | null
  nota_por_nombre: string | null
  nota_en: string | null
  /** Con qué se relaciona: el número de sesión, o el título del documento. */
  origen: string | null
  origen_fecha: string | null
}

/** Lo que el semáforo necesita saber, sin el resto de la fila. */
export type LoQueDijo = {
  de: DeDonde
  temperatura: Temperatura
  cita: string | null
}

export function laMasAlta(dichos: readonly LoQueDijo[]): Temperatura | null {
  let alta: Temperatura | null = null
  for (const d of dichos) {
    if (alta === null || TEMPERATURAS.indexOf(d.temperatura) > TEMPERATURAS.indexOf(alta)) alta = d.temperatura
  }
  return alta
}

/**
 * Leer la categoría que escribió el modelo.
 *
 * Tolerante a propósito: el modelo escribe «acompañamiento» o «el
 * acompañamiento», y perder toda la alerta por una tilde sería absurdo. Lo que
 * no se entiende cae en «otra», no en null: si se quejó de algo, se quejó.
 */
const SINONIMOS: [DeQue, string[]][] = [
  ['tiempo', ['tiempo', 'el tiempo', 'tiempo que le lleva', 'carga horaria', 'ritmo']],
  ['material', ['material', 'el material', 'materiales', 'contenido', 'contenidos']],
  ['acompanamiento', ['acompanamiento', 'el acompanamiento', 'seguimiento', 'soporte', 'atencion']],
  ['resultados', ['resultados', 'los resultados', 'resultado', 'ventas']],
  ['precio', ['precio', 'el precio', 'plata', 'costo', 'valor', 'pago', 'cuota']],
  ['lo_que_le_vendieron', ['lo que le vendieron', 'lo_que_le_vendieron', 'la venta', 'lo prometido', 'la promesa', 'expectativas']],
  ['la_consultora', ['la consultora', 'la_consultora', 'consultora', 'coach', 'la coach', 'el coach']],
]

export function leerDeQue(texto: string | null | undefined): DeQue | null {
  if (!texto) return null
  const limpio = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/^[·\-*\s]+/, '').replace(/[.。]+$/, '')
  if (limpio === '' || limpio === 'ninguna' || limpio === 'ninguno' || limpio === 'nada') return null
  for (const [clave, palabras] of SINONIMOS) {
    if (palabras.some((w) => limpio === w || limpio.includes(w))) return clave
  }
  return 'otra'
}

export function leerTemperatura(texto: string | null | undefined): Temperatura | null {
  if (!texto) return null
  const limpio = texto.toLowerCase().replace(/[^a-z]/g, '')
  return (TEMPERATURAS as readonly string[]).includes(limpio) ? (limpio as Temperatura) : null
}
