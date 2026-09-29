'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { borrarUnMes, guardarUnMes } from '@/app/(app)/clientes/[id]/acciones'
import { comoSeLlamaElMes, NOMBRE_DEL_MES, type MesDelCliente, type Totales } from '@/lib/meses-tipos'

function plata(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

/**
 * LOS NÚMEROS DEL CLIENTE, MES POR MES
 *
 * «Facturación de hoy» es un número que se pisa a sí mismo: dice cuánto factura
 * y nada sobre si viene creciendo, que es la única pregunta que importa en un
 * programa de cuatro meses. Acá cada mes queda, y los totales se suman solos.
 *
 * Un mes sin número no vale cero: vale nada. Por eso los totales pueden decir
 * «—» en vez de «$0», y el promedio de ticket se saca sobre los meses que lo
 * tienen cargado.
 */
export function MesAMes({
  clienteId, meses, totales, moneda,
}: {
  clienteId: number
  meses: MesDelCliente[]
  totales: Totales
  moneda: string | null
}) {
  const router = useRouter()
  const hoy = new Date()
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<number | null>(null)
  const [yendo, setYendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(datos: FormData) {
    setYendo(true); setError(null)
    const r = await guardarUnMes(clienteId, {
      anio: Number(datos.get('anio')), mes: Number(datos.get('mes')),
      ventas: String(datos.get('ventas') ?? ''),
      ticket: String(datos.get('ticket') ?? ''),
      facturacion: String(datos.get('facturacion') ?? ''),
      nota: String(datos.get('nota') ?? ''),
    })
    setYendo(false)
    if (r.ok) { setAbierto(false); setEditando(null); router.refresh() }
    else setError(r.error ?? 'No se pudo guardar.')
  }

  async function borrar(id: number) {
    setYendo(true); setError(null)
    const r = await borrarUnMes(clienteId, id)
    setYendo(false)
    if (r.ok) router.refresh()
    else setError(r.error ?? 'No se pudo borrar.')
  }

  const formulario = (m: MesDelCliente | null) => (
    <form action={guardar} className="al-corregir">
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="campo">
          <label htmlFor="mes">Mes</label>
          <select id="mes" name="mes" defaultValue={m?.mes ?? hoy.getMonth() + 1}>
            {NOMBRE_DEL_MES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="anio">Año</label>
          <input id="anio" name="anio" type="number" min={2020} max={2100}
                 defaultValue={m?.anio ?? hoy.getFullYear()} style={{ width: 90 }} />
        </div>
        <div className="campo">
          <label htmlFor="ventas">Ventas</label>
          <input id="ventas" name="ventas" type="text" defaultValue={m?.ventas ?? ''} style={{ width: 80 }} />
        </div>
        <div className="campo">
          <label htmlFor="ticket">Ticket</label>
          <input id="ticket" name="ticket" type="text" defaultValue={m?.ticket ?? ''} style={{ width: 120 }} />
        </div>
        <div className="campo">
          <label htmlFor="facturacion">Facturación</label>
          <input id="facturacion" name="facturacion" type="text" defaultValue={m?.facturacion ?? ''} style={{ width: 130 }} />
        </div>
        <div className="campo" style={{ flex: 1, minWidth: 150 }}>
          <label htmlFor="nota">Nota</label>
          <input id="nota" name="nota" type="text" defaultValue={m?.nota ?? ''} placeholder="opcional" />
        </div>
        <button className="boton" type="submit" disabled={yendo}>Guardar</button>
        <button type="button" className="boton suave" onClick={() => { setAbierto(false); setEditando(null) }}>
          Cancelar
        </button>
      </div>
      <p className="mini" style={{ margin: '7px 0 0' }}>
        Lo que dejes vacío queda vacío, no en cero. Cargar el mismo mes otra vez lo corrige, no lo duplica.
      </p>
    </form>
  )

  return (
    <div className="mes-a-mes">
      <h2 style={{ marginTop: 0 }}>Mes a mes</h2>
      <p className="mini" style={{ marginTop: 0 }}>
        Lo que vendió y facturó cada mes. Es lo que permite ver si viene creciendo, que un
        solo número de «facturación de hoy» no puede decir.
      </p>

      {error ? <div className="error-campo" style={{ marginBottom: 10 }}>{error}</div> : null}

      {meses.length === 0 ? (
        <p className="apagado" style={{ margin: '0 0 12px' }}>Todavía no se cargó ningún mes.</p>
      ) : (
        <>
          <div className="rejilla">
            <div className="tarjeta">
              <span className="rotulo">Facturado en total</span>
              <div className="cifra">{plata(totales.facturacion)}<span className="de"> {moneda ?? ''}</span></div>
              <div className="pie">{totales.meses} {totales.meses === 1 ? 'mes cargado' : 'meses cargados'}</div>
            </div>
            <div className="tarjeta">
              <span className="rotulo">Ventas en total</span>
              <div className="cifra">{totales.ventas ?? '—'}</div>
              <div className="pie">
                {totales.ticketReal !== null ? `ticket real: ${plata(totales.ticketReal)}` : 'sin ventas cargadas'}
              </div>
            </div>
            <div className="tarjeta">
              <span className="rotulo">Mejor mes</span>
              <div className="cifra chico">{totales.mejor ? plata(totales.mejor.facturacion) : '—'}</div>
              <div className="pie">
                {totales.mejor ? comoSeLlamaElMes(totales.mejor.anio, totales.mejor.mes) : 'sin facturación cargada'}
                {totales.peor ? ` · el peor fue ${comoSeLlamaElMes(totales.peor.anio, totales.peor.mes)}` : ''}
              </div>
            </div>
          </div>

          <div className="tabla-marco" style={{ marginBottom: 12 }}>
            <table>
              <thead>
                <tr><th>Mes</th><th>Ventas</th><th>Ticket</th><th>Facturación</th><th>Nota</th><th /></tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  editando === m.id ? (
                    <tr key={m.id}><td colSpan={6}>{formulario(m)}</td></tr>
                  ) : (
                    <tr key={m.id}>
                      <td>{comoSeLlamaElMes(m.anio, m.mes)}</td>
                      <td className="num">{m.ventas ?? <span className="apagado">—</span>}</td>
                      <td className="num">{m.ticket === null ? <span className="apagado">—</span> : plata(m.ticket)}</td>
                      <td className="num">{m.facturacion === null ? <span className="apagado">—</span> : plata(m.facturacion)}</td>
                      <td className="mini">{m.nota ?? ''}</td>
                      <td className="mini">
                        <button type="button" className="como-enlace"
                                onClick={() => { setEditando(m.id); setAbierto(false) }}>corregir</button>
                        {' · '}
                        <button type="button" className="como-enlace" disabled={yendo}
                                onClick={() => void borrar(m.id)}>borrar</button>
                      </td>
                    </tr>
                  )
                ))}
                <tr className="totales">
                  <td><b>Total</b></td>
                  <td className="num"><b>{totales.ventas ?? '—'}</b></td>
                  <td className="num">
                    {totales.ticketPromedio === null ? '—' : <>{plata(totales.ticketPromedio)} <i className="mini">prom.</i></>}
                  </td>
                  <td className="num"><b>{plata(totales.facturacion)}</b></td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {abierto ? formulario(null) : (
        <button type="button" className="boton" onClick={() => { setAbierto(true); setEditando(null) }}>
          Cargar un mes
        </button>
      )}
    </div>
  )
}
