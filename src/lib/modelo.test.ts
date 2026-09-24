import { describe, expect, it } from 'vitest'
import { CAMPOS, CAMPOS_POR_CLAVE } from './campos'
import { acotaCampos, camposInventados, camposQueBuscar, LECTURA } from './lectura-de-documentos'
import { explicarError, partirAnalisis, partirDiagnostico, partirPropuestas, reglasDeFicha, reglasDelCruce, sacarSeccion } from './modelo'

describe('partir el análisis de una sesión', () => {
  const respuesta = `## Qué pasó
Cerró la oferta y quedó en escribirle a diez contactos esta semana.

## Puntos
- La oferta quedó definida: «lo que vendo es el programa de ocho semanas».
- No tiene canal elegido todavía: «no sé si Instagram o LinkedIn».
- Dijo que tiene poco tiempo: «me quedan dos horas por semana».

## Compromisos
- Escribirle a diez contactos antes del viernes.
- Mandar la oferta escrita el lunes.`

  it('saca la línea que se lee en la lista', () => {
    expect(partirAnalisis(respuesta).quePaso).toBe('Cerró la oferta y quedó en escribirle a diez contactos esta semana.')
  })

  it('saca los puntos y los compromisos, sin las viñetas', () => {
    const a = partirAnalisis(respuesta)
    expect(a.puntos).toHaveLength(3)
    expect(a.puntos[0]).toContain('La oferta quedó definida')
    expect(a.compromisos).toEqual([
      'Escribirle a diez contactos antes del viernes.',
      'Mandar la oferta escrita el lunes.',
    ])
  })

  it('nunca más de cinco puntos, aunque el modelo mande siete', () => {
    const siete = `## Puntos\n${[1, 2, 3, 4, 5, 6, 7].map((n) => `- punto ${n}`).join('\n')}`
    expect(partirAnalisis(siete).puntos).toHaveLength(5)
  })

  it('si el formato no vino, no se pierde el texto', () => {
    const suelto = 'El cliente contó que cerró la oferta.'
    const a = partirAnalisis(suelto)
    expect(a.texto).toBe(suelto)
    expect(a.puntos).toEqual([])
    expect(a.quePaso).toBeNull()
  })
})

describe('los errores de la API, en castellano', () => {
  it('el de la clave sin workspace dice los dos arreglos', () => {
    const e = { status: 400, error: { error: { message: 'This API key is not scoped to a workspace, so...' } } }
    expect(explicarError(e)).toContain('ANTHROPIC_WORKSPACE_ID')
  })
  it('el 401 manda a generar una nueva', () => {
    expect(explicarError({ status: 401, message: 'unauthorized' })).toContain('no es válida')
  })
  it('el de saldo dice dónde cargarlo', () => {
    expect(explicarError({ status: 400, error: { error: { message: 'Your credit balance is too low' } } })).toContain('crédito')
  })
})

describe('partir el diagnóstico', () => {
  const respuesta = `## Dónde se corta
En conseguir conversaciones: la oferta está cerrada pero no hay mensaje ni canal.

## Por qué
La ficha dice que la oferta está cerrada, pero «Mensaje: NO CARGADO» y «Canal: NO CARGADO».
En la sesión dijo: «Empiezo a escribir el mensaje y lo borro».

## ¿Es el cliente o somos nosotros?
Somos nosotros: pasaron 26 semanas desde que vencía el mensaje y nadie lo trabajó en sesión.

## Qué hacer
- Escribir el mensaje con él en la próxima sesión, no de tarea.
- Elegir un solo canal y no dos.
- Poner su experiencia de finanzas en el perfil.

## Qué falta cargar
- El tracker semanal: sin eso no se sabe si escribe o no.
- Las ventas: hoy figuran SIN DATOS.`

  it('saca dónde se corta y de quién es', () => {
    const d = partirDiagnostico(respuesta)
    expect(d.dondeSeCorta).toContain('conseguir conversaciones')
    expect(d.deQuienEs).toContain('Somos nosotros')
  })

  it('nunca más de tres acciones, aunque el modelo mande cinco', () => {
    const cinco = `## Qué hacer\n${[1, 2, 3, 4, 5].map((n) => `- acción ${n}`).join('\n')}`
    expect(partirDiagnostico(cinco).acciones).toHaveLength(3)
  })

  it('trae lo que falta cargar, nombrado', () => {
    const d = partirDiagnostico(respuesta)
    expect(d.faltaCargar).toHaveLength(2)
    expect(d.faltaCargar[0]).toContain('tracker')
  })

  it('si el formato no vino, no se pierde el texto', () => {
    const d = partirDiagnostico('Se corta en la oferta.')
    expect(d.texto).toBe('Se corta en la oferta.')
    expect(d.acciones).toEqual([])
  })
})

describe('partir las propuestas de la ficha', () => {
  const PERMITIDAS = new Set(['oferta', 'ticket', 'experiencia_profesional'])

  const respuesta = `### oferta
valor: Programa de 8 semanas con acompañamiento semanal
cita: «quedó en ocho semanas, acompañamiento semanal»

### experiencia_profesional
valor: 12 años como gerente de finanzas en una empresa de logística
cita: «vos fuiste doce años gerente de finanzas en una empresa de logística»`

  it('saca el valor y la cita de cada campo', () => {
    const { propuestas } = partirPropuestas(respuesta, PERMITIDAS)
    expect(propuestas).toHaveLength(2)
    expect(propuestas[0]).toMatchObject({ campo: 'oferta' })
    expect(propuestas[0].cita).toBe('quedó en ocho semanas, acompañamiento semanal')
  })

  it('regla 5 · sin cita no hay propuesta', () => {
    const sinCita = '### ticket\nvalor: 2000'
    const { propuestas, descartadas } = partirPropuestas(sinCita, PERMITIDAS)
    expect(propuestas).toHaveLength(0)
    expect(descartadas[0]).toContain('sin cita')
  })

  it('regla 9 · un campo que no estaba faltando no entra, aunque lo proponga', () => {
    const intruso = '### nombre\nvalor: Otro Nombre\ncita: «se llama Otro Nombre»'
    const { propuestas, descartadas } = partirPropuestas(intruso, PERMITIDAS)
    expect(propuestas).toHaveLength(0)
    expect(descartadas[0]).toContain('no es un campo que estuviera faltando')
  })

  it('un campo inventado se descarta con su motivo', () => {
    const { descartadas } = partirPropuestas('### color_favorito\nvalor: verde\ncita: «le gusta el verde»', PERMITIDAS)
    expect(descartadas[0]).toContain('color_favorito')
  })

  it('le dice en qué forma espera cada valor, así no se pierde el dato por la forma', () => {
    const reglas = reglasDeFicha([
      CAMPOS_POR_CLAVE.get('equipo')!,
      CAMPOS_POR_CLAVE.get('fecha_inicio')!,
      CAMPOS_POR_CLAVE.get('forma_pago')!,
    ])
    expect(reglas).toContain('un número entero solo')
    expect(reglas).toContain('dd/mm/aaaa')
    expect(reglas).toContain('contado, cuotas')
  })

  it('sólo lista los campos que faltan: los cargados no se mencionan', () => {
    const reglas = reglasDeFicha([CAMPOS_POR_CLAVE.get('oferta')!])
    expect(reglas).toContain('- oferta —')
    expect(reglas).not.toContain('- nombre —')
  })

  it('lo lee igual si viene en negrita en vez de título', () => {
    const negrita = '**oferta**\nvalor: programa de ocho semanas\ncita: «quedó en ocho semanas»'
    const { propuestas } = partirPropuestas(negrita, PERMITIDAS)
    expect(propuestas).toEqual([{ campo: 'oferta', valor: 'programa de ocho semanas', cita: 'quedó en ocho semanas' }])
  })

  it('lo lee igual si viene como «campo: oferta»', () => {
    const etiquetado = 'campo: oferta\n- valor: programa de ocho semanas\n- cita: «quedó en ocho semanas»'
    const { propuestas } = partirPropuestas(etiquetado, PERMITIDAS)
    expect(propuestas[0]).toMatchObject({ campo: 'oferta', valor: 'programa de ocho semanas' })
  })

  it('una cita cortada en dos renglones se junta entera', () => {
    const partida = '### oferta\nvalor: programa de ocho semanas\ncita: «quedó en ocho semanas,\ncon acompañamiento semanal»'
    const { propuestas } = partirPropuestas(partida, PERMITIDAS)
    expect(propuestas[0].cita).toBe('quedó en ocho semanas, con acompañamiento semanal')
  })

  it('el comentario suelto del final no se confunde con un campo', () => {
    const conAviso = '### oferta\nvalor: ocho semanas\ncita: «ocho semanas»\n\nAviso: el documento habla de otro rubro que el de la ficha.'
    const { propuestas, descartadas } = partirPropuestas(conAviso, PERMITIDAS)
    expect(propuestas).toHaveLength(1)
    expect(descartadas).toEqual([])
  })

  it('si no encontró nada, no inventa propuestas', () => {
    const { propuestas } = partirPropuestas('No hay nada en los documentos que complete estos campos.', PERMITIDAS)
    expect(propuestas).toHaveLength(0)
  })
})

describe('cada documento se lee distinto', () => {
  it('ningún tipo nombra un campo que no exista en la ficha', () => {
    expect(camposInventados()).toEqual([])
  })

  it('a un contrato no se le piden los datos del negocio', () => {
    const faltan = [CAMPOS_POR_CLAVE.get('valor_programa')!, CAMPOS_POR_CLAVE.get('cliente_ideal')!]
    expect(camposQueBuscar('contrato', faltan).map((c) => c.clave)).toEqual(['valor_programa'])
  })

  it('a un onboarding no se le pide el valor del programa', () => {
    const faltan = [CAMPOS_POR_CLAVE.get('valor_programa')!, CAMPOS_POR_CLAVE.get('cliente_ideal_inicial')!]
    expect(camposQueBuscar('onboarding', faltan).map((c) => c.clave)).toEqual(['cliente_ideal_inicial'])
  })

  it('al onboarding se le pide el cliente ideal INICIAL, no el trabajado', () => {
    const faltan = [CAMPOS_POR_CLAVE.get('cliente_ideal')!, CAMPOS_POR_CLAVE.get('cliente_ideal_inicial')!]
    expect(camposQueBuscar('onboarding', faltan).map((c) => c.clave)).toEqual(['cliente_ideal_inicial'])
    // y al match de marca al revés: el trabajado es suyo y el inicial no
    expect(camposQueBuscar('match_de_marca', faltan).map((c) => c.clave)).toEqual(['cliente_ideal'])
  })

  it('los campos trabajados sólo salen del match de marca', () => {
    const faltan = ['problema', 'promesa', 'pilares', 'mecanismo'].map((k) => CAMPOS_POR_CLAVE.get(k)!)
    expect(camposQueBuscar('match_de_marca', faltan)).toHaveLength(4)
    expect(camposQueBuscar('onboarding', faltan)).toHaveLength(0)
    expect(camposQueBuscar('llamada_venta', faltan)).toHaveLength(0)
  })

  it('las horas por semana no salen de una llamada de venta', () => {
    const faltan = [CAMPOS_POR_CLAVE.get('horas_por_semana')!, CAMPOS_POR_CLAVE.get('dolor_textual')!]
    expect(camposQueBuscar('llamada_venta', faltan).map((c) => c.clave)).toEqual(['dolor_textual'])
    // pero del onboarding sí: ahí las declaró él
    expect(camposQueBuscar('onboarding', faltan).map((c) => c.clave)).toContain('horas_por_semana')
  })

  it('lo que se dijo en la venta no se confunde con lo firmado', () => {
    const faltan = ['valor_prometido', 'valor_programa'].map((k) => CAMPOS_POR_CLAVE.get(k)!)
    expect(camposQueBuscar('llamada_venta', faltan).map((c) => c.clave)).toEqual(['valor_prometido'])
    expect(camposQueBuscar('contrato', faltan).map((c) => c.clave)).toEqual(['valor_programa'])
  })

  it('«notas» y «otro» no acotan, y eso no se cuenta como que pueden dar todo', () => {
    expect(acotaCampos('notas')).toBe(false)
    expect(acotaCampos('otro')).toBe(false)
    expect(acotaCampos('contrato')).toBe(true)
    expect(acotaCampos('onboarding')).toBe(true)
  })

  it('un documento sin tipo declarado no acota nada, pero sube la vara en el prompt', () => {
    const faltan = [CAMPOS_POR_CLAVE.get('valor_programa')!, CAMPOS_POR_CLAVE.get('cliente_ideal')!]
    expect(camposQueBuscar('otro', faltan)).toHaveLength(2)
    expect(reglasDeFicha(faltan, LECTURA.otro)).toContain('lo que esté dicho con todas las letras')
  })

  it('el prompt le dice qué está leyendo y con qué se confunde ese tipo', () => {
    const reglas = reglasDeFicha([CAMPOS_POR_CLAVE.get('valor_programa')!], LECTURA.contrato)
    expect(reglas).toContain('QUÉ DOCUMENTO ESTÁS LEYENDO')
    expect(reglas).toContain('lo que FOUNDERS le cobra a él')
  })

  it('sin documento elegido el prompt no inventa un tipo', () => {
    const reglas = reglasDeFicha([CAMPOS_POR_CLAVE.get('oferta')!])
    expect(reglas).not.toContain('QUÉ DOCUMENTO ESTÁS LEYENDO')
  })
})

describe('cruzar varios documentos de una vez', () => {
  const PERMITIDAS = new Set(['cliente_ideal', 'ticket', 'rubro'])

  const RESPUESTA = `### cliente_ideal
valor: estudios contables de 3 a 10 personas
documento: match de marca
cita: «Le hablamos a estudios contables de 3 a 10 personas.»

### ticket
valor: 1800000
documento: onboarding
cita: «El proyecto completo lo cobro 1.800.000 pesos.»

### contradicciones
cliente_ideal — el onboarding dice «dueños de pymes» y el match de marca dice
«estudios contables de 3 a 10 personas». Vale el match de marca: es posterior.

### sin proponer
rubro — no aparece en ninguno de los tres documentos.`

  it('cada propuesta dice de qué documento salió', () => {
    const { propuestas } = partirPropuestas(RESPUESTA, PERMITIDAS)
    expect(propuestas).toHaveLength(2)
    expect(propuestas[0]!.documento).toBe('match de marca')
    expect(propuestas[1]!.documento).toBe('onboarding')
    expect(propuestas[1]!.valor).toBe('1800000')
  })

  it('las secciones no se leen como si fueran campos', () => {
    const { propuestas, descartadas } = partirPropuestas(RESPUESTA, PERMITIDAS)
    expect(propuestas.map((p) => p.campo)).toEqual(['cliente_ideal', 'ticket'])
    expect(descartadas).toEqual([])
  })

  it('la contradicción se puede sacar entera, sin que se le pegue lo de abajo', () => {
    const c = sacarSeccion(RESPUESTA, 'contradicciones')
    expect(c).toContain('el onboarding dice')
    expect(c).toContain('Vale el match de marca')
    expect(c).not.toContain('sin proponer')
    expect(c).not.toContain('no aparece en ninguno')
  })

  it('«no hay» es vacío, no es contenido', () => {
    expect(sacarSeccion('### contradicciones\nno hay', 'contradicciones')).toBeNull()
    expect(sacarSeccion('### contradicciones\n\n### sin proponer\nrubro', 'contradicciones')).toBeNull()
  })

  it('lo que quedó sin proponer se lee aunque el título tenga espacio', () => {
    expect(sacarSeccion(RESPUESTA, 'sin proponer')).toContain('rubro — no aparece')
  })

  it('una sección que no vino no rompe nada', () => {
    expect(sacarSeccion(RESPUESTA, 'resumen')).toBeNull()
  })

  it('el prompt del cruce nombra los documentos que hay y sólo los campos que faltan', () => {
    const reglas = reglasDelCruce(
      CAMPOS.filter((c) => c.clave === 'cliente_ideal'),
      ['Formulario de onboarding', 'Match de marca'],
    )
    expect(reglas).toContain('Match de marca')
    expect(reglas).toContain('cliente_ideal')
    expect(reglas).not.toContain('- ticket —')
    expect(reglas).toContain('ÚNICA fuente de los campos trabajados')
    expect(reglas).toContain('_inicial')
  })
})

describe('el cruce mira la ficha que ya está cargada', () => {
  const reglas = reglasDelCruce(CAMPOS.filter((c) => c.clave === 'cliente_ideal'), ['Match de marca', 'Llamada de venta'])

  it('le dice dónde está la ficha actual y qué significa NO CARGADO', () => {
    expect(reglas).toContain('## La ficha')
    expect(reglas).toContain('NO CARGADO')
    expect(reglas).toContain('Vacío no es cero')
  })

  it('le prohíbe proponer sobre un campo cargado, pero le pide que avise si está mal', () => {
    expect(reglas).toContain('No los propongas')
    expect(reglas).toContain('lo que escribió una persona no se pisa solo')
    expect(reglas).toContain('lo propongas —está cargado')
  })
})

describe('el cruce distingue el punto de partida del trabajo hecho', () => {
  const reglas = reglasDelCruce(
    CAMPOS.filter((c) => ['cliente_ideal', 'cliente_ideal_inicial'].includes(c.clave)),
    ['Formulario de onboarding', 'Match de marca'],
  )

  it('manda las respuestas del onboarding al campo inicial, no al trabajado', () => {
    expect(reglas).toContain('PUNTO DE PARTIDA')
    expect(reglas).toContain('NUNCA a los campos trabajados')
  })

  it('sin match de marca los campos trabajados quedan sin proponer', () => {
    expect(reglas).toContain('no los completes con el onboarding')
    expect(reglas).toContain('el campo es trabajado y todavía no hay match de marca')
  })

  it('separa lo hablado en la venta de lo firmado en el contrato', () => {
    expect(reglas).toContain('lo que se HABLÓ, no lo firmado')
  })

  it('distingue lo que escribió el cliente de lo que le devolvió una IA', () => {
    expect(reglas).toContain('Chequeo final con tu IA')
    expect(reglas).toContain('confianza media')
  })

  it('no deja que un dato íntimo entre como valor de un campo', () => {
    expect(reglas).toContain('No cargues religión, salud, orientación')
    expect(reglas).toContain('recortando la cita a la parte que habla del trabajo')
  })

  it('avisa que el formulario viejo no tenía algunas preguntas', () => {
    expect(reglas).toContain('los formularios viejos no')
  })
})
