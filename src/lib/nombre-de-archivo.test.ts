import { describe, expect, it } from 'vitest'
import { adivinarFecha, adivinarTipo, adivinarTitulo } from './nombre-de-archivo'

describe('qué tipo de documento parece', () => {
  it('reconoce los nombres que usa Founders', () => {
    expect(adivinarTipo('Formulario de onboarding - Juan Pérez.docx')).toBe('onboarding')
    expect(adivinarTipo('Onboarding.pdf')).toBe('onboarding')
    expect(adivinarTipo('Contrato firmado Juan Perez.pdf')).toBe('contrato')
    expect(adivinarTipo('Notas de la semana 3.md')).toBe('sesion')
    expect(adivinarTipo('Apuntes sueltos.txt')).toBe('notas')
    expect(adivinarTipo('Sesion 04.txt')).toBe('sesion')
    expect(adivinarTipo('Sesión 4 — transcripción.vtt')).toBe('sesion')
  })

  it('la llamada de venta le gana a la sesión, que es la palabra más general', () => {
    expect(adivinarTipo('Llamada de venta 12-03.txt')).toBe('llamada_venta')
    expect(adivinarTipo('Llamada semana 2.txt')).toBe('sesion')
  })

  it('un .vtt sin ninguna otra señal es una grabación, o sea una sesión', () => {
    expect(adivinarTipo('20260314.vtt')).toBe('sesion')
    expect(adivinarTipo('20260314.txt')).toBe('otro')
  })

  it('cuando no hay ninguna señal devuelve «otro» en vez de inventar', () => {
    expect(adivinarTipo('documento final v2.pdf')).toBe('otro')
    expect(adivinarTipo('IMG_4432.pdf')).toBe('otro')
  })

  it('no se pierde con acentos, mayúsculas ni guiones', () => {
    expect(adivinarTipo('SESIÓN_07_JUAN.TXT')).toBe('sesion')
    expect(adivinarTipo('onboarding-maria.docx')).toBe('onboarding')
  })
})

describe('la fecha que trae el nombre', () => {
  it('lee el orden ISO que ponen las herramientas', () => {
    expect(adivinarFecha('2026-03-14 sesion.txt')).toBe('2026-03-14')
    expect(adivinarFecha('Sesion 2026_03_14.txt')).toBe('2026-03-14')
    expect(adivinarFecha('reunion 20260314.vtt')).toBe('2026-03-14')
  })

  it('lee el orden argentino: el día primero', () => {
    expect(adivinarFecha('Llamada 14-03-2026.txt')).toBe('2026-03-14')
    expect(adivinarFecha('Notas 14.03.26.md')).toBe('2026-03-14')
  })

  it('devuelve null antes que inventar', () => {
    expect(adivinarFecha('Contrato firmado.pdf')).toBeNull()
    expect(adivinarFecha('Sesion 04.txt')).toBeNull()
    expect(adivinarFecha('llamar al 11-5555-4433.txt')).toBeNull()
  })

  it('rechaza un día que no existe en vez de correrlo al mes siguiente', () => {
    expect(adivinarFecha('2026-02-31 sesion.txt')).toBeNull()
    expect(adivinarFecha('sesion 2026-13-01.txt')).toBeNull()
  })

  it('no toma por fecha un año que no es de este mundo', () => {
    expect(adivinarFecha('1998-03-14 sesion.txt')).toBeNull()
  })
})

describe('el título propuesto', () => {
  it('es el nombre del archivo sin la extensión, legible', () => {
    expect(adivinarTitulo('Sesion_04_Juan-Perez.txt')).toBe('Sesion 04 Juan-Perez')
    expect(adivinarTitulo('Contrato firmado.pdf')).toBe('Contrato firmado')
  })

  it('aguanta un archivo sin extensión', () => {
    expect(adivinarTitulo('Contrato')).toBe('Contrato')
    expect(adivinarTitulo('.env')).toBe('.env')
  })
})
