import { redirect } from 'next/navigation'
import { salir, usuarioActual } from '@/lib/auth'
import { BaseSinAndar } from '@/componentes/BaseSinAndar'
import { Menu } from '@/componentes/Menu'
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
    <>
      <header className="barra">
        <a className="marca" href="/clientes">Founders</a>
        <Menu />
        <div className="quien">
          <span>{usuario.nombre}</span>
          <form action={cerrar}>
            <button type="submit">salir</button>
          </form>
        </div>
      </header>
      <main className="hoja">{children}</main>
    </>
  )
}
