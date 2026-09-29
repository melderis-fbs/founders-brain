import Link from 'next/link'
import { quienMira } from '@/lib/quien-mira'
import { cuantasConTexto, encuestasDeLaCartera } from '@/lib/encuestas'
import { PatronesDeEncuestas } from '@/componentes/PatronesDeEncuestas'

export const dynamic = 'force-dynamic'

/**
 * Lo que dicen las encuestas de satisfacción, juntas.
 *
 * Cada encuesta suelta vive en la ficha de su cliente. Acá están todas, porque
 * lo que se repite entre ellas no se ve mirándolas de a una: una queja dicha por
 * una persona es un caso, y dicha por ocho es un problema nuestro.
 */
export default async function Encuestas() {
  const quien = await quienMira()
  const alcance = quien?.alcance ?? { todo: false as const, consultoraId: null }
  const encuestas = await encuestasDeLaCartera(alcance)
  const conTexto = cuantasConTexto(encuestas)
  const clientes = new Set(encuestas.map((e) => e.cliente_id)).size

  return (
    <>
      <header className="encabezado">
        <h1>Las encuestas</h1>
        <p className="bajada">
          {encuestas.length === 0
            ? 'Todavía no hay ninguna cargada. Se cargan como un documento más del cliente, eligiendo «Encuesta de satisfacción».'
            : `${encuestas.length} ${encuestas.length === 1 ? 'encuesta' : 'encuestas'} de ${clientes} ${clientes === 1 ? 'cliente' : 'clientes'}` +
              `${conTexto < encuestas.length ? ` · ${encuestas.length - conTexto} sin texto adentro` : ''}`}
        </p>
      </header>

      <PatronesDeEncuestas cuantas={conTexto} />

      {encuestas.length > 0 ? (
        <div className="tabla-marco" style={{ marginTop: 20 }}>
          <table>
            <thead>
              <tr><th>Cliente</th><th>Consultora</th><th>Encuesta</th><th>Fecha</th><th className="num">Largo</th></tr>
            </thead>
            <tbody>
              {encuestas.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link className="nombre-cliente" href={`/clientes/${e.cliente_id}?bloque=documentos`}>
                      {e.cliente}
                    </Link>
                  </td>
                  <td className={e.consultora ? undefined : 'apagado'}>{e.consultora ?? 'sin asignar'}</td>
                  <td className="mini">{e.titulo}</td>
                  <td className="mini">
                    {e.fecha ? e.fecha.split('-').reverse().join('/') : <span className="apagado">sin fecha</span>}
                  </td>
                  <td className="num mini">
                    {e.texto && e.texto.trim() !== ''
                      ? `${e.caracteres.toLocaleString('es-AR')}`
                      : <span className="falta">sin texto</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  )
}
