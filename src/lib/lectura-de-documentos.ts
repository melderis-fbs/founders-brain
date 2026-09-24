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

/**
 * Lo que el formulario de onboarding pregunta, que es casi todo.
 *
 * El formulario real hace más de treinta preguntas: quién es, qué le frustra,
 * cómo vende, qué probó, sus números, qué espera del programa. Se usa entero:
 * si una respuesta no termina en ningún campo, algo se perdió.
 *
 * Ojo con los tres `_inicial`. El cliente ideal, el problema y la oferta que
 * contesta acá son su PUNTO DE PARTIDA, no la versión final: todavía no los
 * trabajó. Van a los campos `_inicial` y nunca a los trabajados. La distancia
 * entre los dos es el programa funcionando, y pisar uno con el otro es
 * justamente perder esa distancia.
 */
const DEL_ONBOARDING = [
  // quién es
  'nombre', 'email', 'telefono', 'pais', 'redes', 'fuente', 'horas_por_semana',
  'profesion_actual', 'frustracion_negocio', 'frustraciones_top3', 'restricciones',
  'como_coachearlo', 'miedos', 'valores', 'motivo_ingreso', 'expectativas_programa', 'notas_cliente',
  // su negocio como llegó
  'nombre_negocio', 'rubro', 'que_vende', 'historia_negocio', 'antiguedad_negocio',
  'etapa_percibida', 'vision_negocio', 'equipo', 'roles_equipo', 'como_entrega',
  'modelo_negocio', 'a_quien_hoy', 'cliente_ideal_inicial', 'problema_inicial', 'oferta_inicial',
  // cómo consigue y cómo vende
  'canal', 'origen_clientes', 'estrategia_marketing', 'hace_publicidad', 'usa_testimonios',
  'plataformas_ok', 'proceso_ventas', 'oportunidad_sin_explotar',
  // lo que ya probó
  'intentos_captacion', 'que_funciono', 'que_no_funciono', 'facturacion_historica',
  // lo que quiere lograr
  'problemas_negocio', 'necesidad_percibida', 'objetivos_semanas', 'objetivo_meses', 'meta_mensual',
  // sus números
  'moneda', 'precio_actual', 'facturacion_actual', 'cantidad_clientes', 'ventas_ultimo_mes', 'tiene_tracker',
] as const

/**
 * Lo que sale del match de marca, y de ningún otro lado.
 *
 * Si el match no está, estos campos quedan vacíos. Completarlos con el
 * onboarding sería decir que el cliente trabajó algo que no trabajó.
 */
const DEL_MATCH = [
  'expertise', 'nichos_candidatos', 'cliente_ideal', 'casos_reales', 'problema', 'deseo',
  'metodo_que_odia', 'capacidad_pago', 'soluciones_falsas', 'objeciones_cliente',
  'promesa', 'promesas_secundarias', 'mecanismo', 'pilares', 'diferencial', 'oferta', 'mensaje',
  'frases_mercado', 'estado_encuesta', 'a_quien_hoy',
] as const

export const LECTURA: Record<TipoDocumento, LecturaDeTipo> = {
  onboarding: {
    queEs: 'Un formulario de onboarding: lo que el cliente contestó sobre sí mismo cuando entró al programa.',
    campos: [...DEL_ONBOARDING],
    cuidado:
      'Se usa ENTERO: cada respuesta tiene al menos un campo donde va, y una respuesta que no usaste en ningún ' +
      'campo es algo que se perdió. Tres cuidados. ' +
      'UNO: separá lo que TIENE de lo que QUIERE. «Facturo 1.800.000 y quiero llegar a 5.400.000» son dos campos ' +
      'distintos, no los promedies. ' +
      'DOS: el cliente ideal, el problema y la oferta que contesta acá son su PUNTO DE PARTIDA. Van a ' +
      'cliente_ideal_inicial, problema_inicial y oferta_inicial, nunca a los campos trabajados. ' +
      'TRES: se lee por contenido, no por título de pregunta. Los clientes contestan seguido en la pregunta ' +
      'equivocada —en «miedos» cuentan qué les funcionó—, así que la cita va al campo que corresponde por lo ' +
      'que dice, aclarando de qué pregunta salió.',
  },

  match_de_marca: {
    queEs:
      'El match de marca: el trabajo que el cliente hizo CON la consultora en la etapa 3 del programa, ' +
      'para definir a quién le habla, qué le resuelve y con qué lo diferencia.',
    campos: [...DEL_MATCH],
    cuidado:
      'Es la ÚNICA fuente de estos campos: si algo no está acá, queda sin proponer, no se completa con el ' +
      'onboarding. ' +
      'El documento tiene dos partes que valen distinto. Los bloques 1 a 5 y la Parte 2 los escribió el cliente ' +
      'con su consultora: confianza alta. El «Chequeo final con tu IA» y todo lo que viene después es lo que le ' +
      'devolvió una IA: se usa, pero con confianza media y diciendo «sugerido en el chequeo con IA», salvo que ' +
      'el texto muestre que el cliente lo eligió. ' +
      'Si hay varias versiones de la promesa o de los pilares, gana la marcada como final, validada o ' +
      'recomendada; si ninguna está marcada, gana la última, y las otras van a contradicciones. ' +
      'Lo que quedó como plantilla sin llenar («[frase]», «Tu respuesta:», casilleros vacíos) NO es dato: se saltea.',
  },

  llamada_venta: {
    queEs: 'La transcripción de la llamada en la que le vendieron el programa.',
    campos: ['dolor_textual', 'objeciones_venta', 'valor_prometido', 'forma_pago_prometida',
             'cuotas_prometidas', 'garantia_mencionada', 'problema_inicial', 'que_funciono',
             'que_no_funciono', 'intentos_captacion', 'facturacion_historica', 'a_quien_hoy',
             'origen_clientes', 'motivo_ingreso', 'frustracion_negocio'],
    cuidado:
      'Lo comercial de acá es lo que se HABLÓ, no lo firmado: va a los campos «prometido», nunca a los del ' +
      'contrato. Tener los dos separados es lo que después permite ver si no coinciden. ' +
      'Es la peor fuente para los números del negocio: en una venta la gente redondea según le convenga, así ' +
      'que sus números sólo se proponen si el onboarding no los tiene, y siempre con confianza media. ' +
      'El dolor va con SUS palabras, copiado literal, sin resumir.',
  },

  contrato: {
    queEs: 'El contrato del programa entre FOUNDERS y el cliente.',
    campos: ['valor_programa', 'forma_pago', 'cuotas_totales', 'garantia',
             'programa_meses', 'fecha_inicio', 'fecha_fin_prevista', 'nombre', 'email'],
    cuidado:
      'El precio que figura acá es lo que FOUNDERS le cobra a él, no lo que él le cobra a sus clientes. No lo ' +
      'pongas nunca en el ticket ni en el precio.',
  },

  sesion: {
    queEs: 'La transcripción o las notas de una sesión de trabajo con la consultora.',
    campos: ['oferta', 'promesa', 'mensaje', 'mecanismo', 'diferencial', 'pilares', 'canal',
             'ticket', 'meta_mensual', 'facturacion_actual', 'ventas_ultimo_mes',
             'que_funciono', 'que_no_funciono', 'objetivos_semanas', 'proceso_ventas'],
    cuidado:
      'Una sesión muestra el trabajo EN CURSO: mucho de lo que se dice es una idea que se está probando, no una ' +
      'decisión. Proponé sólo lo que quedó cerrado, con la frase que lo cierra. «Estaría bueno probar con…» no ' +
      'es una decisión.',
  },

  notas: {
    queEs: 'Notas sueltas de la consultora sobre este cliente.',
    campos: [],
    cuidado:
      'Son notas de una persona, escritas para acordarse, no para que las lea un tercero. Pueden estar ' +
      'abreviadas o sin contexto. Si una frase no se entiende sola, no la uses.',
  },

  otro: {
    queEs: 'Un documento del cliente sin tipo declarado.',
    campos: [],
    cuidado:
      'No se sabe qué es, así que no hay contexto que ayude a interpretarlo. Sólo entra lo que esté dicho con ' +
      'todas las letras.',
  },
}

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
 * Los tres documentos que se cruzan entre sí.
 *
 * Son los que cuentan la historia del cliente y tienen tabla de prioridad: cuál
 * le gana a cuál cuando dicen cosas distintas. Un contrato no entra: no compite
 * con nadie, porque lo que dice no lo dice ningún otro.
 */
export const DEL_CRUCE: readonly TipoDocumento[] = ['onboarding', 'match_de_marca', 'llamada_venta']

/**
 * Qué campos tiene sentido buscarle al cruce.
 *
 * La unión de lo que pueden dar los documentos que efectivamente están. Es lo
 * que impide que el cruce proponga el valor del programa o la fecha de inicio,
 * que salen del contrato y de GHL, no de estos tres. Pedirle a un documento un
 * dato que no tiene hace que lo busque igual y, si se esfuerza, lo encuentra
 * donde no está.
 */
export function camposDelCruce<T extends { clave: string }>(
  tiposPresentes: readonly string[],
  queFaltan: readonly T[],
): T[] {
  const permitidos = new Set<string>()
  for (const tipo of DEL_CRUCE) {
    if (!tiposPresentes.includes(tipo)) continue
    for (const clave of LECTURA[tipo].campos) permitidos.add(clave)
  }
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
