import Link from 'next/link'
import { filas } from '@/lib/db'
import { columnasQueSeEntienden } from '@/lib/importar/plantilla'

export const dynamic = 'force-dynamic'

export default async function Importar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const anteriores = await filas<{
    id: number; archivo: string; creado_en: string; filas_leidas: number
    clientes_nuevos: number; clientes_actualizados: number; filas_omitidas: number; error_general: string | null
  }>(
    `select id, archivo, creado_en, filas_leidas, clientes_nuevos, clientes_actualizados, filas_omitidas, error_general
       from importaciones order by creado_en desc limit 20`,
  )

  const columnas = columnasQueSeEntienden()

  return (
    <>
      <div className="titulo-fila">
        <h1>Importar la planilla madre</h1>
      </div>

      {error ? <div className="aviso">{decodeURIComponent(error)}</div> : null}

      <div className="bloques">
        <section className="tarjeta">
          <h2>Subir el CSV</h2>
          {/* El archivo va por un endpoint del servidor, no por una acción de
              servidor: una acción tiene tope de 1 MB y la planilla entera no entra. */}
          <form action="/api/importar" method="post" encType="multipart/form-data">
            <div className="campo" style={{ marginBottom: 14 }}>
              <label htmlFor="archivo">Archivo</label>
              <input id="archivo" name="archivo" type="file" accept=".csv,text/csv,text/plain" required />
            </div>
            <button className="boton" type="submit">Importar</button>
          </form>

          <h2 style={{ marginTop: 24 }}>Bajar la planilla</h2>
          <p>
            <a className="boton suave" href="/api/plantilla">Vacía, con un ejemplo</a>{' '}
            <a className="boton suave" href="/api/cartera">Con la cartera de hoy</a>
          </p>
          <p className="mini" style={{ marginBottom: 0 }}>
            Las columnas de la planilla salen de los campos de la aplicación. Bajala, corregila
            en la planilla y volvé a subirla: como la fila se identifica por el id del cliente,
            corrige en vez de duplicar.
          </p>
        </section>

        <section className="tarjeta">
          <h2>Las columnas</h2>
          <dl>
            {columnas.map((c) => (
              <div className="dato" key={c.clave}>
                <dt><code className="columna">{c.clave}</code></dt>
                <dd>
                  {c.etiqueta}
                  {c.sinonimos.length > 0 ? (
                    <div className="mini">también entra como {c.sinonimos.slice(0, 4).join(' · ')}</div>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <h2 style={{ marginTop: 26 }}>Importaciones anteriores</h2>
      {anteriores.length === 0 ? (
        <div className="tarjeta"><p className="apagado" style={{ margin: 0 }}>Todavía no se importó nada.</p></div>
      ) : (
        <div className="tabla-marco">
          <table>
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Archivo</th>
                <th className="num">Leídas</th>
                <th className="num">Nuevos</th>
                <th className="num">Actualizados</th>
                <th className="num">No entraron</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {anteriores.map((i) => (
                <tr key={i.id}>
                  <td>{new Date(i.creado_en).toLocaleString('es-AR')}</td>
                  <td>{i.archivo}</td>
                  <td className="num">{i.error_general ? '—' : i.filas_leidas}</td>
                  <td className="num">{i.error_general ? '—' : i.clientes_nuevos}</td>
                  <td className="num">{i.error_general ? '—' : i.clientes_actualizados}</td>
                  <td className="num">
                    {i.error_general
                      ? <span className="falta">no se aplicó nada</span>
                      : i.filas_omitidas > 0 ? <span className="falta">{i.filas_omitidas}</span> : 0}
                  </td>
                  <td><Link href={`/importar/${i.id}`}>ver el reporte</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
