import { redirect } from 'next/navigation'
import { Equipo } from '@/componentes/Equipo'
import { quienMira } from '@/lib/quien-mira'
import { Consultoras } from '@/componentes/Consultoras'
import { consultorasParaElegir, listarConsultorasDelEquipo, listarEquipo } from '@/lib/usuarios'

export const dynamic = 'force-dynamic'

export default async function PaginaEquipo() {
  const quien = await quienMira()
  if (!quien) redirect('/login')
  // Esconder el link no alcanza: alguien puede escribir /equipo en la barra.
  if (quien.usuario.rol !== 'admin') redirect('/clientes')

  const [usuarios, consultoras, paraElegir] = await Promise.all([
    listarEquipo(), listarConsultorasDelEquipo(), consultorasParaElegir(),
  ])

  return (
    <>
      <header className="encabezado">
        <h1>El equipo</h1>
        <p className="bajada">
          Quién entra y qué ve cada uno. Una consultora ve sus clientes; sin consultora asignada se
          ve toda la cartera.
        </p>
      </header>

      <Equipo usuarios={usuarios} consultoras={paraElegir} yo={quien.usuario.id} />

      <Consultoras consultoras={consultoras} />
    </>
  )
}
