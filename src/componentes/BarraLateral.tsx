'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Iconos } from './Iconos'

const AHORA = [
  { href: '/tablero', texto: 'Tablero', icono: Iconos.tablero },
  { href: '/clientes', texto: 'Clientes', icono: Iconos.clientes },
  { href: '/grilla', texto: 'La grilla', icono: Iconos.grilla },
  { href: '/importar', texto: 'Importar', icono: Iconos.importar },
]

/** Lo que todavía no está. Se ve, pero apagado: no se promete lo que no hay. */
const DESPUES = [
  { texto: 'Alertas', icono: Iconos.alertas },
  { texto: 'Consultoras', icono: Iconos.consultoras },
]

export function BarraLateral() {
  const ruta = usePathname()
  const parametros = useSearchParams()
  return (
    <>
      <Link className="logo" href="/tablero">
        <span className="cuadro">F</span>
        <span>
          <span className="nombre">Founders</span>
          <br />
          <span className="que">Brain</span>
        </span>
      </Link>

      <form className="buscador" action="/clientes">
        <Iconos.buscar />
        <input
          type="text" name="buscar" placeholder="Buscar cliente…" aria-label="Buscar cliente"
          defaultValue={parametros.get('buscar') ?? ''} key={parametros.get('buscar') ?? ''}
        />
      </form>

      <nav>
        {AHORA.map((e) => (
          <Link key={e.href} href={e.href} className={ruta.startsWith(e.href) ? 'activo' : undefined}>
            <e.icono />
            {e.texto}
          </Link>
        ))}
        {DESPUES.map((e) => (
          <span key={e.texto} className="pronto" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px' }}>
            <e.icono />
            {e.texto}
          </span>
        ))}
      </nav>
    </>
  )
}
