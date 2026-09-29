import { beforeEach, describe, expect, it } from 'vitest'
import { fila, pool } from './db'
import { armarExpediente } from './expediente'
import { guardarDocumento } from './documentos'
import { importarCsv } from './importar/importar'

const prueba = process.env.DATABASE_URL ? describe : describe.skip

prueba('un documento largo entra igual cuando se lo pide', () => {
  let clienteId = 0

  beforeEach(async () => {
    await pool().query('truncate clientes, consultoras, documentos, importaciones, importacion_filas restart identity cascade')
    await importarCsv({ contenido: 'nombre\nNorma Márquez', archivo: 'p.csv', usuarioId: null })
    clienteId = (await fila<{ id: number }>('select id from clientes limit 1'))!.id
  })

  /** Una transcripción de llamada de venta de verdad pesa esto. */
  const LARGO = 'La clienta cuenta que factura poco y trabaja mucho. '.repeat(1400)

  it('una transcripción de 70.000 caracteres entra cuando es la elegida', async () => {
    const g = await guardarDocumento({
      clienteId, tipo: 'llamada_venta', texto: LARGO, archivoNombre: 'llamada.pdf', origen: 'archivo',
    })
    if (!g.ok) throw new Error(g.error)

    const e = await armarExpediente(clienteId, { todo: true }, g.id)
    expect(e!.incluidos).toHaveLength(1)
    expect(e!.omitidos).toHaveLength(0)
    expect(e!.texto).toContain('factura poco y trabaja mucho')
  })

  it('un documento sin texto no se informa como «no entró por tamaño»', async () => {
    const g = await guardarDocumento({
      clienteId, tipo: 'contrato', texto: 'Contrato de prestación de servicios firmado.', origen: 'pegado',
    })
    if (!g.ok) throw new Error(g.error)
    await pool().query('update documentos set texto = null where id = $1', [g.id])

    const e = await armarExpediente(clienteId, { todo: true }, g.id)
    expect(e!.incluidos).toHaveLength(0)
    expect(e!.omitidos[0]).toContain('no tiene texto adentro')
  })
})
