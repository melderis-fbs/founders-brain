import { describe, expect, it } from 'vitest'
import { evaluarHitos, fuentesConDatos } from './hitos'
import { semaforoDe } from './semaforo'

const CARTERA = fuentesConDatos({ algunClienteConDatosDeFicha: true, algunOnboardingCargado: true })
const SIN_DOCS = new Set<string>()

const evaluar = (semana: number | null, valores: Record<string, unknown> = {}, docs = SIN_DOCS) =>
  evaluarHitos({ semana, valores, tiposDeDocumento: docs, conDatos: CARTERA })

const AL_DIA = {
  meta_mensual: 1, ticket: 1,
  cliente_ideal: 'x', problema: 'y', oferta: 'z', promesa: 'w', mensaje: 'm', canal: 'c',
}

describe('el semáforo', () => {
  it('gris no es verde: sin datos no se pinta de en tiempo', () => {
    const s = semaforoDe(evaluar(null, {}))
    expect(s.color).toBe('gris')
    expect(s.palabra).toBe('sin datos')
    expect(s.porque).toContain('fecha de inicio')
  })

  it('verde cuando no hay nada vencido de lo que se puede medir', () => {
    const s = semaforoDe(evaluar(6, AL_DIA, new Set(['onboarding'])))
    expect(s.color).toBe('verde')
    expect(s.palabra).toBe('en tiempo')
    expect(s.fase).toBeNull()
  })

  it('un atraso chico es «para mirar», no una emergencia', () => {
    const s = semaforoDe(evaluar(6, { ...AL_DIA, mensaje: '', canal: '' }, new Set(['onboarding'])))
    expect(s.color).toBe('amarillo')
    expect(s.palabra).toBe('para mirar')
    expect(s.porque).toContain('1 semana')
    expect(s.porque).toContain('Todavía se recupera')
    expect(s.fase).toBe(2)   // la semana 5 cae en la fase 2
  })

  /**
   * El bug que hacía que media cartera saliera en rojo: un hito bloqueante
   * vencido marcaba GRAVE aunque el atraso fuera de dos semanas. Como casi
   * ninguna ficha tiene la oferta cargada, todos eran graves, y un tablero
   * donde todo es grave no deja decidir a quién llamar primero.
   */
  it('un bloqueante recién vencido sube un escalón, no salta a grave', () => {
    const s = semaforoDe(evaluar(6, { ...AL_DIA, oferta: '', promesa: '' }, new Set(['onboarding'])))
    expect(s.color).toBe('naranja')
    expect(s.palabra).toBe('atrasado')
    expect(s.porque).toContain('bloquea')
    expect(s.fase).toBe(1)   // la semana 4 cae en la fase 1
  })

  it('el mismo bloqueante, meses después, sí es grave', () => {
    const s = semaforoDe(evaluar(14, { ...AL_DIA, oferta: '', promesa: '' }, new Set(['onboarding'])))
    expect(s.color).toBe('rojo')
    expect(s.palabra).toBe('grave')
  })

  it('tres semanas de atraso ya es grave, con bloqueante o sin él', () => {
    // «Mensaje y canal» vencía en la semana 5. En la 7 son 2 semanas: atrasado.
    const dos = semaforoDe(evaluar(7, { ...AL_DIA, mensaje: '', canal: '' }, new Set(['onboarding'])))
    expect(dos.color).toBe('naranja')
    expect(dos.palabra).toBe('atrasado')

    // En la 8 son 3 semanas: grave, y lo dice con el número.
    const tres = semaforoDe(evaluar(8, { ...AL_DIA, mensaje: '', canal: '' }, new Set(['onboarding'])))
    expect(tres.color).toBe('rojo')
    expect(tres.palabra).toBe('grave')
    expect(tres.porque).toContain('3 semanas atrasado')
  })

  it('grave siempre viene con sus motivos nombrados, no con un color solo', () => {
    const s = semaforoDe(evaluar(12, { ...AL_DIA, mensaje: '', canal: '' }, new Set(['onboarding'])))
    expect(s.senales).toBeDefined()
    expect(s.senales!.length).toBeGreaterThan(0)
    for (const una of s.senales!) expect(una.dice.length).toBeGreaterThan(15)
  })

  it('cada color viene con una frase que lo explica, siempre', () => {
    for (const evaluados of [evaluar(null), evaluar(6, AL_DIA, new Set(['onboarding'])), evaluar(12, {}, new Set(['onboarding']))]) {
      const s = semaforoDe(evaluados)
      expect(s.porque.length).toBeGreaterThan(20)
      expect(s.palabra).not.toBe('')
    }
  })

  it('el semáforo dice en qué fase se corta, o null si no se corta', () => {
    expect(semaforoDe(evaluar(6, AL_DIA, new Set(['onboarding']))).fase).toBeNull()
    // Con algo de la ficha cargado sí se puede decir dónde se corta.
    expect(semaforoDe(evaluar(12, { cliente_ideal: 'x', problema: 'y' }, new Set(['onboarding']))).fase).toBe(1)
  })
})

describe('rojo no es cualquier cosa', () => {
  /**
   * Con la ficha vacía, TODO da «falta» y el cliente salía grave. Pero ni un
   * hito hecho no es un cliente que fracasó: es un cliente que no cargamos.
   * Decir grave ahí afirma algo de él que no sabemos.
   */
  it('tener el onboarding subido no cuenta: eso lo hicimos nosotros, no el cliente', () => {
    const s = semaforoDe(evaluar(12, {}, new Set(['onboarding'])))
    expect(s.color).toBe('gris')
    expect(s.palabra).toBe('ficha vacía')
    expect(s.porque).toContain('no sabemos')
  })

  it('con algo hecho y el resto faltando sí se puede comparar', () => {
    const s = semaforoDe(evaluar(12, { cliente_ideal: 'x', problema: 'y' }, new Set(['onboarding'])))
    expect(s.color).not.toBe('gris')
  })

  it('el que terminó el programa sale de la urgencia, no del tablero', () => {
    const s = semaforoDe(evaluar(30, { cliente_ideal: 'x', problema: 'y' }, new Set(['onboarding'])), true)
    expect(s.palabra).toBe('terminó sin cerrar')
    expect(s.color).toBe('azul')   // no compite por la atención de esta semana
    expect(s.porque).toContain('renovación')
  })
})

/**
 * Lo que dijo el cliente de NOSOTROS, que no sale de ninguna fecha.
 *
 * El equipo lo dejó dicho así: «un tibio no cuenta como grave, es un yellow
 * flag». Estas cuatro pruebas son esa frase, escrita para que no se pueda
 * desarmar sin querer.
 */
describe('la temperatura en el semáforo', () => {
  const alDia = () => evaluar(6, AL_DIA, new Set(['onboarding']))

  it('un tibio no pinta rojo: sube el verde a «para mirar» y nada más', () => {
    const s = semaforoDe(alDia(), {
      semana: 6,
      loQueDijo: [{ de: 'sesion', temperatura: 'tibio', cita: 'me cuesta seguir el ritmo' }],
    })
    expect(s.color).toBe('amarillo')
    expect(s.palabra).toBe('para mirar')
    expect(s.porque).toContain('me cuesta seguir el ritmo')
    expect(s.senales ?? []).toHaveLength(0)
  })

  it('un caliente sí es grave, aunque esté al día con todo', () => {
    const s = semaforoDe(alDia(), {
      semana: 6,
      loQueDijo: [{ de: 'sesion', temperatura: 'caliente', cita: 'esto no me está sirviendo' }],
    })
    expect(s.color).toBe('rojo')
    expect(s.palabra).toBe('grave')
    expect(s.porque).toContain('esto no me está sirviendo')
  })

  it('un quemando en la encuesta también, y dice de dónde salió', () => {
    const s = semaforoDe(alDia(), {
      semana: 6,
      loQueDijo: [{ de: 'encuesta', temperatura: 'quemando', cita: 'estoy evaluando si sigo' }],
    })
    expect(s.color).toBe('rojo')
    expect(s.senales![0]!.clave).toBe('encuesta')
    expect(s.porque).toContain('encuesta')
  })

  it('«bien» deja el verde como estaba', () => {
    const s = semaforoDe(alDia(), {
      semana: 6,
      loQueDijo: [{ de: 'sesion', temperatura: 'bien', cita: null }],
    })
    expect(s.color).toBe('verde')
  })

  // Antes, una red flag levantada sobre un cliente al día se perdía: la rama
  // del verde devolvía antes de mirar las señales. Lo humano no depende del
  // calendario y por eso ahora se mira primero.
  it('una red flag sobre un cliente al día ya no sale en verde', () => {
    const s = semaforoDe(alDia(), { semana: 6, bandera: 'roja', banderaDesdeHaceSemanas: 2 })
    expect(s.color).toBe('rojo')
    expect(s.porque).toContain('red flag')
  })

  it('una queja en un cliente sin fecha de inicio tampoco se pierde en el gris', () => {
    const s = semaforoDe(evaluar(null, {}), {
      loQueDijo: [{ de: 'sesion', temperatura: 'quemando', cita: 'quiero que me devuelvan la plata' }],
    })
    expect(s.color).toBe('rojo')
    expect(s.porque).toContain('devuelvan la plata')
  })
})
