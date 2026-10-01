import { describe, expect, it } from 'vitest'
import { evaluarHitos, fuentesConDatos } from './hitos'
import { ETAPAS } from './modulos'
import { semaforoDe } from './semaforo'

/** Las primeras N etapas marcadas por la consultora: es lo que prueba el avance. */
const marcadas = (cuantas: number) => new Set(ETAPAS.slice(0, cuantas).map((e) => e.clave))

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

  /**
   * EL ATRASO LO PRUEBAN LAS ETAPAS QUE MARCÓ UNA PERSONA, NO LOS CASILLEROS
   * VACÍOS DE LA FICHA.
   *
   * Antes estas mismas pruebas borraban dos campos de la ficha y esperaban
   * amarillo o naranja. Eso era el bug: un campo vacío no prueba que el cliente
   * no hizo algo, prueba que no lo escribimos. Ahora el atraso se mide sobre lo
   * que la consultora marcó, que es una afirmación de alguien que estuvo ahí.
   */
  it('un atraso chico es «para mirar», no una emergencia', () => {
    // La etapa 5 vencía en la semana 4; el cliente va por la 5: una semana.
    const s = semaforoDe(evaluar(5, AL_DIA, new Set(['onboarding'])), { semana: 5, marcadas: marcadas(4) })
    expect(s.color).toBe('amarillo')
    expect(s.palabra).toBe('para mirar')
    expect(s.porque).toContain('1 semana')
    expect(s.porque).toContain('Todavía se recupera')
  })

  it('dos semanas ya es «atrasado»', () => {
    const s = semaforoDe(evaluar(6, AL_DIA, new Set(['onboarding'])), { semana: 6, marcadas: marcadas(4) })
    expect(s.color).toBe('naranja')
    expect(s.palabra).toBe('atrasado')
    expect(s.porque).toContain('2 semanas')
  })

  it('tres semanas de atraso ya es grave, y lo dice con el número', () => {
    const s = semaforoDe(evaluar(7, AL_DIA, new Set(['onboarding'])), { semana: 7, marcadas: marcadas(4) })
    expect(s.color).toBe('rojo')
    expect(s.palabra).toBe('grave')
    expect(s.porque).toContain('3 semanas atrasado')
  })

  it('grave siempre viene con sus motivos nombrados, no con un color solo', () => {
    const s = semaforoDe(evaluar(12, AL_DIA, new Set(['onboarding'])), { semana: 12, marcadas: marcadas(4) })
    expect(s.senales).toBeDefined()
    expect(s.senales!.length).toBeGreaterThan(0)
    for (const una of s.senales!) expect(una.dice.length).toBeGreaterThan(15)
  })

  /**
   * Lo que arreglamos, dicho al derecho: con la ficha a medias el cliente NO
   * sale atrasado. Sale gris, y el gris dice qué cargar.
   */
  it('con la ficha a medias no sale atrasado: sale «falta cargarlo»', () => {
    const s = semaforoDe(evaluar(12, { ...AL_DIA, oferta: '', promesa: '' }, new Set(['onboarding'])))
    expect(s.color).toBe('gris')
    expect(s.palabra).toBe('falta cargarlo')
    expect(s.porque).toContain('no sabemos')
    expect(s.sinCargar!.some((e) => e.hito.clave === 'oferta')).toBe(true)
  })

  it('sin el onboarding cargado tampoco sale atrasado', () => {
    const s = semaforoDe(evaluar(12, AL_DIA, new Set()))
    expect(s.color).toBe('gris')
    expect(s.palabra).toBe('falta cargarlo')
  })

  it('cada color viene con una frase que lo explica, siempre', () => {
    for (const evaluados of [evaluar(null), evaluar(6, AL_DIA, new Set(['onboarding'])), evaluar(12, {}, new Set(['onboarding']))]) {
      const s = semaforoDe(evaluados)
      expect(s.porque.length).toBeGreaterThan(20)
      expect(s.palabra).not.toBe('')
    }
  })

  it('sin nada vencido, no hay fase donde se corte', () => {
    expect(semaforoDe(evaluar(6, AL_DIA, new Set(['onboarding']))).fase).toBeNull()
  })
})

describe('rojo no es cualquier cosa', () => {
  /**
   * Con la ficha vacía, TODO da «falta» y el cliente salía grave. Pero ni un
   * hito hecho no es un cliente que fracasó: es un cliente que no cargamos.
   * Decir grave ahí afirma algo de él que no sabemos.
   */
  it('tener el onboarding subido no cuenta: eso lo hicimos nosotros, no el cliente', () => {
    const s = semaforoDe(evaluar(12, {}, new Set(['onboarding'])), { semana: 12, algoEnLaFicha: false })
    expect(s.color).toBe('gris')
    expect(s.palabra).toBe('ficha vacía')
    expect(s.porque).toContain('no sabemos')
  })

  /**
   * Lo que reportó el equipo: «aparece ficha vacía con clientes que ya había
   * cargado». Y tenían razón. «Ficha vacía» preguntaba si algún HITO de ficha
   * estaba hecho, y un hito necesita sus DOS campos: un cliente con la oferta
   * cargada sin la promesa, y el cliente ideal sin el problema, salía «no hay
   * ni un dato cargado de este cliente». Era falso.
   */
  it('con media ficha cargada NO dice «ficha vacía»: dice qué falta', () => {
    const aMedias = { cliente_ideal: 'dueños de pymes', oferta: 'programa de 12 semanas', canal: 'Instagram' }
    const s = semaforoDe(evaluar(12, aMedias, new Set(['onboarding'])), { semana: 12, algoEnLaFicha: true })
    expect(s.palabra).not.toBe('ficha vacía')
    expect(s.palabra).toBe('falta cargarlo')
    expect(s.sinCargar!.length).toBeGreaterThan(0)
  })

  // Antes esto decía que con algo hecho y el resto faltando «sí se puede
  // comparar», y lo pintaba de rojo. No se puede: lo que falta no está hecho ni
  // sin hacer, está sin cargar, y eso se dice.
  it('con algo hecho y el resto sin cargar, no se compara: se dice qué cargar', () => {
    const s = semaforoDe(evaluar(12, { cliente_ideal: 'x', problema: 'y' }, new Set(['onboarding'])))
    expect(s.color).toBe('gris')
    expect(s.palabra).toBe('falta cargarlo')
    expect(s.sinCargar!.length).toBeGreaterThan(0)
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
