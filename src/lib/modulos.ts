/**
 * El programa: cuatro fases de treinta días.
 *
 * Cada fase dura CUATRO SEMANAS y el programa son dieciséis. El programa habla
 * de «los primeros 30 días» y «los días 31 a 60», que es el mismo mes contado
 * de otra manera: se guardan las dos formas porque las dos se usan —la semana
 * para comparar, el período para hablar con el cliente— pero la semana es la
 * que manda, que es la unidad con la que está hecho todo lo demás.
 *
 * Conviene no confundir tres cosas que se parecen:
 *
 *   - Las FASES y sus MÓDULOS son el programa. Lo que se da, y cuándo.
 *   - Los HITOS CLAVE son lo que queda hecho dentro de cada fase, con su
 *     marca: «#mioferta», «#reto», «primera venta».
 *   - Las ETAPAS DEL NEGOCIO (Definición, Mensaje, Volumen, Conversión,
 *     Escala) son las cinco preguntas de dónde está parado el negocio del
 *     cliente. Esas vienen del método y no cambian con el calendario.
 *
 * Un cliente puede haber visto el módulo «Tu Oferta en Una Página» y no tener
 * la oferta cerrada. Eso no es una contradicción del sistema: es exactamente
 * lo que hay que ver.
 */

export type HitoClave = {
  clave: string
  etiqueta: string
  /** Cuándo se espera, dicho como lo dice el programa: «el día 1», «día ~15». */
  cuando?: string
}

export type Fase = {
  numero: 1 | 2 | 3 | 4
  /** Lo que se construye en esta fase, dicho como lo dice el programa. */
  queConstruimos: string
  modulos: readonly string[]
  desdeSemana: number
  hastaSemana: number
  /** Como lo nombra el programa: «Primeros 30 días». */
  periodo: string
  hitosClave: readonly HitoClave[]
}

export const SEMANAS_POR_FASE = 4

export const FASES: readonly Fase[] = [
  {
    numero: 1,
    queConstruimos: 'Quién sos, para quién, y qué vendés',
    modulos: [
      'Onboarding y Diagnóstico',
      'Identidad (Manual de Transformación 2.0)',
      'Match de Marca',
      'Promesa y Pilares',
      'Tu Oferta en Una Página',
    ],
    desdeSemana: 1,
    hastaSemana: 4,
    periodo: 'Primeros 30 días',
    hitosClave: [
      { clave: 'presentacion_telegram', etiqueta: 'Presentación en Telegram', cuando: 'el día 1' },
      { clave: 'oferta_en_video', etiqueta: 'Oferta presentada en video con #mioferta', cuando: 'alrededor del día 15' },
    ],
  },
  {
    numero: 2,
    queConstruimos: 'Cómo lo comunica y por dónde llega',
    modulos: [
      'Estrategia de Contenido (Synoma, sistema de 35 minutos, Reto 21 días)',
      'Diseño de tu Programa',
      'Primera pauta (TOFU)',
    ],
    desdeSemana: 5,
    hastaSemana: 8,
    periodo: 'Días 31 a 60',
    hitosClave: [
      { clave: 'synoma_entrenado', etiqueta: 'Motor Synoma entrenado' },
      { clave: 'reto_21_dias', etiqueta: 'Reto de 21 días hecho (#reto)' },
      { clave: 'perfil_optimizado', etiqueta: 'Perfil optimizado' },
      { clave: 'primera_campana', etiqueta: 'Primera campaña activa' },
    ],
  },
  {
    numero: 3,
    queConstruimos: 'Que las conversaciones se conviertan en ventas',
    modulos: [
      'Conversaciones por DM (MOFU)',
      'Ventas y Cierre',
      'Validación (la clave es ejecutar)',
    ],
    desdeSemana: 9,
    hastaSemana: 12,
    periodo: 'Días 61 a 90',
    hitosClave: [
      { clave: 'script_dm', etiqueta: 'Script de DM y guión de venta escritos' },
      { clave: 'llamadas_agendadas', etiqueta: 'Llamadas agendadas' },
      { clave: 'primera_venta', etiqueta: 'Primera venta' },
    ],
  },
  {
    numero: 4,
    queConstruimos: 'Que el negocio se sostenga sin el programa',
    modulos: [
      'Finanzas del negocio',
      'Optimización y Cuello de Botella',
      'Cierre y Plan del Próximo Trimestre',
    ],
    desdeSemana: 13,
    hastaSemana: 16,
    periodo: 'Días 91 a 120',
    hitosClave: [
      { clave: 'plan_90_dias', etiqueta: 'Plan de los siguientes 90 días' },
      { clave: 'antes_despues', etiqueta: 'Su «antes y después» armado' },
      { clave: 'que_sigue', etiqueta: 'Qué sigue después de Growth, definido' },
    ],
  },
]

export const SEMANAS_DEL_PROGRAMA = FASES[FASES.length - 1]!.hastaSemana

export const HITOS_CLAVE: readonly (HitoClave & { fase: 1 | 2 | 3 | 4 })[] =
  FASES.flatMap((f) => f.hitosClave.map((h) => ({ ...h, fase: f.numero })))

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

/**
 * El módulo que se trabaja esa semana.
 *
 * Los módulos de la fase se reparten en sus cuatro semanas. Cuando son cinco
 * en cuatro, la semana que lleva dos es la ÚLTIMA, no la primera: el
 * onboarding va solo, y «Promesa y Pilares» termina cayendo junto a «Tu Oferta
 * en Una Página», que es la semana en la que vence ese hito.
 */
export function modulosDeLaSemana(semana: number | null): string[] {
  const fase = faseDeLaSemana(semana)
  if (!fase || semana === null) return []

  const cual = semana - fase.desdeSemana
  const cuantos = fase.modulos.length
  return fase.modulos.filter(
    (_, i) => SEMANAS_POR_FASE - 1 - Math.floor(((cuantos - 1 - i) * SEMANAS_POR_FASE) / cuantos) === cual,
  )
}
