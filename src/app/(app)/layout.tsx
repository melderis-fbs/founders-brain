import { redirect } from 'next/navigation'
import { salir, usuarioActual } from '@/lib/auth'
import { BarraLateral } from '@/componentes/BarraLateral'
import { BaseSinAndar } from '@/componentes/BaseSinAndar'
import { revisarBase } from '@/lib/revision'

export const dynamic = 'force-dynamic'

export default async function Marco({ children }: { children: React.ReactNode }) {
  const revision = await revisarBase()
  if (!revision.ok) return <BaseSinAndar revision={revision} />

  const usuario = await usuarioActual()
  if (!usuario) redirect('/login')

  async function cerrar() {
    'use server'
    await salir()
    redirect('/login')
  }

  return (
    <div className="marco">
      <aside className="lateral">
        <BarraLateral esAdmin={usuario.rol === 'admin'} />
        <div className="abajo">
          {usuario.nombre}
          {usuario.rol === 'admin' ? <span className="mini"> · admin</span> : null}
          {' · '}
          <form action={cerrar}><button type="submit">salir</button></form>
        </div>
      </aside>
      <main className="hoja">{children}</main>
    </div>
  )
}
