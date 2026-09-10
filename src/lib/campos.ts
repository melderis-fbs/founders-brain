/**
 * El registro de campos: la única lista de qué datos tiene un cliente.
 *
 * De acá salen tres cosas y por eso vive en un solo lugar:
 *  1. qué columnas de la planilla se entienden y a dónde van,
 *  2. qué datos le faltan a un cliente (nombrados, no contados),
 *  3. cómo se dibuja y se edita la ficha.
 */

export type TipoCampo = 'texto' | 'texto_largo' | 'numero' | 'entero' | 'fecha' | 'booleano' | 'opcion'

export type Grupo = 'identidad' | 'negocio' | 'autoridad' | 'intentos' | 'numeros' | 'comercial'

export type Campo = {
  clave: string
  etiqueta: string
  grupo: Grupo
  tabla: 'clientes' | 'cliente_negocio' | 'cliente_autoridad' | 'cliente_intentos' | 'cliente_numeros' | 'cliente_comercial'
  columna: string
  tipo: TipoCampo
  /** Cuenta para «le faltan N de 32 datos». */
  cuenta: boolean
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
  // ── Identidad y programa ────────────────────────────────────────────────
  { clave: 'nombre', etiqueta: 'Nombre', grupo: 'identidad', tabla: 'clientes', columna: 'nombre', tipo: 'texto', cuenta: true,
    sinonimos: ['nombre', 'cliente', 'nombre del cliente', 'nombre y apellido', 'nombre completo'] },
  { clave: 'consultora', etiqueta: 'Consultora', grupo: 'identidad', tabla: 'clientes', columna: 'consultora_id', tipo: 'texto', cuenta: true,
    sinonimos: ['consultora', 'consultor', 'asignada', 'consultora asignada', 'responsable'] },
  { clave: 'email', etiqueta: 'Email', grupo: 'identidad', tabla: 'clientes', columna: 'email', tipo: 'texto', cuenta: true,
    sinonimos: ['email', 'mail', 'correo', 'e mail', 'correo electronico'] },
  { clave: 'telefono', etiqueta: 'Teléfono', grupo: 'identidad', tabla: 'clientes', columna: 'telefono', tipo: 'texto', cuenta: true,
    sinonimos: ['telefono', 'tel', 'celular', 'whatsapp', 'wpp'] },
  { clave: 'programa_meses', etiqueta: 'Programa', grupo: 'identidad', tabla: 'clientes', columna: 'programa_meses', tipo: 'entero', cuenta: true,
    sinonimos: ['programa', 'programa meses', 'meses', 'duracion', 'duracion programa', 'plan'], ayuda: '4 o 6 meses' },
  { clave: 'fecha_inicio', etiqueta: 'Inicio del programa', grupo: 'identidad', tabla: 'clientes', columna: 'fecha_inicio', tipo: 'fecha', cuenta: true,
    sinonimos: ['fecha inicio', 'inicio', 'fecha de inicio', 'arranque', 'fecha alta', 'inicio programa'] },
  { clave: 'fecha_fin_prevista', etiqueta: 'Fin previsto', grupo: 'identidad', tabla: 'clientes', columna: 'fecha_fin_prevista', tipo: 'fecha', cuenta: false,
    sinonimos: ['fecha fin', 'fin', 'fecha de fin', 'fin previsto', 'vencimiento programa'], ayuda: 'Sólo si se corrió de lo que sale del programa' },
  { clave: 'fuente', etiqueta: 'De dónde vino', grupo: 'identidad', tabla: 'clientes', columna: 'fuente', tipo: 'texto', cuenta: true,
    sinonimos: ['fuente', 'origen', 'de donde vino', 'como llego', 'canal de adquisicion'] },
  { clave: 'closer', etiqueta: 'Closer', grupo: 'identidad', tabla: 'clientes', columna: 'closer', tipo: 'texto', cuenta: true,
    sinonimos: ['closer', 'cerro la venta', 'vendedor'] },
  { clave: 'setter', etiqueta: 'Setter', grupo: 'identidad', tabla: 'clientes', columna: 'setter', tipo: 'texto', cuenta: true,
    sinonimos: ['setter', 'agendo', 'quien agendo'] },
  { clave: 'horas_por_semana', etiqueta: 'Horas por semana', grupo: 'identidad', tabla: 'clientes', columna: 'horas_por_semana', tipo: 'numero', cuenta: true,
    sinonimos: ['horas', 'horas por semana', 'horas semanales', 'disponibilidad'],
    ayuda: 'Las que declaró en la sesión 1, no las que dijo en la venta' },
  { clave: 'estado', etiqueta: 'Estado', grupo: 'identidad', tabla: 'clientes', columna: 'estado', tipo: 'opcion', cuenta: true, opciones: ESTADOS,
    alias: { 'en curso': 'activo', activa: 'activo', 'de baja': 'baja', 'dado de baja': 'baja', cancelado: 'baja', terminado: 'finalizado', finalizada: 'finalizado', pausada: 'pausado', freezado: 'pausado' },
    sinonimos: ['estado', 'situacion', 'estado del cliente'] },

  // ── Su negocio ──────────────────────────────────────────────────────────
  { clave: 'rubro', etiqueta: 'Rubro', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'rubro', tipo: 'texto', cuenta: true,
    sinonimos: ['rubro', 'industria', 'sector', 'nicho'] },
  { clave: 'que_vende', etiqueta: 'Qué vende', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'que_vende', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['que vende', 'producto', 'servicio', 'que hace', 'a que se dedica'] },
  { clave: 'cliente_ideal', etiqueta: 'Cliente ideal', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'cliente_ideal', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['cliente ideal', 'a quien le vende', 'publico', 'avatar', 'target', 'buyer persona'] },
  { clave: 'problema', etiqueta: 'Problema que resuelve', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'problema', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['problema', 'dolor', 'problema que resuelve', 'necesidad'] },
  { clave: 'oferta', etiqueta: 'Oferta', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'oferta', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['oferta', 'oferta cerrada', 'propuesta'] },
  { clave: 'promesa', etiqueta: 'Promesa', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'promesa', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['promesa', 'resultado prometido', 'promesa de la oferta'] },
  { clave: 'mensaje', etiqueta: 'Mensaje', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'mensaje', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['mensaje', 'comunicacion', 'copy', 'pitch'] },
  { clave: 'a_quien_hoy', etiqueta: 'A quién le vende hoy', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'a_quien_hoy', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['a quien le vende hoy', 'a quien', 'clientes actuales', 'a quien vende'],
    ayuda: 'Distinto del cliente ideal: la diferencia entre los dos es el trabajo de la etapa Definición' },
  { clave: 'deseo', etiqueta: 'Qué quiere (deseo)', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'deseo', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['deseo', 'que quiere', 'lo que busca', 'aspiracion'],
    ayuda: 'Distinto del problema: el problema es lo que le duele, el deseo es a dónde quiere llegar' },
  { clave: 'mecanismo', etiqueta: 'Mecanismo', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'mecanismo', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['mecanismo', 'como lo logra', 'metodo', 'proceso'] },
  { clave: 'como_entrega', etiqueta: 'Cómo lo entrega', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'como_entrega', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['como entrega', 'como lo entrega', 'entrega', 'formato'] },
  { clave: 'cantidad_clientes', etiqueta: 'Cuántos clientes tiene', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'cantidad_clientes', tipo: 'entero', cuenta: true,
    sinonimos: ['cantidad de clientes', 'cuantos clientes', 'clientes activos', 'cartera'] },
  { clave: 'origen_clientes', etiqueta: 'De dónde vienen sus clientes', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'origen_clientes', tipo: 'texto', cuenta: true,
    sinonimos: ['origen de los clientes', 'de donde vienen', 'origen clientes'] },
  { clave: 'canal', etiqueta: 'Canal', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'canal', tipo: 'texto', cuenta: true,
    sinonimos: ['canal', 'canales', 'canal de venta', 'donde vende', 'medio'] },
  { clave: 'diferencial', etiqueta: 'Diferencial', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'diferencial', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['diferencial', 'diferenciacion', 'ventaja', 'por que le compran'] },
  { clave: 'modelo_negocio', etiqueta: 'Modelo de negocio', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'modelo_negocio', tipo: 'opcion', cuenta: true, opciones: MODELOS,
    alias: { servicios: 'servicio', productos: 'producto', curso: 'infoproducto', 'info producto': 'infoproducto', digital: 'infoproducto' },
    sinonimos: ['modelo', 'modelo de negocio', 'tipo de negocio'] },
  { clave: 'antiguedad_negocio', etiqueta: 'Años en el negocio', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'antiguedad_negocio', tipo: 'numero', cuenta: true,
    sinonimos: ['antiguedad', 'anos en el negocio', 'anios en el negocio', 'antiguedad negocio', 'hace cuanto'] },
  { clave: 'equipo', etiqueta: 'Tamaño del equipo', grupo: 'negocio', tabla: 'cliente_negocio', columna: 'equipo', tipo: 'entero', cuenta: true,
    sinonimos: ['equipo', 'tamano equipo', 'personas', 'empleados', 'cuanta gente'] },

  // ── Su autoridad ────────────────────────────────────────────────────────
  { clave: 'hace_bien', etiqueta: 'Qué hace excepcionalmente bien', grupo: 'autoridad', tabla: 'cliente_autoridad', columna: 'hace_bien', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['hace excepcionalmente bien', 'que hace bien', 'fortaleza', 'talento'] },
  { clave: 'experiencia_profesional', etiqueta: 'Experiencia profesional', grupo: 'autoridad', tabla: 'cliente_autoridad', columna: 'experiencia_profesional', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['experiencia', 'experiencia profesional', 'trayectoria', 'background'] },
  { clave: 'resultados_propios', etiqueta: 'Resultados propios', grupo: 'autoridad', tabla: 'cliente_autoridad', columna: 'resultados_propios', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['resultados propios', 'sus resultados', 'logros'] },
  { clave: 'resultados_terceros', etiqueta: 'Resultados de terceros', grupo: 'autoridad', tabla: 'cliente_autoridad', columna: 'resultados_terceros', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['resultados de terceros', 'casos de exito', 'testimonios', 'resultados clientes'] },
  { clave: 'industrias_que_conoce', etiqueta: 'Industrias que conoce', grupo: 'autoridad', tabla: 'cliente_autoridad', columna: 'industrias_que_conoce', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['industrias', 'industrias que conoce', 'mercados', 'sectores que conoce'] },
  { clave: 'autoridad_desperdiciada', etiqueta: 'Autoridad desperdiciada', grupo: 'autoridad', tabla: 'cliente_autoridad', columna: 'autoridad_desperdiciada', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['autoridad desperdiciada', 'lo que no usa', 'credibilidad sin usar'],
    ayuda: 'Dónde ya tiene lenguaje, contactos y credibilidad, y no los está usando' },

  // ── Lo que ya probó ─────────────────────────────────────────────────────
  { clave: 'que_funciono', etiqueta: 'Qué le funcionó', grupo: 'intentos', tabla: 'cliente_intentos', columna: 'que_funciono', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['que funciono', 'lo que funciono', 'que le funciono'] },
  { clave: 'que_no_funciono', etiqueta: 'Qué no le funcionó', grupo: 'intentos', tabla: 'cliente_intentos', columna: 'que_no_funciono', tipo: 'texto_largo', cuenta: true,
    sinonimos: ['que no funciono', 'lo que no funciono', 'intentos fallidos', 'que probo'] },
  { clave: 'facturacion_historica', etiqueta: 'Facturación histórica', grupo: 'intentos', tabla: 'cliente_intentos', columna: 'facturacion_historica', tipo: 'texto_largo', cuenta: false,
    sinonimos: ['facturacion historica', 'historial de facturacion', 'como venia facturando'] },

  // ── Sus números ─────────────────────────────────────────────────────────
  { clave: 'moneda', etiqueta: 'Moneda', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'moneda', tipo: 'texto', cuenta: true,
    sinonimos: ['moneda', 'divisa'] },
  { clave: 'ticket', etiqueta: 'Ticket', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'ticket', tipo: 'numero', cuenta: true,
    sinonimos: ['ticket', 'ticket promedio', 'valor ticket', 'precio promedio'] },
  { clave: 'meta_mensual', etiqueta: 'Meta mensual', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'meta_mensual', tipo: 'numero', cuenta: true,
    sinonimos: ['meta', 'meta mensual', 'objetivo mensual', 'facturacion objetivo', 'meta de facturacion'] },
  { clave: 'facturacion_actual', etiqueta: 'Facturación de hoy', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'facturacion_actual', tipo: 'numero', cuenta: true,
    sinonimos: ['facturacion actual', 'facturacion', 'factura hoy', 'facturacion mensual actual'] },
  { clave: 'precio_actual', etiqueta: 'Precio que cobra hoy', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'precio_actual', tipo: 'numero', cuenta: true,
    sinonimos: ['precio', 'precio actual', 'precio de venta', 'cuanto cobra'] },
  { clave: 'ventas_ultimo_mes', etiqueta: 'Ventas del último mes', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'ventas_ultimo_mes', tipo: 'entero', cuenta: true,
    sinonimos: ['ventas ultimo mes', 'ventas mes', 'ventas', 'cantidad de ventas'] },
  { clave: 'tiene_tracker', etiqueta: 'Tiene tracker', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'tiene_tracker', tipo: 'booleano', cuenta: true,
    sinonimos: ['tracker', 'tiene tracker', 'usa tracker', 'carga tracker'] },
  { clave: 'fecha_cuenta_inversa', etiqueta: 'Cuenta inversa hecha', grupo: 'numeros', tabla: 'cliente_numeros', columna: 'fecha_cuenta_inversa', tipo: 'fecha', cuenta: true,
    sinonimos: ['cuenta inversa', 'fecha cuenta inversa', 'cuenta regresiva'] },

  // ── Lo comercial ────────────────────────────────────────────────────────
  { clave: 'valor_programa', etiqueta: 'Valor del programa', grupo: 'comercial', tabla: 'cliente_comercial', columna: 'valor_programa', tipo: 'numero', cuenta: true,
    sinonimos: ['valor programa', 'valor del programa', 'monto', 'monto total', 'precio programa'] },
  { clave: 'forma_pago', etiqueta: 'Forma de pago', grupo: 'comercial', tabla: 'cliente_comercial', columna: 'forma_pago', tipo: 'opcion', cuenta: true, opciones: FORMAS_PAGO,
    alias: { 'un pago': 'contado', 'pago unico': 'contado', financiado: 'cuotas', 'en cuotas': 'cuotas' },
    sinonimos: ['forma de pago', 'pago', 'modalidad de pago'] },
  { clave: 'cuotas_totales', etiqueta: 'Cuotas', grupo: 'comercial', tabla: 'cliente_comercial', columna: 'cuotas_totales', tipo: 'entero', cuenta: true,
    sinonimos: ['cuotas', 'cantidad de cuotas', 'cuotas totales'] },
  { clave: 'garantia', etiqueta: 'Garantía firmada', grupo: 'comercial', tabla: 'cliente_comercial', columna: 'garantia', tipo: 'booleano', cuenta: true,
    sinonimos: ['garantia', 'tiene garantia', 'garantia firmada'] },
]

export const CAMPOS_POR_CLAVE: ReadonlyMap<string, Campo> = new Map(CAMPOS.map((c) => [c.clave, c]))

/** Cuántos datos se cuentan para el «le faltan N de M». */
export const TOTAL_CAMPOS = CAMPOS.filter((c) => c.cuenta).length

export const ETIQUETA_GRUPO: Record<Grupo, string> = {
  identidad: 'Identidad y programa',
  negocio: 'Su negocio',
  autoridad: 'Su autoridad',
  intentos: 'Lo que ya probó',
  numeros: 'Sus números',
  comercial: 'Lo comercial',
}

/** Por qué existe cada bloque, para el que se pregunte qué carga ahí. */
export const POR_QUE_EL_GRUPO: Partial<Record<Grupo, string>> = {
  autoridad: 'Nunca se descarta la experiencia previa porque el cliente diga que no quiere ese mercado: la oportunidad suele estar donde ya tiene lenguaje, contactos y credibilidad.',
  intentos: 'Para no volver a proponerle una estrategia que ya le falló.',
}

/** Los textos que la planilla trae en columnas y se guardan como documentos. */
export const DOCUMENTOS_DE_PLANILLA = [
  { tipo: 'onboarding', etiqueta: 'Formulario de onboarding', sinonimos: ['onboarding', 'texto onboarding', 'formulario onboarding', 'formulario de onboarding', 'respuestas onboarding'] },
  { tipo: 'llamada_venta', etiqueta: 'Llamada de venta', sinonimos: ['llamada de venta', 'texto llamada de venta', 'llamada venta', 'transcripcion venta', 'call de venta'] },
  { tipo: 'contrato', etiqueta: 'Contrato', sinonimos: ['contrato', 'texto contrato'] },
  { tipo: 'notas', etiqueta: 'Notas de la consultora', sinonimos: ['notas', 'notas consultora', 'observaciones', 'comentarios'] },
] as const

export type TipoDocumento = 'onboarding' | 'llamada_venta' | 'contrato' | 'sesion' | 'notas' | 'otro'

export const ETIQUETA_DOCUMENTO: Record<TipoDocumento, string> = {
  onboarding: 'Formulario de onboarding',
  llamada_venta: 'Llamada de venta',
  contrato: 'Contrato',
  sesion: 'Sesión',
  notas: 'Notas',
  otro: 'Otro',
}
