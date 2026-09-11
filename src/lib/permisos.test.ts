import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { Usuario } from './auth'
import { listarClientes, exportarClientes, traerCliente } from './clientes'
import { escribirDevolviendo, pool } from './db'
import { alcanceDe, puedeVerCliente, sinConsultoraAsignada } from './permisos'

const hayBase = Boolean(process.env.DATABASE_URL)
const prueba = hayBase ? describe : describe.skip

function usuario(rol: 'admin' | 'consultora', consultoraId: number | null): Usuario {
  return { id: 1, email: 'x@x.com', nombre: 'X', rol, consultoraId }
}

describe('quién ve qué, sin tocar la base', () => {
  it('el admin ve la cartera entera', () => {
    expect(alcanceDe(usuario('admin', null))).toEqual({ todo: true })
  })

  it('una consultora ve lo de su consultora', () => {
    expect(alcanceDe(usuario('consultora', 7))).toEqual({ todo: false, consultoraId: 7 })
  })

  it('sin consultora asignada no ve nada, y eso no es lo mismo que no haber clientes', () => {
    const alcance = alcanceDe(usuario('consultora', null))
    expect(sinConsultoraAsignada(alcance)).toBe(true)
    expect(sinConsultoraAsignada(alcanceDe(usuario('admin', null)))).toBe(false)
    expect(sinConsultoraAsignada(alcanceDe(usuario('consultora', 7)))).toBe(false)
  })
})

prueba('cada consultora ve sólo sus clientes', () => {
  let lucia = 0
  let julieta = 0
  let deLucia = 0
  let deJulieta = 0

  beforeEach(async () => {
    await pool().query('truncate clientes, consultoras restart identity cascade')
    lucia = (await escribirDevolviendo<{ id: number }>(
      `insert into consultoras (nombre, nombre_pleg) values ('Lucía Fernández', 'lucia fernandez') returning id`, [])).id
    julieta = (await escribirDevolviendo<{ id: number }>(
      `insert into consultoras (nombre, nombre_pleg) values ('Julieta Ponce', 'julieta ponce') returning id`, [])).id
    deLucia = (await escribirDevolviendo<{ id: number }>(
      `insert into clientes (nombre, nombre_clave, nombre_pleg, consultora_id) values ('Ana Díaz', 'ana diaz', 'ana diaz', $1) returning id`, [lucia])).id
    deJulieta = (await escribirDevolviendo<{ id: number }>(
      `insert into clientes (nombre, nombre_clave, nombre_pleg, consultora_id) values ('Beto Ruiz', 'beto ruiz', 'beto ruiz', $1) returning id`, [julieta])).id
  })

  afterAll(async () => { await pool().end() })

  it('la lista de una consultora trae sólo los suyos', async () => {
    const suyos = await listarClientes({ todo: false, consultoraId: lucia })
    expect(suyos.map((c) => c.nombre)).toEqual(['Ana Díaz'])
  })

  it('el admin ve los dos', async () => {
    const todos = await listarClientes({ todo: true })
    expect(todos.map((c) => c.nombre)).toEqual(['Ana Díaz', 'Beto Ruiz'])
  })

  it('la ficha de un cliente ajeno se comporta como si no existiera', async () => {
    expect(await traerCliente(deJulieta, { todo: false, consultoraId: lucia })).toBeNull()
    expect((await traerCliente(deJulieta, { todo: false, consultoraId: julieta }))?.nombre).toBe('Beto Ruiz')
    expect((await traerCliente(deJulieta, { todo: true }))?.nombre).toBe('Beto Ruiz')
  })

  it('un id escrito a mano no alcanza para tocar un cliente ajeno', async () => {
    expect(await puedeVerCliente(deJulieta, { todo: false, consultoraId: lucia })).toBe(false)
    expect(await puedeVerCliente(deLucia, { todo: false, consultoraId: lucia })).toBe(true)
    expect(await puedeVerCliente(deLucia, { todo: true })).toBe(true)
  })

  it('sin consultora asignada no se ve ni se toca nada', async () => {
    expect(await listarClientes({ todo: false, consultoraId: null })).toEqual([])
    expect(await traerCliente(deLucia, { todo: false, consultoraId: null })).toBeNull()
    expect(await puedeVerCliente(deLucia, { todo: false, consultoraId: null })).toBe(false)
  })

  it('la planilla que se baja trae lo mismo que se ve en pantalla', async () => {
    const suyos = await exportarClientes({ todo: false, consultoraId: lucia })
    expect(suyos.map((c) => c.nombre)).toEqual(['Ana Díaz'])
    expect((await exportarClientes({ todo: true })).length).toBe(2)
  })

  it('el filtro de la pantalla achica, nunca agranda', async () => {
    // Una consultora que escriba el id de otra en la URL sigue sin verla.
    const intento = await listarClientes({ todo: false, consultoraId: lucia }, { consultoraId: julieta })
    expect(intento).toEqual([])
  })
})
