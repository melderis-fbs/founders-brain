import { describe, expect, it } from 'vitest'
import { explicarError, partirAnalisis, partirDiagnostico, partirPropuestas } from './modelo'

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
