'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ENLACES = [
  { href: '/clientes', texto: 'Clientes' },
  { href: '/importar', texto: 'Importar' },
]

export function Menu() {
  const ruta = usePathname()
  return (
    <nav>
      {ENLACES.map((e) => (
        <Link key={e.href} href={e.href} className={ruta.startsWith(e.href) ? 'activo' : undefined}>
          {e.texto}
        </Link>
      ))}
    </nav>
  )
}
