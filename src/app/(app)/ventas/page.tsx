import { quienMira } from '@/lib/quien-mira'
import { comoVieneElMes, ventasDeLaCartera } from '@/lib/meses'
import { comoSeLlamaElMes } from '@/lib/meses-tipos'

export const dynamic = 'force-dynamic'

const plata = (n: number | null) => (n === null ? '—' : n.toLocaleString('es-AR', { maximumFractionDigits: 0 }))

/**
 * LAS VENTAS DE LA CARTERA
 *
 * Lo mismo que la ficha muestra de un cliente, sumado. Contesta lo que un
 * cliente solo no puede: si el mes que viene va a ser mejor que éste, y de qué
 * consultoras sale lo que se factura.
 *
 * Arriba de todo va cuántos clientes tienen datos cargados, y no es un detalle:
 * «facturamos ocho millones» significa una cosa si son 194 clientes y otra si
 * son 12. Sin ese número, el total miente sin querer.
 */
export default async function Ventas() {
  const quien = await quienMira()
  const alcance = quien?.alcance ?? { todo: false as const, consultoraId: null }
  const { meses, porConsultora, conDatos, total } = await ventasDeLaCartera(alcance)
  const crecimiento = comoVieneElMes(meses)

  const totalFacturado = meses.reduce((a, m) => a + (m.facturacion ?? 0), 0)
  const totalVentas = meses.reduce((a, m) => a + (m.ventas ?? 0), 0)
  const mejor = [...meses].sort((a, b) => (b.facturacion ?? 0) - (a.facturacion ?? 0))[0]

  return (
    <>
      <header className="encabezado">
        <h1>Las ventas</h1>
        <p className="bajada">
          {conDatos === 0
            ? 'Todavía no hay ningún mes cargado. Se cargan en la pestaña «Mes a mes» de cada cliente.'
            : `${conDatos} de ${total} clientes tienen meses cargados. Lo que está abajo es de ellos, no de toda la cartera.`}
        </p>
      </header>

      {conDatos === 0 ? null : (
        <>
          <div className="rejilla">
            <div className="tarjeta">
              <span className="rotulo">Facturado</span>
              <div className="cifra">{plata(totalFacturado)}</div>
              <div className="pie">en {meses.length} {meses.length === 1 ? 'mes' : 'meses'} cargados</div>
            </div>
            <div className="tarjeta">
              <span className="rotulo">Ventas</span>
              <div className="cifra">{totalVentas || '—'}</div>
              <div className="pie">
                {totalVentas > 0 ? `ticket real: ${plata(Math.round(totalFacturado / totalVentas))}` : 'sin ventas cargadas'}
              </div>
            </div>
            <div className="tarjeta">
              <span className="rotulo">El último mes</span>
              <div className={`cifra ${crecimiento ? (crecimiento.cuanto >= 0 ? 'verde' : 'rojo') : ''}`}>
                {crecimiento ? `${crecimiento.cuanto >= 0 ? '+' : ''}${crecimiento.cuanto}%` : '—'}
              </div>
              <div className="pie">
                {crecimiento
                  ? `de ${plata(crecimiento.desde)} a ${plata(crecimiento.hasta)}`
                  : 'hacen falta dos meses cargados para comparar'}
              </div>
            </div>
            <div className="tarjeta">
              <span className="rotulo">Mejor mes</span>
              <div className="cifra">{mejor ? plata(mejor.facturacion) : '—'}</div>
              <div className="pie">{mejor ? comoSeLlamaElMes(mejor.anio, mejor.mes) : ''}</div>
            </div>
          </div>

          <section className="tarjeta" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0 }}>Mes a mes</h2>
            <div className="barras-mes">
              {meses.map((m) => {
                const alto = mejor?.facturacion ? Math.round(((m.facturacion ?? 0) / mejor.facturacion) * 100) : 0
                return (
                  <div className="una-barra" key={`${m.anio}-${m.mes}`}
                       title={`${comoSeLlamaElMes(m.anio, m.mes)}: ${plata(m.facturacion)} · ${m.ventas ?? 0} ventas · ${m.clientes} clientes`}>
                    <div className="tronco"><span style={{ height: `${Math.max(alto, 2)}%` }} /></div>
                    <div className="mini">{comoSeLlamaElMes(m.anio, m.mes).split(' ')[0]!.slice(0, 3)}</div>
                  </div>
                )
              })}
            </div>

            <div className="tabla-marco" style={{ marginTop: 14 }}>
              <table>
                <thead>
                  <tr><th>Mes</th><th className="num">Clientes</th><th className="num">Ventas</th><th className="num">Facturado</th></tr>
                </thead>
                <tbody>
                  {meses.map((m) => (
                    <tr key={`${m.anio}-${m.mes}`}>
                      <td>{comoSeLlamaElMes(m.anio, m.mes)}</td>
                      <td className="num">{m.clientes}</td>
                      <td className="num">{m.ventas ?? <span className="apagado">—</span>}</td>
                      <td className="num">{plata(m.facturacion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="tarjeta">
            <h2 style={{ marginTop: 0 }}>De dónde sale</h2>
            <p className="mini" style={{ marginTop: 0 }}>
              Por consultora. No es un ranking: una consultora con clientes nuevos factura menos que
              una con clientes que ya vendían, y eso no dice nada de ninguna de las dos.
            </p>
            <div className="tabla-marco">
              <table>
                <thead>
                  <tr><th>Consultora</th><th className="num">Clientes</th><th className="num">Ventas</th><th className="num">Facturado</th></tr>
                </thead>
                <tbody>
                  {porConsultora.map((c) => (
                    <tr key={c.consultora ?? 'sin'}>
                      <td className={c.consultora ? undefined : 'apagado'}>{c.consultora ?? 'sin consultora'}</td>
                      <td className="num">{c.clientes}</td>
                      <td className="num">{c.ventas ?? <span className="apagado">—</span>}</td>
                      <td className="num">{plata(c.facturacion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}
