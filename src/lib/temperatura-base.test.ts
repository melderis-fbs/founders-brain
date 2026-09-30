import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { escribirDevolviendo, pool } from './db'
import {
  anotarEnLaTemperatura, comoLoLeeElSemaforo, contarTemperaturas, descartarTemperatura,
  guardarTemperatura, lasQueValen, loQueDijoLaCartera, temperaturasDe, volverAPrender,
} from './temperatura'

const hayBase = Boolean(process.env.DATABASE_URL)
const prueba = hayBase ? describe : describe.skip

afterAll(async () => { if (hayBase) await pool().end() })

prueba('la temperatura guardada', () => {
  let cliente = 0
  let usuario = 0

  beforeEach(async () => {
    await pool().query('truncate clientes, consultoras, usuarios restart identity cascade')
    usuario = (await escribirDevolviendo<{ id: number }>(
      `insert into usuarios (email, nombre, rol, clave_hash) values ('x@x.com', 'Lucía', 'admin', 'x') returning id`, [])).id
    cliente = (await escribirDevolviendo<{ id: number }>(
      `insert into clientes (nombre, nombre_clave, nombre_pleg) values ('Ana', 'ana', 'ana') returning id`, [])).id
  })

  const caliente = () => guardarTemperatura({
    clienteId: cliente, de: 'sesion', origenId: 7, temperatura: 'caliente',
    deQue: 'material', porque: 'Puso en duda el método.',
    citas: ['hago lo que me dicen y no pasa nada'], loOtro: null, quePreguntar: null,
  })

  it('sin cita no se guarda nada arriba de «bien», aunque el modelo lo diga', async () => {
    await guardarTemperatura({
      clienteId: cliente, de: 'sesion', origenId: 1, temperatura: 'quemando',
      deQue: null, porque: 'Me parece que se va.', citas: [], loOtro: null, quePreguntar: null,
    })
    expect((await temperaturasDe(cliente))[0]!.temperatura).toBe('bien')
  })

  // Regla 7: volver a analizar corrige, no duplica.
  it('analizar dos veces la misma sesión corrige la fila, no agrega otra', async () => {
    await caliente()
    await guardarTemperatura({
      clienteId: cliente, de: 'sesion', origenId: 7, temperatura: 'tibio',
      deQue: 'tiempo', porque: 'Le cuesta el ritmo.',
      citas: ['me está costando seguir'], loOtro: null, quePreguntar: null,
    })
    const todas = await temperaturasDe(cliente)
    expect(todas).toHaveLength(1)
    expect(todas[0]!.temperatura).toBe('tibio')
  })

  // Regla 9: lo que escribió una persona no lo pisa un análisis automático.
  it('volver a analizar NO borra la nota de la consultora', async () => {
    const { id } = await caliente()
    await anotarEnLaTemperatura({ id, clienteId: cliente, usuarioId: usuario, nota: 'Hablé con ella, era por el cambio de coach.' })
    await caliente()
    const guardada = (await temperaturasDe(cliente))[0]!
    expect(guardada.nota).toBe('Hablé con ella, era por el cambio de coach.')
    expect(guardada.nota_por_nombre).toBe('Lucía')
  })

  it('descartarla pide decir por qué, y después no cuenta para el semáforo', async () => {
    const { id } = await caliente()
    expect(comoLoLeeElSemaforo(await temperaturasDe(cliente))).toHaveLength(1)

    expect(await descartarTemperatura({ id, clienteId: cliente, usuarioId: usuario, porQue: '  ' }))
      .toMatchObject({ ok: false })

    await descartarTemperatura({ id, clienteId: cliente, usuarioId: usuario, porQue: 'Se quejaba de su proveedor, no de nosotros.' })
    const todas = await temperaturasDe(cliente)
    expect(lasQueValen(todas)).toHaveLength(0)
    expect(todas[0]!.por_que_se_descarto).toContain('proveedor')
    expect(todas[0]!.descartada_por_nombre).toBe('Lucía')
    expect((await loQueDijoLaCartera()).get(cliente)).toBeUndefined()
  })

  it('el descarte sobrevive a un análisis que dice lo mismo, y se cae si dice otra cosa', async () => {
    const { id } = await caliente()
    await descartarTemperatura({ id, clienteId: cliente, usuarioId: usuario, porQue: 'No era de nosotros.' })

    await caliente()   // el modelo vuelve a decir lo mismo: alguien ya lo miró
    expect(lasQueValen(await temperaturasDe(cliente))).toHaveLength(0)

    await guardarTemperatura({
      clienteId: cliente, de: 'sesion', origenId: 7, temperatura: 'quemando',
      deQue: 'precio', porque: 'Habló de la garantía.',
      citas: ['estoy viendo si pido el reembolso'], loOtro: null, quePreguntar: null,
    })
    expect(lasQueValen(await temperaturasDe(cliente))).toHaveLength(1)
  })

  it('se puede volver a prender la que alguien descartó por error', async () => {
    const { id } = await caliente()
    await descartarTemperatura({ id, clienteId: cliente, usuarioId: usuario, porQue: 'Me confundí.' })
    expect(await volverAPrender(id, cliente)).toMatchObject({ ok: true })
    expect(lasQueValen(await temperaturasDe(cliente))).toHaveLength(1)
  })

  it('un «bien» queda guardado pero no prende nada: sirve para saber que se leyó', async () => {
    await guardarTemperatura({
      clienteId: cliente, de: 'sesion', origenId: 3, temperatura: 'bien',
      deQue: null, porque: 'No dijo nada en contra nuestro.', citas: [], loOtro: null, quePreguntar: null,
    })
    expect(await temperaturasDe(cliente)).toHaveLength(1)
    expect(comoLoLeeElSemaforo(await temperaturasDe(cliente))).toHaveLength(0)
  })

  it('el tablero cuenta los tibios aparte de las quejas', async () => {
    await caliente()
    const otro = (await escribirDevolviendo<{ id: number }>(
      `insert into clientes (nombre, nombre_clave, nombre_pleg) values ('Beto', 'beto', 'beto') returning id`, [])).id
    await guardarTemperatura({
      clienteId: otro, de: 'encuesta', origenId: 9, temperatura: 'tibio',
      deQue: 'tiempo', porque: 'Dijo que no llega.', citas: ['no llego con los materiales'], loOtro: null, quePreguntar: null,
    })
    expect(await contarTemperaturas()).toEqual({ tibios: 1, quejas: 1 })
  })

  it('una temperatura que no existe no se guarda', async () => {
    await expect(guardarTemperatura({
      clienteId: cliente, de: 'sesion', origenId: 2, temperatura: 'hirviendo' as never,
      deQue: null, porque: null, citas: ['algo'], loOtro: null, quePreguntar: null,
    })).rejects.toThrow()
  })
})
