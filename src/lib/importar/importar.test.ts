import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { exportarClientes } from '../clientes'
import { fila, filas, pool } from '../db'
import { importarCsv } from './importar'
import { csvDeCartera } from './plantilla'

const hayBase = Boolean(process.env.DATABASE_URL)
const prueba = hayBase ? describe : describe.skip

async function limpiar() {
  await pool().query('truncate clientes, consultoras, documentos, importaciones, importacion_filas restart identity cascade')
}

async function importar(csv: string, archivo = 'planilla.csv') {
  return importarCsv({ contenido: csv, archivo, usuarioId: null })
}

const ENCABEZADOS = 'nombre,consultora,estado,programa,fecha inicio,meta mensual,ticket,ventas ultimo mes,oferta,texto_onboarding'

prueba('la importación de la planilla madre', () => {
  beforeEach(limpiar)
  afterAll(async () => { await pool().end() })

  it('entran los clientes y el reporte los cuenta', async () => {
    const r = await importar(
      `${ENCABEZADOS}
Norma Márquez,Lucía Fernández,activo,4,03/02/2025,5.400.000,1.800.000,1,Proyecto llave en mano,Texto del onboarding
Juan Pérez,Lucía Fernández,activo,6,10/03/2025,2.000.000,500.000,0,,`,
    )
    expect(r.errorGeneral).toBeNull()
    expect(r.filasLeidas).toBe(2)
    expect(r.nuevos).toBe(2)
    expect(r.omitidas).toBe(0)

    const norma = await fila<{ nombre: string; programa_meses: number; fecha_inicio: string }>(
      'select nombre, programa_meses, fecha_inicio from clientes where nombre = $1', ['Norma Márquez'],
    )
    expect(norma?.programa_meses).toBe(4)
    expect(norma?.fecha_inicio).toBe('2025-02-03')

    const numeros = await fila<{ meta_mensual: number; ventas_ultimo_mes: number }>(
      `select m.meta_mensual, m.ventas_ultimo_mes from cliente_numeros m
        join clientes c on c.id = m.cliente_id where c.nombre = 'Norma Márquez'`,
    )
    expect(numeros?.meta_mensual).toBe(5400000)
    expect(numeros?.ventas_ultimo_mes).toBe(1)
  })

  it('regla 1 · un 0 se guarda como cero, y una celda vacía no lo pisa', async () => {
    await importar(`${ENCABEZADOS}
Juan Pérez,Lucía,activo,6,10/03/2025,2.000.000,500.000,0,,`)
    const antes = await fila<{ ventas_ultimo_mes: number | null; meta_mensual: number | null }>(
      `select m.ventas_ultimo_mes, m.meta_mensual from cliente_numeros m
        join clientes c on c.id = m.cliente_id where c.nombre = 'Juan Pérez'`,
    )
    expect(antes?.ventas_ultimo_mes).toBe(0)          // se midió y dio cero
    expect(antes?.meta_mensual).toBe(2000000)

    // La misma planilla, ahora con la meta en blanco: no borra lo cargado.
    await importar(`${ENCABEZADOS}
Juan Pérez,Lucía,activo,6,10/03/2025,,500.000,0,,`)
    const despues = await fila<{ meta_mensual: number | null }>(
      `select m.meta_mensual from cliente_numeros m
        join clientes c on c.id = m.cliente_id where c.nombre = 'Juan Pérez'`,
    )
    expect(despues?.meta_mensual).toBe(2000000)
  })

  it('regla 3 · un nombre parecido no entra: se informa', async () => {
    await importar(`${ENCABEZADOS}
María Márquez,Lucía,activo,4,03/02/2025,,,,,`)
    const r = await importar(`${ENCABEZADOS}
Maria Marquez,Lucía,activo,4,03/02/2025,,,,,`)

    expect(r.nuevos).toBe(0)
    expect(r.omitidas).toBe(1)
    expect(r.filas[0].nroFila).toBe(2)
    expect(r.filas[0].motivo).toContain('María Márquez')
    expect(await contarClientes()).toBe(1)
  })

  it('regla 3 · dos filas parecidas dentro del mismo archivo tampoco se mezclan', async () => {
    const r = await importar(`${ENCABEZADOS}
María Márquez,Lucía,activo,4,03/02/2025,,,,,
Maria Marquez,Lucía,activo,4,03/02/2025,,,,,`)
    expect(r.nuevos).toBe(1)
    expect(r.omitidas).toBe(1)
    expect(r.filas[1].motivo).toContain('fila 2')
  })

  it('regla 7 · volver a importar corrige, no duplica', async () => {
    const csv = `${ENCABEZADOS}
Norma Márquez,Lucía,activo,4,03/02/2025,5.400.000,1.800.000,1,Proyecto llave en mano,Texto del onboarding`
    const primera = await importar(csv)
    expect(primera.nuevos).toBe(1)

    const segunda = await importar(csv)
    expect(segunda.nuevos).toBe(0)
    expect(segunda.sinCambios).toBe(1)
    expect(await contarClientes()).toBe(1)
    expect(await contarDocumentos()).toBe(1)

    const tercera = await importar(`${ENCABEZADOS}
Norma Márquez,Lucía,activo,4,03/02/2025,6.000.000,1.800.000,2,Proyecto llave en mano,Texto del onboarding`)
    expect(tercera.actualizados).toBe(1)
    expect(await contarClientes()).toBe(1)
    const meta = await fila<{ meta_mensual: number }>(
      `select m.meta_mensual from cliente_numeros m join clientes c on c.id = m.cliente_id
        where c.nombre = 'Norma Márquez'`,
    )
    expect(meta?.meta_mensual).toBe(6000000)
  })

  it('regla 10 · un dato que no se entiende se informa y no rompe la fila', async () => {
    const r = await importar(`${ENCABEZADOS}
Norma Márquez,Lucía,activo,4,cuando pueda,lo que salga,1.800.000,1,,`)
    expect(r.nuevos).toBe(1)
    const avisos = r.filas[0].avisos.join(' | ')
    expect(avisos).toContain('Meta mensual: "lo que salga" no es un número')
    expect(avisos).toContain('Inicio del programa: "cuando pueda" no es una fecha')
    expect(avisos).toContain('Ese dato quedó como estaba')
    const c = await fila<{ fecha_inicio: string | null }>('select fecha_inicio from clientes where nombre = $1', ['Norma Márquez'])
    expect(c?.fecha_inicio).toBeNull()
  })

  it('una fila sin nombre se informa con su número de fila', async () => {
    const r = await importar(`${ENCABEZADOS}
,Lucía,activo,4,03/02/2025,,,,,
Juan Pérez,Lucía,activo,6,10/03/2025,,,,,`)
    expect(r.omitidas).toBe(1)
    expect(r.filas[0].nroFila).toBe(2)
    expect(r.filas[0].motivo).toContain('nombre')
    expect(r.nuevos).toBe(1)
  })

  it('las columnas que no reconoce las informa en vez de tragárselas', async () => {
    const r = await importar(`nombre,color favorito,horóscopo
Norma Márquez,verde,libra`)
    expect(r.columnasIgnoradas).toEqual(['color favorito', 'horóscopo'])
    expect(r.nuevos).toBe(1)
  })

  it('sin columna de nombre no se aplica nada y se dice por qué', async () => {
    const r = await importar(`consultora,meta mensual
Lucía,5.000.000`)
    expect(r.errorGeneral).toContain('nombre del cliente')
    expect(await contarClientes()).toBe(0)
  })

  it('el id del cliente manda sobre el nombre: se le puede corregir el nombre sin duplicarlo', async () => {
    await importar(`id_cliente,nombre,consultora
FB-001,Maria Marquez,Lucía`)
    const r = await importar(`id_cliente,nombre,consultora
FB-001,María Márquez,Lucía`)
    expect(r.actualizados).toBe(1)
    expect(await contarClientes()).toBe(1)
    const c = await fila<{ nombre: string }>('select nombre from clientes where ref_externa = $1', ['FB-001'])
    expect(c?.nombre).toBe('María Márquez')
  })

  it('la consultora se reutiliza y se avisa cuando es nueva', async () => {
    const r = await importar(`${ENCABEZADOS}
Norma Márquez,Lucía Fernández,activo,4,03/02/2025,,,,,
Juan Pérez,lucia fernandez,activo,6,10/03/2025,,,,,`)
    expect(r.filas[0].avisos.join(' ')).toContain('Consultora nueva')
    expect(r.filas[1].avisos).toEqual([])
    const cuantas = await filas<{ n: number }>('select count(*)::int as n from consultoras')
    expect(cuantas[0].n).toBe(1)
  })

  it('la planilla sale de la app: se baja la cartera y se vuelve a subir sin que cambie nada', async () => {
    await importar(`${ENCABEZADOS}
Norma Márquez,Lucía Fernández,activo,4,03/02/2025,5.400.000,1.800.000,1,Proyecto llave en mano,Texto del onboarding
Juan Pérez,Lucía Fernández,pausado,6,10/03/2025,2.000.000,500.000,0,,`)

    const csv = csvDeCartera(await exportarClientes({ todo: true }))
    const r = await importar(csv, 'cartera.csv')

    expect(r.errorGeneral).toBeNull()
    expect(r.columnasIgnoradas).toEqual([])   // la aplicación entiende todo lo que ella misma escribe
    expect(r.omitidas).toBe(0)
    expect(r.nuevos).toBe(0)
    expect(r.sinCambios).toBe(2)              // el viaje de ida y vuelta no mueve un solo dato
    expect(await contarClientes()).toBe(2)
  })

  it('el reporte queda guardado, no sólo en pantalla', async () => {
    const r = await importar(`${ENCABEZADOS}
,Lucía,activo,4,03/02/2025,,,,,`)
    const guardadas = await filas<{ nro_fila: number; resultado: string; motivo: string }>(
      'select nro_fila, resultado, motivo from importacion_filas where importacion_id = $1', [r.importacionId],
    )
    expect(guardadas).toHaveLength(1)
    expect(guardadas[0].resultado).toBe('omitida')
  })
})

async function contarClientes() {
  const r = await filas<{ n: number }>('select count(*)::int as n from clientes')
  return r[0].n
}
async function contarDocumentos() {
  const r = await filas<{ n: number }>('select count(*)::int as n from documentos')
  return r[0].n
}
