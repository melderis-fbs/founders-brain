import { readFileSync } from 'node:fs'

// Carga .env.local para que las pruebas hablen con la misma base que la app.
try {
  for (const linea of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch {
  // sin .env.local, las pruebas que necesitan base se saltean solas
}
