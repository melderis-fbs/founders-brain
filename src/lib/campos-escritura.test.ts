import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { camposEscritosPorPersonas, guardarUnCampo, origenesDe } from './campos-escritura'
import { escribirDevolviendo, fila, pool } from './db'
import { importarCsv } from './importar/importar'

const hayBase = Boolean(process.env.DATABASE_URL)
const prueba = hayBase ? describe : describe.skip

const ENCABEZADOS = 'nombre,consultora,estado,programa,fecha inicio,meta mensual,oferta'

async function unUsuario() {
  const u = await escribirDevolviendo<{ id: number }>(
    `insert into usuarios (email, nombre, rol, clave_hash) values ('prueba@founders.com', 'Prueba', 'admin', 'x')
     on conflict (email) do update set nombre = excluded.nombre returning id`,
  )
  return u.id
}

prueba('editar la ficha en el lugar', () => {
  beforeEach(async () => {
    await pool().query('truncate clientes, consultoras, documentos, importaciones, importacion_filas restart identity cascade')
  })
  afterAll(async () => { await pool().end() })

  async function unCliente() {
    await importarCsv({
      contenido: `${ENCABEZADOS}\nNorma Márquez,Lucía,activo,4,03/02/2025,5.400.000,`,
      archivo: 'p.csv', usuarioId: null,
    })
    const c = await fila<{ id: number }>('select id from clientes where nombre = $1', ['Norma Márquez'])
    return c!.id
  }

  it('guarda lo que se escribe y anota que lo escribió una persona', async () => {
    const clienteId = await unCliente()
    const usuarioId = await unUsuario()

    const r = await guardarUnCampo({ clienteId, clave: 'oferta', bruto: 'Programa de 8 semanas', usuarioId })
    expect(r).toEqual({ ok: true })

    const guardado = await fila<{ oferta: string }>('select oferta from cliente_negocio where cliente_id = $1', [clienteId])
    expect(guardado?.oferta).toBe('Programa de 8 semanas')

    const origenes = await origenesDe(clienteId)
    expect(origenes.get('oferta')?.origen).toBe('persona')
    expect(origenes.get('meta_mensual')?.origen).toBe('planilla')   // eso vino de la planilla
  })

  it('lo que no se entiende no se guarda, y se dice por qué', async () => {
    const clienteId = await unCliente()
    const usuarioId = await unUsuario()

    const r = await guardarUnCampo({ clienteId, clave: 'ticket', bruto: 'lo que salga', usuarioId })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('no es un número')
  })

  it('regla 1 · vaciar un campo lo deja vacío, no en cero', async () => {
    const clienteId = await unCliente()
    const usuarioId = await unUsuario()

    await guardarUnCampo({ clienteId, clave: 'ticket', bruto: '1.800.000', usuarioId })
    await guardarUnCampo({ clienteId, clave: 'ticket', bruto: '', usuarioId })

    const g = await fila<{ ticket: number | null }>('select ticket from cliente_numeros where cliente_id = $1', [clienteId])
    expect(g?.ticket).toBeNull()
  })

  it('regla 3 · no se puede renombrar un cliente con el nombre de otro', async () => {
    const clienteId = await unCliente()
    const usuarioId = await unUsuario()
    await importarCsv({ contenido: `${ENCABEZADOS}\nJuan Pérez,Lucía,activo,4,03/02/2025,,`, archivo: 'p.csv', usuarioId: null })

    const r = await guardarUnCampo({ clienteId, clave: 'nombre', bruto: 'Juan Pérez', usuarioId })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Juan Pérez')

    const sigue = await fila<{ nombre: string }>('select nombre from clientes where id = $1', [clienteId])
    expect(sigue?.nombre).toBe('Norma Márquez')
  })

  it('la planilla puede pisar una corrección a mano, pero lo informa', async () => {
    const clienteId = await unCliente()
    const usuarioId = await unUsuario()
    await guardarUnCampo({ clienteId, clave: 'meta_mensual', bruto: '9.000.000', usuarioId })
    expect(await camposEscritosPorPersonas()).toContain(`${clienteId}:meta_mensual`)

    const r = await importarCsv({
      contenido: `${ENCABEZADOS}\nNorma Márquez,Lucía,activo,4,03/02/2025,5.400.000,`,
      archivo: 'p.csv', usuarioId: null,
    })

    expect(r.actualizados).toBe(1)
    expect(r.filas[0].avisos.join(' ')).toContain('la planilla pisó lo que alguien había corregido a mano')

    const g = await fila<{ meta_mensual: number }>('select meta_mensual from cliente_numeros where cliente_id = $1', [clienteId])
    expect(g?.meta_mensual).toBe(5400000)   // la planilla manda, pero no calla
  })

  it('la consultora se puede cambiar desde la ficha y se reutiliza la que existe', async () => {
    const clienteId = await unCliente()
    const usuarioId = await unUsuario()

    await guardarUnCampo({ clienteId, clave: 'consultora', bruto: 'lucia', usuarioId })
    const cuantas = await fila<{ n: number }>('select count(*)::int as n from consultoras')
    expect(cuantas?.n).toBe(1)   // «lucia» y «Lucía» son la misma consultora
  })
})
