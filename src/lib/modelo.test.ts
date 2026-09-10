import { describe, expect, it } from 'vitest'
import { explicarError, partirAnalisis, partirDiagnostico } from './modelo'

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
