// Mete el texto de las migraciones adentro del código.
//
// La pantalla de «falta una migración» tiene que poder mostrar el SQL para
// copiar y pegar: quien la ve está en el navegador, no en una terminal, y
// decirle «corré npm run esquema» no le sirve de nada.
//
// Los .sql no viajan al servidor de Vercel —sólo entra lo que se importa—,
// así que se genera un módulo con el contenido. Corre solo antes del build
// (npm lo dispara con el gancho `prebuild`) y hay una prueba que falla si el
// generado quedó viejo.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const carpeta = 'supabase/migrations'
const destino = 'src/lib/migraciones.ts'

const archivos = readdirSync(carpeta).filter((f) => f.endsWith('.sql')).sort()

const cuerpo = archivos
  .map((archivo) => {
    const sql = readFileSync(join(carpeta, archivo), 'utf8').trim()
    return `  {\n    archivo: ${JSON.stringify(archivo)},\n    sql: ${JSON.stringify(sql)},\n  },`
  })
  .join('\n')

writeFileSync(destino, `// GENERADO POR scripts/migraciones.mjs — no editar a mano.
// Se regenera solo antes del build. Si lo tocás, el próximo build lo pisa.

export type Migracion = { archivo: string; sql: string }

export const MIGRACIONES: readonly Migracion[] = [
${cuerpo}
]

/** El SQL de las migraciones que faltan, en orden, listo para pegar. */
export function sqlDe(archivos: readonly string[]): string {
  const separador = '-- ' + '='.repeat(68)
  return MIGRACIONES.filter((m) => archivos.includes(m.archivo))
    .map((m) => \`\${separador}\\n-- \${m.archivo}\\n\${separador}\\n\\n\${m.sql}\`)
    .join('\\n\\n')
}
`)

console.log(`${destino}: ${archivos.length} migraciones`)
