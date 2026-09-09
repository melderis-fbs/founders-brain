import { redirect } from 'next/navigation'
import { salir, usuarioActual } from '@/lib/auth'
import { Menu } from '@/componentes/Menu'

export const dynamic = 'force-dynamic'

export default async function Marco({ children }: { children: React.ReactNode }) {
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
