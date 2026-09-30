import { beforeEach, describe, expect, it } from 'vitest'
import { fila, filas, pool } from './db'
import { borrarAnalisis, borrarBandera, borrarCliente, queSeVaConElCliente } from './borrar'
import { guardarDocumento } from './documentos'
import { crearSesion } from './sesiones'
import { guardarMes } from './meses'
import { ponerBandera } from './banderas'
import { importarCsv } from './importar/importar'

const prueba = process.env.DATABASE_URL ? describe : describe.skip

prueba('borrar lo que se cargó mal', () => {
  let clienteId = 0
  let usuarioId = 0

  beforeEach(async () => {
    await pool().query('truncate clientes, consultoras, usuarios, documentos, importaciones, importacion_filas restart identity cascade')
    await importarCsv({ contenido: 'nombre\nNorma Márquez', archivo: 'p.csv', usuarioId: null })
    clienteId = (await fila<{ id: number }>('select id from clientes limit 1'))!.id
    usuarioId = (await fila<{ id: number }>(
      `insert into usuarios (email, nombre, rol, clave_hash) values ('c@p.com', 'Camila', 'consultora', 'x')
       returning id`,
    ))!.id
  })

  it('dice qué se lleva puesto ANTES de borrar, con números', async () => {
    await guardarDocumento({ clienteId, tipo: 'contrato', texto: 'Contrato de prestación de servicios.', origen: 'pegado' })
    await crearSesion({ clienteId, fechaBruta: '01/03/2026' })
    await guardarMes({ clienteId, anio: 2026, mes: 3, ventas: '2', usuarioId: null })

    const seVa = (await queSeVaConElCliente(clienteId))!
    expect(seVa.nombre).toBe('Norma Márquez')
    expect(seVa.documentos).toBe(1)
    expect(seVa.sesiones).toBe(1)
    expect(seVa.meses).toBe(1)
  })

  it('no borra si el nombre escrito no es el del cliente', async () => {
    const r = await borrarCliente(clienteId, 'Norma')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Norma Márquez')
    expect(await fila('select id from clientes where id = $1', [clienteId])).not.toBeNull()
  })

  it('el nombre se compara sin importar mayúsculas ni espacios de más', async () => {
    expect((await borrarCliente(clienteId, '  norma   márquez ')).ok).toBe(true)
  })

  it('borrarlo se lleva todo lo suyo', async () => {
    await guardarDocumento({ clienteId, tipo: 'contrato', texto: 'Contrato de prestación de servicios.', origen: 'pegado' })
    await crearSesion({ clienteId, fechaBruta: '01/03/2026' })
    await guardarMes({ clienteId, anio: 2026, mes: 3, ventas: '2', usuarioId: null })

    expect((await borrarCliente(clienteId, 'Norma Márquez')).ok).toBe(true)

    for (const tabla of ['documentos', 'sesiones', 'cliente_mes', 'cliente_negocio']) {
      const quedan = await filas(`select 1 from ${tabla} where cliente_id = $1`, [clienteId])
      expect(quedan, `quedaron filas en ${tabla}`).toHaveLength(0)
    }
    expect(await fila('select id from clientes where id = $1', [clienteId])).toBeNull()
  })

  it('un cliente que no existe no se borra en silencio', async () => {
    const r = await borrarCliente(clienteId + 9999, 'lo que sea')
    expect(r.ok).toBe(false)
  })

  it('borrar el análisis deja la transcripción', async () => {
    const s = await crearSesion({ clienteId, fechaBruta: '01/03/2026' })
    if (!s.ok) throw new Error(s.error)
    await pool().query(
      `update sesiones set transcripcion = $2, analisis = $3, puntos = $4 where id = $1`,
      [s.id, 'Lo que dijo la gente.', 'Un análisis que salió mal.', ['un punto']],
    )

    expect((await borrarAnalisis(s.id!, clienteId)).ok).toBe(true)

    const q = await fila<{ transcripcion: string | null; analisis: string | null; puntos: string[] | null }>(
      'select transcripcion, analisis, puntos from sesiones where id = $1', [s.id],
    )
    expect(q?.transcripcion).toBe('Lo que dijo la gente.')   // lo que dijo la gente no se toca
    expect(q?.analisis).toBeNull()
    expect(q?.puntos).toBeNull()
  })

  it('no se puede borrar un análisis que no existe', async () => {
    const s = await crearSesion({ clienteId, fechaBruta: '01/03/2026' })
    if (!s.ok) throw new Error(s.error)
    const r = await borrarAnalisis(s.id!, clienteId)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('no tiene análisis')
  })

  /** La bandera no devuelve su id, así que se busca la que quedó levantada. */
  const laBanderaDe = async (id: number) =>
    (await fila<{ id: number }>('select id from banderas where cliente_id = $1', [id]))!.id

  it('una bandera levantada por error se borra: no queda como que pasó', async () => {
    const b = await ponerBandera({ clienteId, color: 'roja', motivo: 'Me equivoqué de ficha.', usuarioId })
    if (!b.ok) throw new Error(b.error)

    expect((await borrarBandera(await laBanderaDe(clienteId), clienteId)).ok).toBe(true)
    expect(await filas('select 1 from banderas where cliente_id = $1', [clienteId])).toHaveLength(0)
  })

  it('no se puede borrar algo de otro cliente', async () => {
    await importarCsv({ contenido: 'nombre\nJulián Sosa', archivo: 'p2.csv', usuarioId: null })
    const otro = (await fila<{ id: number }>("select id from clientes where nombre = 'Julián Sosa'"))!.id
    const b = await ponerBandera({ clienteId, color: 'roja', motivo: 'Algo pasó.', usuarioId })
    if (!b.ok) throw new Error(b.error)

    const r = await borrarBandera(await laBanderaDe(clienteId), otro)
    expect(r.ok).toBe(false)
    expect(await filas('select 1 from banderas where cliente_id = $1', [clienteId])).toHaveLength(1)
  })
})
