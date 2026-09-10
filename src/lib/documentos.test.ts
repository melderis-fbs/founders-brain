import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fila, pool } from './db'
import { guardarDocumento, textoDe } from './documentos'
import { importarCsv } from './importar/importar'

const prueba = process.env.DATABASE_URL ? describe : describe.skip

prueba('cargar un documento en la ficha', () => {
  let clienteId = 0

  beforeEach(async () => {
    await pool().query('truncate clientes, consultoras, documentos, importaciones, importacion_filas restart identity cascade')
    await importarCsv({ contenido: 'nombre\nNorma Márquez', archivo: 'p.csv', usuarioId: null })
    clienteId = (await fila<{ id: number }>('select id from clientes limit 1'))!.id
  })
  afterAll(async () => { await pool().end() })

  const largo = 'Formulario de onboarding: vende consultoría a estudios contables.'

  it('guarda el texto pegado y cuenta sus caracteres', async () => {
    const r = await guardarDocumento({ clienteId, tipo: 'onboarding', texto: largo, origen: 'pegado' })
    expect(r.ok).toBe(true)

    const d = await fila<{ titulo: string; caracteres: number; origen: string }>(
      'select titulo, caracteres, origen from documentos where cliente_id = $1', [clienteId],
    )
    expect(d?.caracteres).toBe(largo.length)
    expect(d?.origen).toBe('pegado')
    expect(d?.titulo).toBe('Formulario de onboarding')   // se pone solo si no se escribe
  })

  it('un texto de dos palabras no se guarda: se dice por qué', async () => {
    const r = await guardarDocumento({ clienteId, tipo: 'notas', texto: 'nada', origen: 'pegado' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('4 caracteres')
  })

  it('una fecha que no se entiende no se guarda a medias', async () => {
    const r = await guardarDocumento({ clienteId, tipo: 'notas', texto: largo, fechaBruta: 'el martes', origen: 'pegado' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('no es una fecha')
    const cuantos = await fila<{ n: number }>('select count(*)::int as n from documentos')
    expect(cuantos?.n).toBe(0)
  })

  it('a mano se pueden cargar dos del mismo tipo; la planilla no duplica', async () => {
    await guardarDocumento({ clienteId, tipo: 'sesion', texto: `${largo} Una.`, origen: 'pegado' })
    await guardarDocumento({ clienteId, tipo: 'sesion', texto: `${largo} Dos.`, origen: 'pegado' })
    const cuantos = await fila<{ n: number }>('select count(*)::int as n from documentos')
    expect(cuantos?.n).toBe(2)   // dos sesiones distintas no son un duplicado
  })

  it('el texto de un documento no se puede leer desde otro cliente', async () => {
    const g = await guardarDocumento({ clienteId, tipo: 'contrato', texto: largo, origen: 'pegado' })
    if (!g.ok) throw new Error(g.error)
    expect(await textoDe(g.id, clienteId)).toBe(largo)
    expect(await textoDe(g.id, clienteId + 999)).toBeNull()
  })
})
