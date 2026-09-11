import { CAMPOS, type TipoDocumento } from './campos'

/**
 * Cada documento se lee distinto.
 *
 * Un formulario de onboarding, una llamada de venta y un contrato no dicen las
 * mismas cosas, y sobre todo no dicen las mismas cosas con la misma
 * confianza. En una llamada de venta la gente agranda los números y achica los
 * problemas; en el contrato el precio que figura es lo que FOUNDERS le cobra a
 * él, no lo que él le cobra a sus clientes. Leerlos todos con el mismo criterio
 * es cómo se cargan datos que después nadie entiende de dónde salieron.
 *
 * Por eso cada tipo trae tres cosas: qué es, qué campos tiene sentido buscarle,
 * y la trampa propia de ese tipo.
 */

export type LecturaDeTipo = {
  queEs: string
  /** Qué campos puede llenar este documento. Vacío = todos los que falten. */
  campos: readonly string[]
  /** La confusión propia de este tipo, dicha para que no la cometa. */
  cuidado: string
}

const NEGOCIO_Y_AUTORIDAD = [
  'que_vende', 'cliente_ideal', 'problema', 'a_quien_hoy', 'deseo', 'como_entrega',
  'cantidad_clientes', 'origen_clientes', 'diferencial', 'antiguedad_negocio', 'equipo',
  'hace_bien', 'experiencia_profesional', 'resultados_propios', 'resultados_terceros',
  'industrias_que_conoce', 'autoridad_desperdiciada', 'que_funciono', 'que_no_funciono',
  'facturacion_historica', 'rubro', 'modelo_negocio', 'canal',
] as const

export const LECTURA: Record<TipoDocumento, LecturaDeTipo> = {
  onboarding: {
    queEs: 'Un formulario de onboarding: lo que el cliente contestó sobre sí mismo cuando entró al programa.',
    campos: [...NEGOCIO_Y_AUTORIDAD, 'horas_por_semana', 'precio_actual', 'facturacion_actual',
             'meta_mensual', 'ticket', 'ventas_ultimo_mes', 'moneda', 'email', 'telefono'],
    cuidado:
      'Separá lo que tiene de lo que quiere. «Facturo 1.800.000 y quiero llegar a 5.400.000» son dos campos ' +
      'distintos: la facturación de hoy es 1.800.000 y la meta es 5.400.000. No los mezcles ni los promedies.',
  },

  llamada_venta: {
    queEs: 'La transcripción de la llamada en la que le vendieron el programa.',
    campos: ['problema', 'deseo', 'que_no_funciono', 'que_funciono', 'a_quien_hoy', 'origen_clientes',
             'cantidad_clientes', 'rubro', 'que_vende', 'facturacion_actual', 'precio_actual', 'meta_mensual'],
    cuidado:
      'Es una venta: ahí la gente agranda los números y achica los problemas, y el vendedor repite lo que le ' +
      'conviene. Proponé sólo lo que dijo el cliente sobre su propio negocio, nunca lo que dijo el vendedor. ' +
      'Las horas por semana NO salen de acá: las que valen son las que declaró después, ya adentro del programa.',
  },

  contrato: {
    queEs: 'El contrato del programa, entre FOUNDERS y el cliente.',
    campos: ['valor_programa', 'forma_pago', 'cuotas_totales', 'garantia',
             'programa_meses', 'fecha_inicio', 'fecha_fin_prevista', 'email'],
    cuidado:
      'El precio que figura acá es lo que el cliente le paga a FOUNDERS: eso es el valor del programa. ' +
      'NO es «el precio que cobra hoy», que es lo que él le cobra a SUS clientes. Confundirlos da vuelta ' +
      'toda la cuenta inversa.',
  },

  sesion: {
    queEs: 'La transcripción de una sesión de trabajo con la consultora.',
    campos: ['oferta', 'promesa', 'mecanismo', 'cliente_ideal', 'problema', 'diferencial', 'mensaje',
             'deseo', 'como_entrega', 'precio_actual', 'ventas_ultimo_mes', 'facturacion_actual'],
    cuidado:
      'Acá se decide, no se cuenta: proponé lo que quedó cerrado, no lo que se estuvo pensando en voz alta. ' +
      'Si sobre un campo hubo tres versiones en la charla, va la última, y la cita tiene que ser la de esa. ' +
      'Si quedó abierto, no va.',
  },

  notas: {
    queEs: 'Notas que escribió la consultora sobre el cliente.',
    campos: [],
    cuidado:
      'Esto lo escribió la consultora, no el cliente. Sirve para datos de hecho («arranca en marzo», «el ' +
      'equipo son tres»), no para ponerle al cliente palabras que él nunca dijo. Si la nota es una impresión ' +
      'de la consultora y no un dato, no va.',
  },

  otro: {
    queEs: 'Un documento del cliente, sin un tipo declarado.',
    campos: [],
    cuidado:
      'No sabemos qué es, así que la vara sube: sólo lo que esté dicho con todas las letras.',
  },
}

/**
 * De los campos que faltan, cuáles tiene sentido buscarle a este documento.
 *
 * Pedirle el valor del programa a un onboarding es pedirle algo que no tiene:
 * el modelo lo va a buscar igual y, si se esfuerza, lo va a encontrar donde no
 * está. Acotar la lista es la forma barata de que no invente.
 */
export function camposQueBuscar<T extends { clave: string }>(
  tipo: TipoDocumento,
  queFaltan: readonly T[],
): T[] {
  const lectura = LECTURA[tipo] ?? LECTURA.otro
  if (lectura.campos.length === 0) return [...queFaltan]
  const permitidos = new Set(lectura.campos)
  return queFaltan.filter((c) => permitidos.has(c.clave))
}

/**
 * ¿Este tipo acota lo que se le puede pedir?
 *
 * «Notas» y «Otro» no acotan, y eso no es lo mismo que poder dar todo: es que
 * no sabemos qué tienen adentro. Decir «puede dar 21 de 21» de una nota de un
 * renglón promete algo que la nota no tiene.
 */
export function acotaCampos(tipo: TipoDocumento): boolean {
  return (LECTURA[tipo] ?? LECTURA.otro).campos.length > 0
}

/** Que ningún tipo nombre un campo que no existe en la ficha. */
export function camposInventados(): string[] {
  const reales = new Set(CAMPOS.map((c) => c.clave))
  const mal: string[] = []
  for (const [tipo, lectura] of Object.entries(LECTURA)) {
    for (const clave of lectura.campos) if (!reales.has(clave)) mal.push(`${tipo}: ${clave}`)
  }
  return mal
}
