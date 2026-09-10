import { redirect } from 'next/navigation'
import { entrar, usuarioActual } from '@/lib/auth'
import { BaseSinAndar } from '@/componentes/BaseSinAndar'
import { revisarBase } from '@/lib/revision'

export const dynamic = 'force-dynamic'

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams

  // Antes que nada: si la base no está lista, decirlo. Una excepción acá sale
  // como «Application error» y un digest, que no le sirve a nadie.
  const revision = await revisarBase()
  if (!revision.ok) return <BaseSinAndar revision={revision} />

  if (await usuarioActual()) redirect('/tablero')

  async function intentar(datos: FormData) {
    'use server'
    const email = String(datos.get('email') ?? '')
    const clave = String(datos.get('clave') ?? '')
    const usuario = await entrar(email, clave)
    if (!usuario) redirect('/login?error=1')
    redirect('/tablero')
  }

  return (
    <main className="entrada">
      <form action={intentar}>
        <div className="marca">Founders</div>
        <h1>Founders Brain</h1>
        <div className="campo">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </div>
        <div className="campo">
          <label htmlFor="clave">Contraseña</label>
          <input id="clave" name="clave" type="password" autoComplete="current-password" required />
        </div>
        {error ? <p className="error">Ese email y esa contraseña no coinciden.</p> : null}
        <button className="boton" type="submit">Entrar</button>
      </form>
    </main>
  )
}
