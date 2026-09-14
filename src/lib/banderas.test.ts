import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { bajarBandera, banderaDe, banderasLevantadas, contarBanderas, historialDeBanderas, ponerBandera } from './banderas'
import { escribirDevolviendo, pool } from './db'
import { cambiarDeCoach, cambiosDeCoach } from './usuarios'

const hayBase = Boolean(process.env.DATABASE_URL)
const prueba = hayBase ? describe : describe.skip

afterAll(async () => { if (hayBase) await pool().end() })

prueba('las banderas', () => {
  let cliente = 0
  let lucia = 0
  let julieta = 0

  beforeEach(async () => {
    await pool().query('truncate clientes, consultoras, usuarios restart identity cascade')
    // La bandera apunta a quién la levantó: sin usuario, la clave foránea salta.
    await escribirDevolviendo<{ id: number }>(
      `insert into usuarios (email, nombre, rol, clave_hash) values ('x@x.com', 'Quien Sea', 'admin', 'x') returning id`, [])
    lucia = (await escribirDevolviendo<{ id: number }>(
      `insert into consultoras (nombre, nombre_pleg) values ('Lucía', 'lucia') returning id`, [])).id
    julieta = (await escribirDevolviendo<{ id: number }>(
      `insert into consultoras (nombre, nombre_pleg) values ('Julieta', 'julieta') returning id`, [])).id
    cliente = (await escribirDevolviendo<{ id: number }>(
      `insert into clientes (nombre, nombre_clave, nombre_pleg, consultora_id) values ('Ana', 'ana', 'ana', $1) returning id`, [lucia])).id
  })

  it('sin motivo no se levanta: un color solo no le dice nada a nadie', async () => {
    expect(await ponerBandera({ clienteId: cliente, color: 'roja', motivo: '   ', usuarioId: 1 })).toMatchObject({ ok: false })
    expect(await banderaDe(cliente)).toBeNull()
  })

  it('se levanta con su motivo y queda una sola', async () => {
    await ponerBandera({ clienteId: cliente, color: 'roja', motivo: 'Dijo que se quiere ir.', usuarioId: 1 })
    await ponerBandera({ clienteId: cliente, color: 'naranja', motivo: 'Aflojó pero sigue trabado.', usuarioId: 1 })

    const puesta = await banderaDe(cliente)
    expect(puesta).toMatchObject({ color: 'naranja', motivo: 'Aflojó pero sigue trabado.' })
    expect((await historialDeBanderas(cliente)).length).toBe(1)
  })

  it('bajarla pide decir cómo se resolvió', async () => {
    await ponerBandera({ clienteId: cliente, color: 'roja', motivo: 'x', usuarioId: 1 })
    expect(await bajarBandera({ clienteId: cliente, comoSeResolvio: ' ', usuarioId: 1 })).toMatchObject({ ok: false })
    expect(await banderaDe(cliente)).not.toBeNull()
  })

  it('bajada no se borra: queda con cómo se resolvió', async () => {
    await ponerBandera({ clienteId: cliente, color: 'roja', motivo: 'Se quiere ir.', usuarioId: 1 })
    expect(await bajarBandera({ clienteId: cliente, comoSeResolvio: 'Renovó el martes.', usuarioId: 1 })).toEqual({ ok: true })

    expect(await banderaDe(cliente)).toBeNull()
    const antes = await historialDeBanderas(cliente)
    expect(antes[0]).toMatchObject({ como_se_resolvio: 'Renovó el martes.' })
    expect(antes[0]!.resuelta_en).not.toBeNull()
  })

  it('bajar una que no está levantada lo dice', async () => {
    expect(await bajarBandera({ clienteId: cliente, comoSeResolvio: 'x', usuarioId: 1 })).toMatchObject({ ok: false })
  })

  it('después de bajarla se puede levantar otra, y quedan las dos en el historial', async () => {
    await ponerBandera({ clienteId: cliente, color: 'roja', motivo: 'primera', usuarioId: 1 })
    await bajarBandera({ clienteId: cliente, comoSeResolvio: 'se arregló', usuarioId: 1 })
    await ponerBandera({ clienteId: cliente, color: 'amarilla', motivo: 'segunda', usuarioId: 1 })

    expect((await banderaDe(cliente))?.motivo).toBe('segunda')
    expect((await historialDeBanderas(cliente)).length).toBe(2)
  })

  it('el contador cuenta sólo las levantadas, y por consultora', async () => {
    await ponerBandera({ clienteId: cliente, color: 'roja', motivo: 'x', usuarioId: 1 })
    expect(await contarBanderas(null)).toEqual({ roja: 1, naranja: 0, amarilla: 0 })
    expect(await contarBanderas(lucia)).toEqual({ roja: 1, naranja: 0, amarilla: 0 })
    expect(await contarBanderas(julieta)).toEqual({ roja: 0, naranja: 0, amarilla: 0 })

    await bajarBandera({ clienteId: cliente, comoSeResolvio: 'listo', usuarioId: 1 })
    expect(await contarBanderas(null)).toEqual({ roja: 0, naranja: 0, amarilla: 0 })
  })

  it('la lista trae el cliente y su consultora, con las rojas primero', async () => {
    const otro = (await escribirDevolviendo<{ id: number }>(
      `insert into clientes (nombre, nombre_clave, nombre_pleg, consultora_id) values ('Beto', 'beto', 'beto', $1) returning id`, [lucia])).id
    await ponerBandera({ clienteId: cliente, color: 'amarilla', motivo: 'para mirar', usuarioId: 1 })
    await ponerBandera({ clienteId: otro, color: 'roja', motivo: 'se cae', usuarioId: 1 })

    const lista = await banderasLevantadas(null)
    expect(lista.map((b) => b.cliente)).toEqual(['Beto', 'Ana'])
    expect(lista[0]).toMatchObject({ cliente: 'Beto', consultora: 'Lucía' })
  })
})

prueba('cambiar de coach', () => {
  let cliente = 0
  let lucia = 0
  let julieta = 0

  beforeEach(async () => {
    await pool().query('truncate clientes, consultoras, usuarios restart identity cascade')
    // La bandera apunta a quién la levantó: sin usuario, la clave foránea salta.
    await escribirDevolviendo<{ id: number }>(
      `insert into usuarios (email, nombre, rol, clave_hash) values ('x@x.com', 'Quien Sea', 'admin', 'x') returning id`, [])
    lucia = (await escribirDevolviendo<{ id: number }>(
      `insert into consultoras (nombre, nombre_pleg) values ('Lucía', 'lucia') returning id`, [])).id
    julieta = (await escribirDevolviendo<{ id: number }>(
      `insert into consultoras (nombre, nombre_pleg) values ('Julieta', 'julieta') returning id`, [])).id
    cliente = (await escribirDevolviendo<{ id: number }>(
      `insert into clientes (nombre, nombre_clave, nombre_pleg, consultora_id) values ('Ana', 'ana', 'ana', $1) returning id`, [lucia])).id
  })

  it('sin motivo no se cambia', async () => {
    expect(await cambiarDeCoach({ clienteId: cliente, aConsultoraId: julieta, motivo: '  ', usuarioId: 1 }))
      .toMatchObject({ ok: false })
    expect(await cambiosDeCoach(cliente)).toEqual([])
  })

  it('queda el registro con de quién a quién y por qué', async () => {
    expect(await cambiarDeCoach({
      clienteId: cliente, aConsultoraId: julieta, usuarioId: 1,
      motivo: 'Lucía se va de licencia tres meses.',
    })).toEqual({ ok: true })

    const [cambio] = await cambiosDeCoach(cliente)
    expect(cambio).toMatchObject({ de: 'Lucía', a: 'Julieta', motivo: 'Lucía se va de licencia tres meses.' })
    expect(cambio!.creado_en).toBeTruthy()
  })

  it('pasarlo a la que ya lo tiene no cuenta como cambio', async () => {
    expect(await cambiarDeCoach({ clienteId: cliente, aConsultoraId: lucia, motivo: 'x', usuarioId: 1 }))
      .toMatchObject({ ok: false })
    expect(await cambiosDeCoach(cliente)).toEqual([])
  })

  it('se lo puede dejar sin consultora, y también queda registrado', async () => {
    await cambiarDeCoach({ clienteId: cliente, aConsultoraId: null, motivo: 'Se va del programa.', usuarioId: 1 })
    expect((await cambiosDeCoach(cliente))[0]).toMatchObject({ de: 'Lucía', a: null })
  })

  it('a una consultora que no existe no se lo pasa', async () => {
    expect(await cambiarDeCoach({ clienteId: cliente, aConsultoraId: 99_999, motivo: 'x', usuarioId: 1 }))
      .toMatchObject({ ok: false })
  })
})
