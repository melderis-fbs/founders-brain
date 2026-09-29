/**
 * El programa: catorce etapas agrupadas en cuatro fases.
 *
 * Una ETAPA es lo que se trabaja: «Match de Marca», «Ventas y Cierre». Son las
 * catorce del programa, en orden.
 *
 * Una FASE junta las etapas de un mes: cuatro semanas cada una, dieciséis en
 * total. El programa las nombra por días —«Primeros 30 días»— y se guardan las
 * dos formas porque las dos se usan: la semana para comparar, el período para
 * hablar con el cliente.
 *
 * Y los HITOS (en hitos.ts) son otra cosa: lo que tiene que quedar CERRADO, y
 * cuándo. La etapa es lo que se da; el hito es lo que quedó hecho. Un cliente
 * puede haber pasado por «Tu Oferta en Una Página» y no tener la oferta
 * cerrada, y eso es exactamente lo que hay que ver.
 *
 * OJO CON LAS SEMANAS: las catorce etapas vinieron en orden, sin semanas. El
 * reparto de abajo es el obvio —una por semana, y donde sobra, la fase que
 * tiene cinco dobla en su última semana— pero es un supuesto. Se corrige acá y
 * se arregla solo en la grilla, en las sesiones, en la ficha y en el tablero.
 */

export type ClaveEtapa =
  | 'onboarding' | 'identidad' | 'match_de_marca' | 'promesa_y_pilares' | 'oferta_en_una_pagina'
  | 'estrategia_de_contenido' | 'diseno_del_programa' | 'primera_pauta'
  | 'conversaciones_dm' | 'ventas_y_cierre' | 'validacion'
  | 'finanzas' | 'optimizacion' | 'cierre_y_plan'

export type Etapa = {
  clave: ClaveEtapa
  numero: number
  nombre: string
  /** Lo que aclara el nombre, cuando lo tiene. */
  detalle?: string
  desdeSemana: number
  hastaSemana: number
  fase: 1 | 2 | 3 | 4
  /** Lo puntual que tiene que quedar hecho dentro de esta etapa. */
  hitosClave: readonly HitoClave[]
}

/**
 * LOS HITOS CLAVE CUELGAN DE SU ETAPA, NO DE LA FASE
 *
 * Antes eran dos listas separadas: las catorce etapas por un lado y doce hitos
 * clave por otro, agrupados por fase. Marcar un hito no movía el avance, porque
 * el avance contaba etapas. Y eso se veía exactamente como se tenía que ver: un
 * cliente con la primera venta marcada y el porcentaje sin moverse.
 *
 * Ahora hay una sola cuenta. Una etapa está hecha si alguien la marcó, o si
 * están marcados TODOS sus hitos. Marcar «Primera venta» ya mueve el avance,
 * porque Ventas y Cierre pasa a estar hecha.
 */
const HITOS_DE: Record<string, readonly HitoClave[]> = {
  onboarding: [
    { clave: 'presentacion_telegram', etiqueta: 'Presentación en Telegram', cuando: 'el día 1' },
  ],
  oferta_en_una_pagina: [
    { clave: 'oferta_en_video', etiqueta: 'Oferta presentada en video con #mioferta', cuando: 'alrededor del día 15' },
  ],
  estrategia_de_contenido: [
    { clave: 'synoma_entrenado', etiqueta: 'Motor Synoma entrenado' },
    { clave: 'reto_21_dias', etiqueta: 'Reto de 21 días hecho (#reto)' },
    { clave: 'perfil_optimizado', etiqueta: 'Perfil optimizado' },
  ],
  primera_pauta: [
    { clave: 'primera_campana', etiqueta: 'Primera campaña activa' },
  ],
  conversaciones_dm: [
    { clave: 'script_dm', etiqueta: 'Script de DM y guión de venta escritos' },
    { clave: 'llamadas_agendadas', etiqueta: 'Llamadas de venta agendadas' },
  ],
  ventas_y_cierre: [
    { clave: 'primera_venta', etiqueta: 'Primera venta' },
    { clave: 'segunda_venta', etiqueta: 'Segunda venta' },
  ],
  cierre_y_plan: [
    { clave: 'plan_90_dias', etiqueta: 'Plan de los siguientes 90 días' },
    { clave: 'antes_despues', etiqueta: 'Su «antes y después» armado' },
    { clave: 'que_sigue', etiqueta: 'Qué sigue después de Growth, definido' },
  ],
}

export const ETAPAS: readonly Etapa[] = [
  { clave: 'onboarding', numero: 1, nombre: 'Onboarding y Diagnóstico', desdeSemana: 1, hastaSemana: 1, fase: 1, hitosClave: HITOS_DE.onboarding ?? [] },
  { clave: 'identidad', numero: 2, nombre: 'Identidad', detalle: 'Manual de Transformación 2.0', desdeSemana: 2, hastaSemana: 2, fase: 1, hitosClave: HITOS_DE.identidad ?? [] },
  { clave: 'match_de_marca', numero: 3, nombre: 'Match de Marca', desdeSemana: 3, hastaSemana: 3, fase: 1, hitosClave: HITOS_DE.match_de_marca ?? [] },
  { clave: 'promesa_y_pilares', numero: 4, nombre: 'Promesa y Pilares', desdeSemana: 4, hastaSemana: 4, fase: 1, hitosClave: HITOS_DE.promesa_y_pilares ?? [] },
  { clave: 'oferta_en_una_pagina', numero: 5, nombre: 'Tu Oferta en Una Página', desdeSemana: 4, hastaSemana: 4, fase: 1, hitosClave: HITOS_DE.oferta_en_una_pagina ?? [] },

  { clave: 'estrategia_de_contenido', numero: 6, nombre: 'Estrategia de Contenido', detalle: 'Synoma, sistema de 35 minutos, Reto 21 días', desdeSemana: 5, hastaSemana: 6, fase: 2, hitosClave: HITOS_DE.estrategia_de_contenido ?? [] },
  { clave: 'diseno_del_programa', numero: 7, nombre: 'Diseño de tu Programa', desdeSemana: 7, hastaSemana: 7, fase: 2, hitosClave: HITOS_DE.diseno_del_programa ?? [] },
  { clave: 'primera_pauta', numero: 8, nombre: 'Primera pauta', detalle: 'TOFU', desdeSemana: 8, hastaSemana: 8, fase: 2, hitosClave: HITOS_DE.primera_pauta ?? [] },

  { clave: 'conversaciones_dm', numero: 9, nombre: 'Conversaciones por DM', detalle: 'MOFU', desdeSemana: 9, hastaSemana: 10, fase: 3, hitosClave: HITOS_DE.conversaciones_dm ?? [] },
  { clave: 'ventas_y_cierre', numero: 10, nombre: 'Ventas y Cierre', desdeSemana: 11, hastaSemana: 11, fase: 3, hitosClave: HITOS_DE.ventas_y_cierre ?? [] },
  { clave: 'validacion', numero: 11, nombre: 'Validación', detalle: 'la clave es ejecutar', desdeSemana: 12, hastaSemana: 12, fase: 3, hitosClave: HITOS_DE.validacion ?? [] },

  { clave: 'finanzas', numero: 12, nombre: 'Finanzas del negocio', desdeSemana: 13, hastaSemana: 14, fase: 4, hitosClave: HITOS_DE.finanzas ?? [] },
  { clave: 'optimizacion', numero: 13, nombre: 'Optimización y Cuello de Botella', desdeSemana: 15, hastaSemana: 15, fase: 4, hitosClave: HITOS_DE.optimizacion ?? [] },
  { clave: 'cierre_y_plan', numero: 14, nombre: 'Cierre y Plan del Próximo Trimestre', desdeSemana: 16, hastaSemana: 16, fase: 4, hitosClave: HITOS_DE.cierre_y_plan ?? [] },
]

export type HitoClave = {
  clave: string
  etiqueta: string
  /** Cuándo se espera, dicho como lo dice el programa. */
  cuando?: string
}


export type Fase = {
  numero: 1 | 2 | 3 | 4
  queConstruimos: string
  desdeSemana: number
  hastaSemana: number
  /** Como lo nombra el programa: «Primeros 30 días». */
  periodo: string
}

export const SEMANAS_POR_FASE = 4

export const FASES: readonly Fase[] = [
  {
    numero: 1,
    queConstruimos: 'Quién sos, para quién, y qué vendés',
    desdeSemana: 1, hastaSemana: 4, periodo: 'Primeros 30 días',
  },
  {
    numero: 2,
    queConstruimos: 'Cómo lo comunica y por dónde llega',
    desdeSemana: 5, hastaSemana: 8, periodo: 'Días 31 a 60',
  },
  {
    numero: 3,
    queConstruimos: 'Que las conversaciones se conviertan en ventas',
    desdeSemana: 9, hastaSemana: 12, periodo: 'Días 61 a 90',
  },
  {
    numero: 4,
    queConstruimos: 'Que el negocio se sostenga sin el programa',
    desdeSemana: 13, hastaSemana: 16, periodo: 'Días 91 a 120',
  },
]

export const SEMANAS_DEL_PROGRAMA = FASES[FASES.length - 1]!.hastaSemana

/** Los hitos clave de una fase: los de sus etapas, juntos y en orden. */
export function hitosDeLaFase(numero: number): readonly HitoClave[] {
  return ETAPAS.filter((e) => e.fase === numero).flatMap((e) => e.hitosClave)
}

/** Todos los hitos clave del programa, que ahora son los de las catorce etapas. */
export const TODOS_LOS_HITOS: readonly HitoClave[] = ETAPAS.flatMap((e) => e.hitosClave)

/** De qué etapa es un hito clave. */
export function etapaDelHitoClave(clave: string): Etapa | null {
  return ETAPAS.find((e) => e.hitosClave.some((h) => h.clave === clave)) ?? null
}

/** Los nombres de las catorce, para elegir una en la ficha. */
export const NOMBRES_DE_ETAPAS: readonly string[] = ETAPAS.map((e) => e.nombre)

export const ETAPA_POR_CLAVE: ReadonlyMap<ClaveEtapa, Etapa> = new Map(ETAPAS.map((e) => [e.clave, e]))

export const HITOS_CLAVE: readonly (HitoClave & { fase: 1 | 2 | 3 | 4; etapa: ClaveEtapa })[] =
  ETAPAS.flatMap((e) => e.hitosClave.map((h) => ({ ...h, fase: e.fase, etapa: e.clave })))

/** El nombre completo, con su aclaración: «Identidad (Manual de Transformación 2.0)». */
export function nombreDeEtapa(e: Etapa): string {
  return e.detalle ? `${e.nombre} (${e.detalle})` : e.nombre
}

/** Las etapas que se trabajan esa semana. Puede ser más de una. */
export function etapasDeLaSemana(semana: number | null): Etapa[] {
  if (semana === null || semana < 1) return []
  return ETAPAS.filter((e) => semana >= e.desdeSemana && semana <= e.hastaSemana)
}

/** En qué fase cae esa semana. null si todavía no arrancó o si ya se pasó. */
export function faseDeLaSemana(semana: number | null): Fase | null {
  if (semana === null || semana < 1) return null
  return FASES.find((f) => semana >= f.desdeSemana && semana <= f.hastaSemana) ?? null
}

/**
 * En qué fase va hoy, o qué pasó si no se puede saber.
 *
 * Pasadas las dieciséis semanas el programa terminó, y eso se dice: dejarlo en
 * blanco haría pensar que falta un dato.
 */
export function enQueFaseVa(semana: number | null): { fase: Fase | null; porque: string } {
  if (semana === null) return { fase: null, porque: 'sin fecha de inicio no se sabe en qué semana va' }
  if (semana < 1) return { fase: null, porque: 'todavía no arrancó' }

  const suya = faseDeLaSemana(semana)
  if (suya) return { fase: suya, porque: '' }
  return { fase: null, porque: `ya pasó la semana ${SEMANAS_DEL_PROGRAMA}, que es donde termina el programa` }
}
