import { describe, expect, it } from 'vitest'
import { partirTemperatura } from './modelo'
import { laMasAlta, leerDeQue, leerTemperatura, esQueja, esTibia } from './temperatura-tipos'

const conCitas = `## Temperatura
caliente

## Por qué
Puso en duda el método: dice que hace lo que se le indica y no pasa nada.

## Lo que dijo
- «hace tres meses que hago lo que me dicen y no pasa nada»
- «la verdad que el material no me sirvió para nada»

## De qué se queja
material

## Lo que no es queja pero conviene saber
Está con miedo de no llegar a pagar el alquiler del local: «si esto no levanta en dos meses cierro».

## Qué preguntarle
¿Qué parte del material intentó aplicar y dónde se trabó?`

describe('partir la temperatura', () => {
  it('lee las cuatro secciones y deja las citas sin las comillas', () => {
    const t = partirTemperatura(conCitas)
    expect(t.temperatura).toBe('caliente')
    expect(t.citas).toHaveLength(2)
    expect(t.citas[0]).toBe('hace tres meses que hago lo que me dicen y no pasa nada')
    expect(t.deQue).toBe('material')
    expect(t.loOtro).toContain('alquiler')
    expect(t.quePreguntar).toContain('material')
  })

  // La regla que sostiene todo: sin la frase, no hay alarma. Acá se revisa, no
  // se le pide por favor al modelo.
  it('sin cita textual no hay temperatura arriba de bien, aunque el modelo diga que sí', () => {
    const t = partirTemperatura(`## Temperatura
quemando

## Por qué
Me parece que está por irse.

## Lo que dijo
No dijo nada en contra nuestro.

## De qué se queja
ninguna`)
    expect(t.temperatura).toBe('bien')
    expect(t.citas).toHaveLength(0)
  })

  it('si falta la sección entera, queda en bien', () => {
    expect(partirTemperatura('## Qué pasó\nHablaron de la oferta.').temperatura).toBe('bien')
  })

  it('«nada» en qué preguntarle no se guarda como si fuera una pregunta', () => {
    const t = partirTemperatura('## Temperatura\nbien\n\n## Qué preguntarle\nnada')
    expect(t.quePreguntar).toBeNull()
  })
})

describe('leer lo que escribió el modelo', () => {
  it('la categoría tolera tildes, artículos y mayúsculas', () => {
    expect(leerDeQue('Acompañamiento')).toBe('acompanamiento')
    expect(leerDeQue('el acompañamiento')).toBe('acompanamiento')
    expect(leerDeQue('lo que le vendieron')).toBe('lo_que_le_vendieron')
    expect(leerDeQue('ninguna')).toBeNull()
    expect(leerDeQue('la comida del hotel')).toBe('otra')
  })

  it('una temperatura inventada no se guarda', () => {
    expect(leerTemperatura('hirviendo')).toBeNull()
    expect(leerTemperatura('Quemando.')).toBe('quemando')
  })
})

describe('qué cuenta como grave', () => {
  // Lo dijo el equipo con estas palabras: «un tibio no cuenta como grave, es un
  // yellow flag».
  it('tibio NO es queja; caliente y quemando sí', () => {
    expect(esQueja('tibio')).toBe(false)
    expect(esTibia('tibio')).toBe(true)
    expect(esQueja('caliente')).toBe(true)
    expect(esQueja('quemando')).toBe(true)
    expect(esQueja('bien')).toBe(false)
  })

  it('cuando hay varias, manda la más alta', () => {
    expect(laMasAlta([
      { de: 'sesion', temperatura: 'tibio', cita: null },
      { de: 'encuesta', temperatura: 'quemando', cita: null },
      { de: 'sesion', temperatura: 'bien', cita: null },
    ])).toBe('quemando')
    expect(laMasAlta([])).toBeNull()
  })
})

describe('de dónde sale una cita', () => {
  // El modelo, leyendo una encuesta, citó una frase que estaba en el expediente
  // —una bandera que había escrito una consultora— y la puso como si la hubiera
  // dicho el cliente ahí. Lo aclaró al lado, y esa aclaración terminaba
  // guardada adentro de la cita.
  it('la aclaración pegada atrás no entra en la cita', () => {
    const t = partirTemperatura(`## Temperatura
caliente

## Lo que dijo
- «esperaba más seguimiento» (esto está en la bandera del 14/9, no en la encuesta)
- «el material es mucho y no llego»`)
    expect(t.citas).toEqual(['esperaba más seguimiento', 'el material es mucho y no llego'])
  })

  it('una línea sin comillas no es una cita', () => {
    const t = partirTemperatura('## Temperatura\ncaliente\n\n## Lo que dijo\nEl cliente estaba molesto.')
    expect(t.citas).toHaveLength(0)
    expect(t.temperatura).toBe('bien')
  })
})
