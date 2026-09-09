import type { NextConfig } from 'next'

const config: NextConfig = {
  // `pg` abre sockets y carga bindings opcionales: se deja fuera del bundle
  // para que en Vercel corra tal cual viene de npm.
  serverExternalPackages: ['pg'],
}

export default config
