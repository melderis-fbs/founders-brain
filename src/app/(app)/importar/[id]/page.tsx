import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fila, filas } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Importacion = {
  id: number; archivo: string; creado_en: string; filas_leidas: number
  clientes_nuevos: number; clientes_actualizados: number; filas_sin_cambios: number
  filas_omitidas: number; columnas_ignoradas: string[] | null; error_general: string | null
}

type FilaGuardada = {
  nro_fila: number; cliente_nombre: string | null; cliente_id: number | null
  resultado: string; motivo: string | null; avisos: string[] | null
}

export default async function Reporte({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const imp = await fila<Importacion>(
    `select id, archivo, creado_en, filas_leidas, clientes_nuevos, clientes_actualizados,
            filas_sin_cambios, filas_omitidas, columnas_ignoradas, error_general
       from importaciones where id = $1`,
    [Number(id)],
  )
  if (!imp) notFound()

  const todas = await filas<FilaGuardada>(
    `select nro_fila, cliente_nombre, cliente_id, resultado, motivo, avisos
       from importacion_filas where importacion_id = $1 order by nro_fila`,
    [imp.id],
  )

  const noEntraron = todas.filter((f) => f.resultado === 'omitida')
  const conAvisos = todas.filter((f) => f.resultado !== 'omitida' && (f.avisos?.length ?? 0) > 0)

  return (
    <>
      <p className="mini"><Link href="/importar">← Importar</Link></p>
      <div className="titulo-fila">
        <h1>{imp.archivo}</h1>
        <span className="cuenta">{new Date(imp.creado_en).toLocaleString('es-AR')}</span>
      </div>

      {imp.error_general ? (
        <div className="aviso">
          <b>No se aplicó nada.</b> {imp.error_general}
        </div>
      ) : (
        <>
          <div className="resumen">
            <div className={`caja ${imp.filas_omitidas > 0 ? 'mal' : ''}`}>
              <div className="n">{imp.filas_omitidas}</div>
              <div className="q">no entraron</div>
            </div>
            <div className="caja"><div className="n">{imp.clientes_nuevos}</div><div className="q">clientes nuevos</div></div>
            <div className="caja"><div className="n">{imp.clientes_actualizados}</div><div className="q">actualizados</div></div>
            <div className="caja"><div className="n">{imp.filas_sin_cambios}</div><div className="q">sin cambios</div></div>
            <div className="caja"><div className="n">{imp.filas_leidas}</div><div className="q">filas leídas</div></div>
          </div>

          <h2>Lo que no entró</h2>
          {noEntraron.length === 0 ? (
            <div className="aviso ok">Entraron todas las filas del archivo.</div>
          ) : (
            <div className="tabla-marco" style={{ marginBottom: 20 }}>
              <table>
                <thead>
                  <tr><th style={{ width: 80 }}>Fila</th><th style={{ width: 220 }}>Cliente</th><th>Por qué no entró</th></tr>
                </thead>
                <tbody>
                  {noEntraron.map((f) => (
                    <tr key={f.nro_fila}>
                      <td className="num">{f.nro_fila}</td>
                      <td>{f.cliente_nombre ?? <span className="apagado">sin nombre</span>}</td>
                      <td className="falta">{f.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {conAvisos.length > 0 ? (
            <>
              <h2>Entraron, pero con algún dato afuera</h2>
              <div className="tabla-marco" style={{ marginBottom: 20 }}>
                <table>
                  <thead>
                    <tr><th style={{ width: 80 }}>Fila</th><th style={{ width: 220 }}>Cliente</th><th>Qué quedó afuera</th></tr>
                  </thead>
                  <tbody>
                    {conAvisos.map((f) => (
                      <tr key={f.nro_fila}>
                        <td className="num">{f.nro_fila}</td>
                        <td>
                          {f.cliente_id
                            ? <Link className="nombre-cliente" href={`/clientes/${f.cliente_id}`}>{f.cliente_nombre}</Link>
                            : f.cliente_nombre}
                        </td>
                        <td>{(f.avisos ?? []).map((a, n) => <div key={n}>{a}</div>)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {(imp.columnas_ignoradas?.length ?? 0) > 0 ? (
            <div className="aviso">
              Columnas del archivo que la aplicación no reconoce y no cargó:{' '}
              <b>{imp.columnas_ignoradas!.join(', ')}</b>.
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
