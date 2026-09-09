/**
 * Importa un CSV desde la línea de comandos, con las mismas reglas que la
 * pantalla.
 *
 *   npm run importar -- ruta/al/archivo.csv
 *
 * Sirve para la primera carga de la cartera entera: son cientos de escrituras
 * seguidas y desde acá no hay tope de tiempo, mientras que una función de
 * Vercel se corta al minuto.
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { importarCsv } from '../src/lib/importar/importar'
import { pool } from '../src/lib/db'

async function main() {
  const ruta = process.argv[2]
  if (!ruta) {
    console.error('Uso: npm run importar -- <archivo.csv>')
    process.exit(1)
  }

  const contenido = readFileSync(ruta, 'utf8')
  const arranque = Date.now()
  const r = await importarCsv({ contenido, archivo: basename(ruta), usuarioId: null })
  const segundos = ((Date.now() - arranque) / 1000).toFixed(1)

  if (r.errorGeneral) {
    console.error(`No se aplicó nada: ${r.errorGeneral}`)
    await pool().end()
    process.exit(1)
  }

  console.log(`${r.filasLeidas} filas leídas en ${segundos} s`)
  console.log(`  ${r.nuevos} nuevos · ${r.actualizados} actualizados · ${r.sinCambios} sin cambios`)

  const noEntraron = r.filas.filter((f) => f.resultado === 'omitida')
  if (noEntraron.length > 0) {
    console.log(`\nNo entraron ${noEntraron.length}:`)
    for (const f of noEntraron) console.log(`  fila ${f.nroFila} · ${f.clienteNombre ?? 'sin nombre'} · ${f.motivo}`)
  }

  const conAvisos = r.filas.filter((f) => f.resultado !== 'omitida' && f.avisos.length > 0)
  if (conAvisos.length > 0) {
    console.log(`\nEntraron, pero con algún dato afuera (${conAvisos.length}):`)
    for (const f of conAvisos) for (const a of f.avisos) console.log(`  fila ${f.nroFila} · ${f.clienteNombre} · ${a}`)
  }

  if (r.columnasIgnoradas.length > 0) console.log(`\nColumnas ignoradas: ${r.columnasIgnoradas.join(', ')}`)
  console.log(`\nEl reporte quedó guardado en /importar/${r.importacionId}`)

  await pool().end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
