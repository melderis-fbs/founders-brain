/**
 * El registro de campos: la única lista de qué datos tiene un cliente.
 *
 * De acá salen tres cosas y por eso vive en un solo lugar:
 *  1. qué columnas de la planilla se entienden y a dónde van,
 *  2. qué datos le faltan a un cliente (nombrados, no contados),
 *  3. cómo se dibuja y se edita la ficha.
 */

import { NOMBRES_DE_ETAPAS } from './modulos'

export type TipoCampo = 'texto' | 'texto_largo' | 'numero' | 'entero' | 'fecha' | 'booleano' | 'opcion'

export type Grupo =
  | 'identidad'      // quién es y cómo se lo ubica
  | 'quien_es'       // la persona: qué le frustra, qué espera, cómo quiere que lo acompañen
  | 'negocio'        // su negocio como LLEGÓ: el punto de partida
  | 'marca'          // su negocio TRABAJADO en el match de marca
  | 'comercializa'   // cómo consigue clientes y cómo vende
  | 'intentos'       // lo que ya probó
  | 'objetivos'      // lo que quiere lograr
  | 'numeros'        // sus números
  | 'venta'          // lo que se dijo en la llamada de venta
  | 'comercial'      // lo firmado: sale del contrato, no de los documentos

export type Campo = {
  clave: string
  etiqueta: string
  grupo: Grupo
  tabla:
    | 'clientes' | 'cliente_negocio' | 'cliente_autoridad' | 'cliente_intentos'
    | 'cliente_numeros' | 'cliente_comercial'
    | 'cliente_quien_es' | 'cliente_marca' | 'cliente_comercializa' | 'cliente_objetivos' | 'cliente_venta'
  columna: string
  tipo: TipoCampo
  /** Entra en el total de la ficha. */
  cuenta: boolean
  /**
   * De los que el análisis USA para contestar dónde está el cliente.
   *
   * La ficha tiene 93 campos y eso está bien: son las preguntas que el
   * onboarding y el match de marca hacen de verdad. Pero 93 casilleros vacíos
   * arriba de la pantalla se leen como una pared, y peor: hacen pensar que hasta
   * llenarlos no se puede analizar nada. No es así. Estos dieciséis son los que
   * alimentan la cuenta inversa, los hitos y el semáforo; el resto enriquece el
   * caso y no bloquea nada.
   */
  base?: true
  opciones?: readonly string[]
  alias?: Record<string, string>
  /** Encabezados de planilla que se aceptan para esta columna. */
  sinonimos: readonly string[]
  ayuda?: string
}

export const ESTADOS = ['activo', 'pausado', 'baja', 'finalizado'] as const
export const MODELOS = ['servicio', 'producto', 'infoproducto', 'mixto'] as const
export const FORMAS_PAGO = ['contado', 'cuotas'] as const

export const CAMPOS: readonly Campo[] = [
  // ── Identidad ───────────────────────────────────────────────────────────
  { clave: 'nombre', etiqueta: 'Nombre y apellido', grupo: 'identidad', tabla: 'clientes', columna: 'nombre', tipo: 'texto', cuenta: true, base: true,
    sinonimos: ['nombre', 'cliente', 'nombre del cliente', 'nombre y apellido', 'nombre completo', 'apellidos'] },
  { clave: 'consultora', etiqueta: 'Consultora', grupo: 'identidad', tabla: 'clientes', columna: 'consultora_id', tipo: 'texto', cuenta: true, base: true,
    sinonimos: ['consultora', 'consultor', 'asignada', 'consultora asignada', 'responsable', 'ficha de consultora', 'ficha consultora', 'consultora a cargo'] },
  { clave: 'email', etiqueta: 'Email', grupo: 'identidad', tabla: 'clientes', columna: 'email', tipo: 'texto', cuenta: true,
    sinonimos: ['email', 'mail', 'correo', 'e mail', 'correo electronico'] },
  { clave: 'telefono', etiqueta: 'Teléfono', grupo: 'identidad', tabla: 'clientes', columna: 'telefono', tipo: 'texto', cuenta: true,
    sinonimos: ['telefono', 'tel', 'celular', 'whatsapp', 'movil'] },
  { clave: 'pais', etiqueta: 'País', grupo: 'identidad', tabla: 'clientes', columna: 'pais', tipo: 'texto', cuenta: true,
    sinonimos: ['pais', 'país', 'country', 'nacionalidad'] },
  { clave: 'redes', etiqueta: 'Redes y sitios', grupo: 'identidad', tabla: 'clientes', columna: 'redes', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['redes', 'redes sociales', 'instagram', 'sitio web', 'web', 'linkedin', 'sitios web'],
    ayuda: 'Una línea por red, con el usuario o el link. Sólo las que tienen dato' },
  { clave: 'fuente', etiqueta: 'Cómo nos conoció', grupo: 'identidad', tabla: 'clientes', columna: 'fuente', tipo: 'texto', cuenta: true,
    sinonimos: ['fuente', 'de donde vino', 'origen', 'como nos conocio', 'como nos conociste', 'canal de entrada'] },
  { clave: 'programa_meses', etiqueta: 'Programa', grupo: 'identidad', tabla: 'clientes', columna: 'programa_meses', tipo: 'entero', cuenta: true, base: true,
    sinonimos: ['programa', 'meses', 'duracion', 'duracion del programa', 'plan'],
    ayuda: '4 o 6 meses' },
  { clave: 'fecha_inicio', etiqueta: 'Inicio del programa', grupo: 'identidad', tabla: 'clientes', columna: 'fecha_inicio', tipo: 'fecha', cuenta: true, base: true,
    sinonimos: ['inicio', 'fecha de inicio', 'inicio del programa', 'arranque', 'ingreso', 'ingreso reintegro'] },
  { clave: 'fecha_fin_prevista', etiqueta: 'Fin previsto', grupo: 'identidad', tabla: 'clientes', columna: 'fecha_fin_prevista', tipo: 'fecha', cuenta: true,
    sinonimos: ['fin', 'fecha de fin', 'fin previsto', 'finalizacion', 'fecha finalizacion'],
    ayuda: 'Sólo si se corrió de lo que sale del programa' },
  { clave: 'closer', etiqueta: 'Closer', grupo: 'identidad', tabla: 'clientes', columna: 'closer', tipo: 'texto', cuenta: true,
    sinonimos: ['closer', 'cerrador', 'quien cerro'] },
  { clave: 'setter', etiqueta: 'Setter', grupo: 'identidad', tabla: 'clientes', columna: 'setter', tipo: 'texto', cuenta: true,
    sinonimos: ['setter', 'quien agendo', 'agendador'] },
  { clave: 'horas_por_semana', etiqueta: 'Horas por semana', grupo: 'identidad', tabla: 'clientes', columna: 'horas_por_semana', tipo: 'numero', cuenta: true,
    sinonimos: ['horas', 'horas por semana', 'horas semanales', 'disponibilidad'],
    ayuda: 'Las que declaró para dedicarle al programa, no las que prometió en la venta' },
  { clave: 'etapa_actual', etiqueta: 'Etapa en la que está', grupo: 'identidad', tabla: 'clientes', columna: 'etapa_actual', tipo: 'opcion', cuenta: true, opciones: NOMBRES_DE_ETAPAS,
    sinonimos: ['etapa', 'etapa actual', 'en que etapa esta'],
    ayuda: 'La que elige la consultora. La aplicación deduce la suya del calendario; cuando no coinciden, eso es la conversación' },
  { clave: 'etapa_declarada', etiqueta: 'Etapa según la planilla', grupo: 'identidad', tabla: 'clientes', columna: 'etapa_declarada', tipo: 'texto', cuenta: true,
    sinonimos: ['etapa declarada', 'etapa planilla', 'etapa segun la planilla'],
    ayuda: 'La que escribe la consultora en su planilla' },
  { clave: 'estado', etiqueta: 'Estado', grupo: 'identidad', tabla: 'clientes', columna: 'estado', tipo: 'opcion', cuenta: true, base: true, opciones: ESTADOS, alias: { activa: 'activo', 'en curso': 'activo', 'dado de baja': 'baja', cancelado: 'baja', terminado: 'finalizado', progresando: 'activo' },
    sinonimos: ['estado', 'estatus', 'situacion', 'activo inactivo'] },

  // ── Quién es ────────────────────────────────────────────────────────────
  { clave: 'profesion_actual', etiqueta: 'A qué se dedica hoy', grupo: 'quien_es', tabla: 'cliente_quien_es', columna: 'profesion_actual', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['profesion', 'a que se dedica', 'ocupacion', 'actividades'] },
  { clave: 'frustracion_negocio', etiqueta: 'Qué le frustra en los negocios', grupo: 'quien_es', tabla: 'cliente_quien_es', columna: 'frustracion_negocio', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['frustracion', 'que te frustra', 'frustracion negocio'] },
  { clave: 'frustraciones_top3', etiqueta: 'Sus 3 frustraciones profesionales', grupo: 'quien_es', tabla: 'cliente_quien_es', columna: 'frustraciones_top3', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['frustraciones', 'tres frustraciones', 'principales frustraciones'],
    ayuda: 'Una por línea' },
  { clave: 'restricciones', etiqueta: 'Lo que le limita tiempo, espacio o capital', grupo: 'quien_es', tabla: 'cliente_quien_es', columna: 'restricciones', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['restricciones', 'limitaciones', 'que lo limita'] },
  { clave: 'como_coachearlo', etiqueta: 'Cómo quiere que lo acompañen', grupo: 'quien_es', tabla: 'cliente_quien_es', columna: 'como_coachearlo', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['como coachearte', 'forma de coachear', 'como acompanarlo'] },
  { clave: 'miedos', etiqueta: 'Miedos y creencias limitantes', grupo: 'quien_es', tabla: 'cliente_quien_es', columna: 'miedos', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['miedos', 'creencias', 'creencias limitantes'] },
  { clave: 'valores', etiqueta: 'Valores que quiere que su negocio refleje', grupo: 'quien_es', tabla: 'cliente_quien_es', columna: 'valores', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['valores', 'valores del negocio'],
    ayuda: 'En sus palabras, sin etiquetar su creencia' },
  { clave: 'motivo_ingreso', etiqueta: 'Por qué entró al programa', grupo: 'quien_es', tabla: 'cliente_quien_es', columna: 'motivo_ingreso', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['motivo', 'por que entro', 'que te motivo', 'motivo de ingreso'] },
  { clave: 'expectativas_programa', etiqueta: 'Qué espera del programa', grupo: 'quien_es', tabla: 'cliente_quien_es', columna: 'expectativas_programa', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['expectativas', 'que espera', 'que te encantaria'] },
  { clave: 'notas_cliente', etiqueta: 'Lo que dijo y no entra en otro campo', grupo: 'quien_es', tabla: 'cliente_quien_es', columna: 'notas_cliente', tipo: 'texto_largo', cuenta: false,
    sinonimos: ['notas del cliente', 'algo mas', 'espacio libre'],
    ayuda: 'El último recurso: sólo lo que no encaja en ningún otro campo' },

  // ── Su negocio, como llegó ──────────────────────────────────────────────
  { clave: 'nombre_negocio', etiqueta: 'Nombre del negocio', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'nombre_negocio', tipo: 'texto', cuenta: true,
    sinonimos: ['nombre del negocio', 'marca', 'empresa', 'nombre negocio'] },
  { clave: 'rubro', etiqueta: 'Rubro', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'rubro', tipo: 'texto', cuenta: true, base: true,
    sinonimos: ['rubro', 'industria', 'sector', 'nicho', 'actividad'] },
  { clave: 'que_vende', etiqueta: 'Qué vende hoy', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'que_vende', tipo: 'texto_largo', cuenta: true, base: true,
    sinonimos: ['que vende', 'producto', 'servicio', 'oferta actual', 'que hace tu negocio'] },
  { clave: 'historia_negocio', etiqueta: 'Cómo empezó y cómo evolucionó', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'historia_negocio', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['historia', 'historia del negocio', 'como empezo'] },
  { clave: 'antiguedad_negocio', etiqueta: 'Años vendiendo lo que vende hoy', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'antiguedad_negocio', tipo: 'numero', cuenta: true,
    sinonimos: ['antiguedad', 'anos en el negocio', 'anios en el negocio', 'antiguedad negocio', 'hace cuanto'] },
  { clave: 'etapa_percibida', etiqueta: 'En qué etapa siente que está', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'etapa_percibida', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['etapa percibida', 'en que etapa siente'] },
  { clave: 'vision_negocio', etiqueta: 'Qué piensa de su negocio y su potencial', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'vision_negocio', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['vision', 'que pensas de tu negocio', 'potencial'] },
  { clave: 'equipo', etiqueta: 'Personas que trabajan con él', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'equipo', tipo: 'entero', cuenta: true,
    sinonimos: ['equipo', 'tamano equipo', 'personas', 'empleados', 'cuanta gente'],
    ayuda: 'Sin contarlo a él. «Trabajo solo» es 0' },
  { clave: 'roles_equipo', etiqueta: 'Qué hace cada persona del equipo', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'roles_equipo', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['roles', 'roles del equipo', 'que hace cada uno'] },
  { clave: 'como_entrega', etiqueta: 'Cómo lo entrega hoy', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'como_entrega', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['como entrega', 'formato', 'modalidad', 'como funciona hoy'] },
  { clave: 'modelo_negocio', etiqueta: 'Modelo de negocio', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'modelo_negocio', tipo: 'opcion', cuenta: true, base: true, opciones: MODELOS, alias: { servicios: 'servicio', productos: 'producto', curso: 'infoproducto', 'info producto': 'infoproducto', digital: 'infoproducto' },
    sinonimos: ['modelo', 'modelo de negocio', 'tipo de negocio'] },
  { clave: 'a_quien_hoy', etiqueta: 'A quién le vende hoy', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'a_quien_hoy', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['a quien le vende', 'clientes actuales', 'a quien vende hoy'],
    ayuda: 'Los clientes reales que tiene, no su cliente ideal' },
  { clave: 'cliente_ideal_inicial', etiqueta: 'Cliente ideal al entrar', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'cliente_ideal_inicial', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['cliente ideal inicial', 'cliente ideal onboarding'] },
  { clave: 'problema_inicial', etiqueta: 'Problema que creía resolver al entrar', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'problema_inicial', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['problema inicial', 'dolor principal inicial'] },
  { clave: 'oferta_inicial', etiqueta: 'Sus ofertas al entrar', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'oferta_inicial', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['oferta inicial', 'ofertas actuales'] },

  // ── Su negocio, trabajado en el match de marca ──────────────────────────
  { clave: 'expertise', etiqueta: 'En qué es experto y qué le apasiona', grupo: 'marca', tabla: 'cliente_marca', columna: 'expertise', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['expertise', 'en que sos experto', 'especialidad'] },
  { clave: 'nichos_candidatos', etiqueta: 'Nichos que evaluó y su puntaje', grupo: 'marca', tabla: 'cliente_marca', columna: 'nichos_candidatos', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['nichos', 'nichos candidatos', 'matriz de nichos'],
    ayuda: '«nicho: total», uno por línea' },
  { clave: 'cliente_ideal', etiqueta: 'Cliente ideal', grupo: 'marca', tabla: 'cliente_negocio', columna: 'cliente_ideal', tipo: 'texto_largo', cuenta: true, base: true,
    sinonimos: ['cliente ideal', 'avatar', 'buyer persona', 'publico', 'a quien le vende'] },
  { clave: 'casos_reales', etiqueta: 'Casos reales de referencia', grupo: 'marca', tabla: 'cliente_marca', columna: 'casos_reales', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['casos reales', 'casos', 'clientes de referencia'],
    ayuda: 'Un caso por línea, con lo que logró' },
  { clave: 'problema', etiqueta: 'Problema que le resuelve', grupo: 'marca', tabla: 'cliente_negocio', columna: 'problema', tipo: 'texto_largo', cuenta: true, base: true,
    sinonimos: ['problema', 'dolor', 'que problema resuelve', 'pain'] },
  { clave: 'deseo', etiqueta: 'A dónde quiere llegar su cliente', grupo: 'marca', tabla: 'cliente_negocio', columna: 'deseo', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['deseo', 'que quiere', 'resultado deseado', 'aspiracion'],
    ayuda: 'Distinto del problema: el problema es lo que le duele, el deseo es a dónde quiere llegar' },
  { clave: 'metodo_que_odia', etiqueta: 'El método que su cliente ya probó y odia', grupo: 'marca', tabla: 'cliente_marca', columna: 'metodo_que_odia', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['metodo que odia', 'lo que odian', 'metodo odiado'] },
  { clave: 'capacidad_pago', etiqueta: 'Cuánto pagó ya por resolver esto', grupo: 'marca', tabla: 'cliente_marca', columna: 'capacidad_pago', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['capacidad de pago', 'filtro de alto valor', 'cuanto pago'] },
  { clave: 'soluciones_falsas', etiqueta: 'Lo que ofrece el mercado y por qué falla', grupo: 'marca', tabla: 'cliente_marca', columna: 'soluciones_falsas', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['soluciones falsas', 'competencia', 'que ofrece el mercado'] },
  { clave: 'objeciones_cliente', etiqueta: 'Por qué su cliente no le compra', grupo: 'marca', tabla: 'cliente_marca', columna: 'objeciones_cliente', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['objeciones del cliente', 'objeciones'],
    ayuda: 'Las de SU cliente con él. No confundir con las objeciones de la venta con Founders' },
  { clave: 'promesa', etiqueta: 'La PAI de su programa', grupo: 'marca', tabla: 'cliente_negocio', columna: 'promesa', tipo: 'texto_largo', cuenta: true, base: true,
    sinonimos: ['promesa', 'pai', 'promesa unica', 'big promise'] },
  { clave: 'promesas_secundarias', etiqueta: 'PAI para otros segmentos', grupo: 'marca', tabla: 'cliente_marca', columna: 'promesas_secundarias', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['promesas secundarias', 'otras pai'],
    ayuda: '«segmento: PAI», una por línea' },
  { clave: 'mecanismo', etiqueta: 'Mecanismo', grupo: 'marca', tabla: 'cliente_negocio', columna: 'mecanismo', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['mecanismo', 'como lo logra', 'metodo', 'sistema'] },
  { clave: 'pilares', etiqueta: 'Los pasos del proceso', grupo: 'marca', tabla: 'cliente_marca', columna: 'pilares', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['pilares', 'pasos', 'etapas del metodo'],
    ayuda: 'Dos o tres, como resultados, uno por línea' },
  { clave: 'diferencial', etiqueta: 'Diferencial', grupo: 'marca', tabla: 'cliente_negocio', columna: 'diferencial', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['diferencial', 'diferenciacion', 'ventaja', 'por que le compran'] },
  { clave: 'oferta', etiqueta: 'Oferta', grupo: 'marca', tabla: 'cliente_negocio', columna: 'oferta', tipo: 'texto_largo', cuenta: true, base: true,
    sinonimos: ['oferta', 'propuesta', 'que ofrece', 'paquete'],
    ayuda: 'El programa concreto: nombre, duración y formato' },
  { clave: 'mensaje', etiqueta: 'Mensaje', grupo: 'marca', tabla: 'cliente_negocio', columna: 'mensaje', tipo: 'texto_largo', cuenta: true, base: true,
    sinonimos: ['mensaje', 'posicionamiento', 'frase', 'mensaje central'] },
  { clave: 'frases_mercado', etiqueta: 'Frases textuales de su mercado', grupo: 'marca', tabla: 'cliente_marca', columna: 'frases_mercado', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['frases del mercado', 'frases textuales', 'voz del cliente'],
    ayuda: 'Citas literales, una por línea' },
  { clave: 'estado_encuesta', etiqueta: 'Encuestas enviadas y respuestas', grupo: 'marca', tabla: 'cliente_marca', columna: 'estado_encuesta', tipo: 'texto', cuenta: true,
    sinonimos: ['encuesta', 'estado de la encuesta', 'respuestas'],
    ayuda: '«15 enviadas, 18 respuestas»' },

  // ── Cómo consigue y cómo vende ──────────────────────────────────────────
  { clave: 'canal', etiqueta: 'Canal que mejor le funciona', grupo: 'comercializa', tabla: 'cliente_negocio', columna: 'canal', tipo: 'texto', cuenta: true, base: true,
    sinonimos: ['canal', 'canales', 'canal de venta', 'donde vende', 'medio'] },
  { clave: 'origen_clientes', etiqueta: 'Cómo le llegan los que pagan', grupo: 'comercializa', tabla: 'cliente_negocio', columna: 'origen_clientes', tipo: 'texto', cuenta: true,
    sinonimos: ['origen clientes', 'de donde vienen', 'como llegan'] },
  { clave: 'estrategia_marketing', etiqueta: 'Qué hace para darse a conocer', grupo: 'comercializa', tabla: 'cliente_comercializa', columna: 'estrategia_marketing', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['estrategia de marketing', 'marketing', 'como se da a conocer'] },
  { clave: 'hace_publicidad', etiqueta: 'Hace publicidad en redes', grupo: 'comercializa', tabla: 'cliente_comercializa', columna: 'hace_publicidad', tipo: 'booleano', cuenta: true,
    sinonimos: ['publicidad', 'pauta', 'ads', 'hace publicidad'] },
  { clave: 'usa_testimonios', etiqueta: 'Usa prueba social y testimonios', grupo: 'comercializa', tabla: 'cliente_comercializa', columna: 'usa_testimonios', tipo: 'booleano', cuenta: true,
    sinonimos: ['testimonios', 'prueba social'] },
  { clave: 'plataformas_ok', etiqueta: 'Sus plataformas están bien desarrolladas', grupo: 'comercializa', tabla: 'cliente_comercializa', columna: 'plataformas_ok', tipo: 'booleano', cuenta: true,
    sinonimos: ['plataformas', 'plataformas digitales'] },
  { clave: 'proceso_ventas', etiqueta: 'Qué pasa desde el interesado hasta que paga', grupo: 'comercializa', tabla: 'cliente_comercializa', columna: 'proceso_ventas', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['proceso de ventas', 'proceso comercial', 'embudo'],
    ayuda: 'Los pasos, en orden' },
  { clave: 'oportunidad_sin_explotar', etiqueta: 'Su mayor oportunidad sin explotar', grupo: 'comercializa', tabla: 'cliente_comercializa', columna: 'oportunidad_sin_explotar', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['oportunidad', 'oportunidad sin explotar', 'mayor oportunidad'] },
  { clave: 'cantidad_clientes', etiqueta: 'Clientes que le pagaron el último mes', grupo: 'numeros', tabla: 'cliente_negocio', columna: 'cantidad_clientes', tipo: 'entero', cuenta: true,
    sinonimos: ['cantidad de clientes', 'cuantos clientes', 'clientes activos'] },

  // ── Lo que ya probó ─────────────────────────────────────────────────────
  { clave: 'intentos_captacion', etiqueta: 'Todo lo que probó para conseguir clientes', grupo: 'intentos', tabla: 'cliente_intentos', columna: 'intentos_captacion', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['intentos', 'que intento', 'que ha intentado'] },
  { clave: 'que_funciono', etiqueta: 'Qué le funcionó', grupo: 'intentos', tabla: 'cliente_intentos', columna: 'que_funciono', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['que funciono', 'lo que funciono', 'que le funciono'] },
  { clave: 'que_no_funciono', etiqueta: 'Qué no le funcionó', grupo: 'intentos', tabla: 'cliente_intentos', columna: 'que_no_funciono', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['que no funciono', 'lo que no funciono', 'intentos fallidos', 'que probo'] },
  { clave: 'facturacion_historica', etiqueta: 'Mejor mes y peor mes', grupo: 'intentos', tabla: 'cliente_intentos', columna: 'facturacion_historica', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['facturacion historica', 'historico', 'mejor mes', 'peor mes'] },

  // ── Lo que quiere lograr ────────────────────────────────────────────────
  { clave: 'problemas_negocio', etiqueta: 'Problemas que siente que tiene su negocio', grupo: 'objetivos', tabla: 'cliente_objetivos', columna: 'problemas_negocio', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['problemas del negocio', 'que problemas tiene'],
    ayuda: 'Uno por línea' },
  { clave: 'necesidad_percibida', etiqueta: 'Qué cree que necesita para resolverlo', grupo: 'objetivos', tabla: 'cliente_objetivos', columna: 'necesidad_percibida', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['necesidad', 'que necesita', 'que crees que necesitas'] },
  { clave: 'objetivos_semanas', etiqueta: 'Objetivos de las próximas semanas', grupo: 'objetivos', tabla: 'cliente_objetivos', columna: 'objetivos_semanas', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['objetivos', 'objetivos semanales', 'tres objetivos'],
    ayuda: 'Uno por línea' },
  { clave: 'objetivo_meses', etiqueta: 'Qué quiere lograr en los próximos meses', grupo: 'objetivos', tabla: 'cliente_objetivos', columna: 'objetivo_meses', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['objetivo', 'que quiere lograr', 'objetivo de meses'],
    ayuda: 'Sin el número: el número va en la meta mensual' },
  { clave: 'meta_mensual', etiqueta: 'Meta mensual', grupo: 'objetivos', tabla: 'cliente_numeros', columna: 'meta_mensual', tipo: 'numero', cuenta: true, base: true,
    sinonimos: ['meta', 'meta mensual', 'objetivo de facturacion', 'a cuanto quiere llegar'] },

  // ── Sus números ─────────────────────────────────────────────────────────
  { clave: 'moneda', etiqueta: 'Moneda', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'moneda', tipo: 'texto', cuenta: true,
    sinonimos: ['moneda', 'divisa', 'currency'] },
  { clave: 'precio_actual', etiqueta: 'Lo que cobra hoy por cada producto', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'precio_actual', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['precio', 'precio actual', 'cuanto cobra', 'precios'],
    ayuda: '«producto: precio», uno por línea' },
  { clave: 'facturacion_actual', etiqueta: 'Lo que cobró el último mes', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'facturacion_actual', tipo: 'numero', cuenta: true,
    sinonimos: ['facturacion', 'facturacion actual', 'factura hoy', 'cuanto cobro'] },
  { clave: 'ventas_ultimo_mes', etiqueta: 'Ventas nuevas del último mes', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'ventas_ultimo_mes', tipo: 'entero', cuenta: true,
    sinonimos: ['ventas', 'ventas del mes', 'ventas ultimo mes', 'cierres'] },
  { clave: 'tiene_tracker', etiqueta: 'Lleva registro de ventas y números', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'tiene_tracker', tipo: 'booleano', cuenta: true,
    sinonimos: ['tracker', 'lleva registro', 'planilla de ventas'] },
  { clave: 'ticket', etiqueta: 'Ticket', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'ticket', tipo: 'numero', cuenta: true, base: true,
    sinonimos: ['ticket', 'ticket promedio', 'valor promedio'],
    ayuda: 'El precio de referencia con el que se hace la cuenta inversa. Lo carga la consultora' },

  // ── Lo que se dijo en la venta ──────────────────────────────────────────
  { clave: 'dolor_textual', etiqueta: 'El dolor con sus palabras', grupo: 'venta', tabla: 'cliente_venta', columna: 'dolor_textual', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['dolor textual', 'dolor', 'cita del dolor'],
    ayuda: 'Cita literal, sin resumir' },
  { clave: 'objeciones_venta', etiqueta: 'Lo que lo hizo dudar', grupo: 'venta', tabla: 'cliente_venta', columna: 'objeciones_venta', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['objeciones de la venta', 'objeciones venta', 'dudas'] },
  { clave: 'valor_prometido', etiqueta: 'Valor que se le dijo', grupo: 'venta', tabla: 'cliente_venta', columna: 'valor_prometido', tipo: 'numero', cuenta: true,
    sinonimos: ['valor prometido', 'precio dicho'] },
  { clave: 'forma_pago_prometida', etiqueta: 'Forma de pago acordada', grupo: 'venta', tabla: 'cliente_venta', columna: 'forma_pago_prometida', tipo: 'opcion', cuenta: true, opciones: FORMAS_PAGO,
    sinonimos: ['forma de pago prometida'] },
  { clave: 'cuotas_prometidas', etiqueta: 'Cuántas cuotas y de cuánto', grupo: 'venta', tabla: 'cliente_venta', columna: 'cuotas_prometidas', tipo: 'texto', cuenta: true,
    sinonimos: ['cuotas prometidas'],
    ayuda: '«2000 + 1000 + 500»' },
  { clave: 'garantia_mencionada', etiqueta: 'Se le mencionó una garantía', grupo: 'venta', tabla: 'cliente_venta', columna: 'garantia_mencionada', tipo: 'booleano', cuenta: true,
    sinonimos: ['garantia mencionada'] },

  // ── Lo comercial: sale del contrato, no de los documentos ───────────────
  { clave: 'valor_programa', etiqueta: 'Valor del programa', grupo: 'comercial', tabla: 'cliente_comercial', columna: 'valor_programa', tipo: 'numero', cuenta: true,
    sinonimos: ['valor', 'valor del programa', 'precio del programa', 'inversion'] },
  { clave: 'forma_pago', etiqueta: 'Forma de pago', grupo: 'comercial', tabla: 'cliente_comercial', columna: 'forma_pago', tipo: 'opcion', cuenta: true, opciones: FORMAS_PAGO,
    sinonimos: ['forma de pago', 'pago', 'modalidad de pago'] },
  { clave: 'cuotas_totales', etiqueta: 'Cuotas', grupo: 'comercial', tabla: 'cliente_comercial', columna: 'cuotas_totales', tipo: 'entero', cuenta: true,
    sinonimos: ['cuotas', 'cantidad de cuotas', 'cuotas totales'] },
  { clave: 'garantia', etiqueta: 'Garantía firmada', grupo: 'comercial', tabla: 'cliente_comercial', columna: 'garantia', tipo: 'booleano', cuenta: true,
    sinonimos: ['garantia', 'garantia firmada'] },
]
export const CAMPOS_POR_CLAVE: ReadonlyMap<string, Campo> = new Map(CAMPOS.map((c) => [c.clave, c]))

/** Cuántos datos se cuentan para el «le faltan N de M». */
export const TOTAL_CAMPOS = CAMPOS.filter((c) => c.cuenta).length

/**
 * Los campos con los que la aplicación puede contestar algo.
 *
 * Es el número que va arriba en la ficha. El otro —los 93— es cuánto se puede
 * saber de un cliente, no cuánto hace falta para analizarlo.
 */
export const CAMPOS_BASE = CAMPOS.filter((c) => c.base === true)
export const TOTAL_BASE = CAMPOS_BASE.length

export const ETIQUETA_GRUPO: Record<Grupo, string> = {
  identidad: 'Identidad y programa',
  quien_es: 'Quién es',
  negocio: 'Su negocio, como llegó',
  marca: 'Su negocio, trabajado en el programa',
  comercializa: 'Cómo consigue y cómo vende',
  intentos: 'Lo que ya probó',
  objetivos: 'Lo que quiere lograr',
  numeros: 'Sus números',
  venta: 'Lo que se dijo en la venta',
  comercial: 'Lo comercial',
}

/** Por qué existe cada bloque, para el que se pregunte qué carga ahí. */
export const POR_QUE_EL_GRUPO: Partial<Record<Grupo, string>> = {
  negocio: 'Cómo llegó, no cómo está. Lo que contestó en el onboarding antes de empezar a trabajarlo. La distancia entre esto y el bloque de abajo es el programa funcionando.',
  marca: 'Lo que salió de trabajarlo con la consultora en el match de marca. Sale de ahí y de ningún otro lado: si el match no está, esto queda vacío.',
  intentos: 'Para no volver a proponerle una estrategia que ya le falló.',
  venta: 'Lo que se habló en la llamada, que no es lo firmado. Lo firmado está en «Lo comercial». Sirve para contrastar los dos.',
}

/** Los textos que la planilla trae en columnas y se guardan como documentos. */
export const DOCUMENTOS_DE_PLANILLA = [
  { tipo: 'onboarding', etiqueta: 'Formulario de onboarding', sinonimos: ['onboarding', 'texto onboarding', 'formulario onboarding', 'formulario de onboarding', 'respuestas onboarding'] },
  { tipo: 'llamada_venta', etiqueta: 'Llamada de venta', sinonimos: ['llamada de venta', 'texto llamada de venta', 'llamada venta', 'transcripcion venta', 'call de venta'] },
  { tipo: 'contrato', etiqueta: 'Contrato', sinonimos: ['contrato', 'texto contrato'] },
  { tipo: 'notas', etiqueta: 'Notas de la consultora', sinonimos: ['notas', 'notas consultora', 'observaciones', 'comentarios'] },
] as const

export type TipoDocumento = 'onboarding' | 'match_de_marca' | 'llamada_venta' | 'contrato' | 'sesion' | 'notas' | 'otro'

export const ETIQUETA_DOCUMENTO: Record<TipoDocumento, string> = {
  onboarding: 'Formulario de onboarding',
  match_de_marca: 'Match de marca',
  llamada_venta: 'Llamada de venta',
  contrato: 'Contrato',
  sesion: 'Sesión',
  notas: 'Notas',
  otro: 'Otro',
}

/**
 * En qué pestaña de la ficha se carga cada dato.
 *
 * Es lo que permite que «falta la oferta» sea un enlace que te deja escribiendo
 * la oferta. Decir qué falta y no decir dónde se carga es la mitad del trabajo.
 */
export const PESTANA_DEL_GRUPO: Record<Grupo, string> = {
  identidad: 'resumen',
  quien_es: 'cliente',
  negocio: 'cliente',
  marca: 'cliente',
  comercializa: 'cliente',
  intentos: 'cliente',
  objetivos: 'cliente',
  numeros: 'cliente',
  venta: 'cliente',
  comercial: 'cliente',
}

/** El enlace que lleva a cargar ese dato, ya abierto para escribir. */
export function dondeSeCarga(clienteId: number, clave: string): string | null {
  const campo = CAMPOS_POR_CLAVE.get(clave)
  if (!campo) return null
  return `/clientes/${clienteId}?bloque=${PESTANA_DEL_GRUPO[campo.grupo]}&campo=${campo.clave}`
}
