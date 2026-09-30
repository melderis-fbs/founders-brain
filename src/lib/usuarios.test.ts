import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { escribirDevolviendo, fila, pool } from './db'
import { crearUsuario, cambiarConsultora, consultorasParaElegir, crearConsultora } from './usuarios'

const hayBase = Boolean(process.env.DATABASE_URL)
const prueba = hayBase ? describe : describe.skip

afterAll(async () => { if (hayBase) await pool().end() })

/**
 * Las consultoras son una lista cerrada.
 *
 * Todo lo de acá existe por el mismo caso: escribir un nombre creaba una
 * consultora. Un error de tipeo partía una cartera en dos y el filtro por
 * consultora empezaba a mostrar de menos sin que nadie pudiera darse cuenta
 * mirando la pantalla.
 */
prueba('el equipo de consultoras', () => {
  beforeEach(async () => {
    await pool().query('truncate clientes, consultoras, usuarios restart identity cascade')
    await escribirDevolviendo(
      `insert into consultoras (nombre, nombre_pleg, del_equipo) values ('Romina', 'romina', true) returning id`, [])
  })

  it('dar de alta a alguien con una consultora que no existe no la crea: lo dice', async () => {
    const r = await crearUsuario({
      email: 'nueva@foundersbs.com', nombre: 'Nueva', clave: 'clavelarga1', consultora: 'Romi',
    })
    expect(r).toMatchObject({ ok: false })
    expect((r as { error: string }).error).toContain('no está en el equipo')
    expect(await fila('select id from consultoras where nombre_pleg = $1', ['romi'])).toBeNull()
  })

  it('con una que sí está, entra y queda asignada', async () => {
    const r = await crearUsuario({
      email: 'romina@foundersbs.com', nombre: 'Romina', clave: 'clavelarga1', consultora: 'romina',
    })
    expect(r).toMatchObject({ ok: true })
    const u = await fila<{ rol: string; consultora_id: number }>('select rol, consultora_id from usuarios')
    expect(u?.rol).toBe('consultora')
    expect(u?.consultora_id).not.toBeNull()
  })

  it('moverlo a una consultora inventada tampoco la crea', async () => {
    await crearUsuario({ email: 'x@x.com', nombre: 'X', clave: 'clavelarga1', consultora: null })
    const yo = await fila<{ id: number }>('select id from usuarios')
    expect(await cambiarConsultora(yo!.id, 'Kathering')).toMatchObject({ ok: false })
    expect(await fila('select id from consultoras where nombre_pleg = $1', ['kathering'])).toBeNull()
  })

  it('sumar a alguien al equipo es explícito, y queda marcada como del equipo', async () => {
    expect(await crearConsultora('Victoria A')).toMatchObject({ ok: true })
    const c = await fila<{ del_equipo: boolean }>('select del_equipo from consultoras where nombre_pleg = $1', ['victoria a'])
    expect(c?.del_equipo).toBe(true)
  })

  it('la misma no se suma dos veces, aunque se escriba con otra caja', async () => {
    expect(await crearConsultora('ROMINA')).toMatchObject({ ok: false })
  })

  /**
   * Una consultora de afuera del equipo que todavía tiene clientes se sigue
   * ofreciendo. Si se escondiera, la ficha de esos clientes diría «sin
   * consultora» mientras en la base siguen asignados: la pantalla mentiría.
   */
  it('las de afuera con clientes se siguen pudiendo elegir; las vacías no', async () => {
    const vieja = await escribirDevolviendo<{ id: number }>(
      `insert into consultoras (nombre, nombre_pleg) values ('Romina Gómez', 'romina gomez') returning id`, [])
    await escribirDevolviendo(
      `insert into consultoras (nombre, nombre_pleg) values ('Se fue', 'se fue') returning id`, [])
    await escribirDevolviendo(
      `insert into clientes (nombre, nombre_clave, nombre_pleg, consultora_id) values ('Ana', 'ana', 'ana', $1) returning id`,
      [vieja.id])

    const paraElegir = (await consultorasParaElegir()).map((c) => c.nombre)
    expect(paraElegir).toContain('Romina')
    expect(paraElegir).toContain('Romina Gómez')
    expect(paraElegir).not.toContain('Se fue')
  })

  // Regla 3: que se parezcan no las hace la misma. La migración que sumó al
  // equipo tampoco las junta: eso lo decide una persona pasando los clientes.
  it('«Romina Gómez» no se junta sola con «Romina»: son dos', async () => {
    const vieja = await escribirDevolviendo<{ id: number }>(
      `insert into consultoras (nombre, nombre_pleg) values ('Romina Gómez', 'romina gomez') returning id`, [])
    await escribirDevolviendo(
      `insert into clientes (nombre, nombre_clave, nombre_pleg, consultora_id) values ('Ana', 'ana', 'ana', $1) returning id`,
      [vieja.id])
    const todas = await consultorasParaElegir()
    expect(todas.filter((c) => c.nombre.startsWith('Romina'))).toHaveLength(2)
    expect(todas.find((c) => c.nombre === 'Romina Gómez')!.del_equipo).toBe(false)
  })
})
