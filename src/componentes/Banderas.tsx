'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { levantarBandera, pasarDeCoach, resolverBandera } from '@/app/(app)/clientes/[id]/acciones'
import { COLORES, QUE_DICE, type Bandera, type ColorDeBandera } from '@/lib/banderas-tipos'
import type { CambioDeCoach } from '@/lib/usuarios'

/**
 * La bandera del cliente y por qué manos pasó.
 *
 * Todo lo demás que muestra la ficha se calcula. Esto no: lo sabe una persona
 * que estuvo en la sesión, y mientras no lo escriba, el cliente se ve en verde
 * porque los datos están al día.
 */
export function Banderas({
  clienteId, bandera, historial, cambios, consultoraActual, consultoras, esAdmin,
}: {
  clienteId: number
  bandera: Bandera | null
  historial: Bandera[]
  cambios: CambioDeCoach[]
  consultoraActual: string | null
  consultoras: { id: number; nombre: string }[]
  esAdmin: boolean
}) {
  const router = useRouter()
  const [poniendo, setPoniendo] = useState<ColorDeBandera | null>(null)
  const [motivo, setMotivo] = useState('')
  const [resolviendo, setResolviendo] = useState(false)
  const [como, setComo] = useState('')
  const [cambiando, setCambiando] = useState(false)
  const [aQuien, setAQuien] = useState('')
  const [porQue, setPorQue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [yendo, setYendo] = useState(false)

  const resueltas = historial.filter((b) => b.resuelta_en !== null)

  async function levantar() {
    if (!poniendo) return
    setYendo(true); setError(null)
    const r = await levantarBandera(clienteId, poniendo, motivo)
    setYendo(false)
    if (r.ok) { setPoniendo(null); setMotivo(''); router.refresh() } else setError(r.error ?? 'No se pudo.')
  }

  async function resolver() {
    setYendo(true); setError(null)
    const r = await resolverBandera(clienteId, como)
    setYendo(false)
    if (r.ok) { setResolviendo(false); setComo(''); router.refresh() } else setError(r.error ?? 'No se pudo.')
  }

  async function cambiarCoach() {
    setYendo(true); setError(null)
    const r = await pasarDeCoach(clienteId, aQuien === 'ninguna' ? null : Number(aQuien), porQue)
    setYendo(false)
    if (r.ok) { setCambiando(false); setPorQue(''); setAQuien(''); router.refresh() } else setError(r.error ?? 'No se pudo.')
  }

  return (
    <div className="banderas">
      {error ? <div className="error-campo" style={{ marginBottom: 12 }}>{error}</div> : null}

      <h3 style={{ marginTop: 0 }}>La bandera</h3>
      <p className="mini" style={{ marginTop: 0 }}>
        Para lo que sabe una persona y no sale de ningún dato. Nadie la levanta ni la baja por vos.
      </p>

      {bandera ? (
        <div className={`bandera-puesta ${bandera.color}`}>
          <div className="que">
            <span className="chip-bandera">{QUE_DICE[bandera.color]}</span>
            <p className="motivo">{bandera.motivo}</p>
            <p className="mini">
              La levantó {bandera.puesta_por_nombre ?? 'alguien'} el{' '}
              {bandera.puesta_en.slice(0, 10).split('-').reverse().join('/')}
            </p>
          </div>
          {resolviendo ? null : (
            <button type="button" className="boton" onClick={() => setResolviendo(true)}>Se resolvió</button>
          )}
        </div>
      ) : (
        <p style={{ margin: '12px 0 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORES.map((c) => (
            <button key={c} type="button" className={`boton suave bandera-${c}`} onClick={() => { setPoniendo(c); setError(null) }}>
              <i className="marca-bandera" /> {QUE_DICE[c]}
            </button>
          ))}
        </p>
      )}

      {poniendo ? (
        <div className="al-levantar">
          <label htmlFor="motivo-bandera">¿Por qué? — {QUE_DICE[poniendo]}</label>
          <textarea id="motivo-bandera" className="edicion" rows={3} value={motivo} autoFocus
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Lo que pasó, con las palabras del cliente si las tenés. Esto es lo que va a leer el que la mire dentro de dos semanas." />
          <p style={{ margin: '9px 0 0' }}>
            <button type="button" className="boton" onClick={() => void levantar()} disabled={yendo}>Levantar</button>{' '}
            <button type="button" className="boton suave" onClick={() => { setPoniendo(null); setError(null) }}>Cancelar</button>
          </p>
        </div>
      ) : null}

      {resolviendo ? (
        <div className="al-levantar">
          <label htmlFor="como-resolvio">¿Cómo se resolvió?</label>
          <textarea id="como-resolvio" className="edicion" rows={3} value={como} autoFocus
                    onChange={(e) => setComo(e.target.value)}
                    placeholder="Qué se hizo. Es lo que va a servir la próxima vez que pase algo parecido." />
          <p style={{ margin: '9px 0 0' }}>
            <button type="button" className="boton" onClick={() => void resolver()} disabled={yendo}>Bajarla</button>{' '}
            <button type="button" className="boton suave" onClick={() => { setResolviendo(false); setError(null) }}>Cancelar</button>
          </p>
        </div>
      ) : null}

      {resueltas.length > 0 ? (
        <details className="antes">
          <summary className="mini">{resueltas.length} {resueltas.length === 1 ? 'bandera anterior' : 'banderas anteriores'}</summary>
          {resueltas.map((b) => (
            <div className="una-antes" key={b.id}>
              <span className={`chip-bandera ${b.color}`}>{QUE_DICE[b.color]}</span>
              <p className="motivo">{b.motivo}</p>
              <p className="mini">
                Se resolvió el {b.resuelta_en!.slice(0, 10).split('-').reverse().join('/')}: {b.como_se_resolvio}
              </p>
            </div>
          ))}
        </details>
      ) : null}

      {/* El cambio de consultora lo decide y lo mira quien administra: para una
          consultora, de quién es cada cliente no es información suya. */}
      {esAdmin ? (
        <>
          <h3>La consultora</h3>
          <p className="mini" style={{ marginTop: 0 }}>
            Hoy es de <b>{consultoraActual ?? 'nadie'}</b>.
            {cambios.length > 0 ? ` Cambió ${cambios.length} ${cambios.length === 1 ? 'vez' : 'veces'}.` : ''}
          </p>

          {cambiando ? (
            <div className="al-levantar">
              <div className="campo" style={{ marginBottom: 9 }}>
                <label htmlFor="a-quien">¿A quién pasa?</label>
                <select id="a-quien" value={aQuien} onChange={(e) => setAQuien(e.target.value)}>
                  <option value="">Elegí una…</option>
                  {consultoras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  <option value="ninguna">— sin consultora —</option>
                </select>
              </div>
              <label htmlFor="por-que-cambia">¿Por qué cambia?</label>
              <textarea id="por-que-cambia" className="edicion" rows={2} value={porQue}
                        onChange={(e) => setPorQue(e.target.value)}
                        placeholder="Dentro de tres meses alguien va a preguntar por qué. Esta es la respuesta." />
              <p style={{ margin: '9px 0 0' }}>
                <button type="button" className="boton" onClick={() => void cambiarCoach()} disabled={yendo || aQuien === ''}>
                  Pasarlo
                </button>{' '}
                <button type="button" className="boton suave" onClick={() => { setCambiando(false); setError(null) }}>Cancelar</button>
              </p>
            </div>
          ) : (
            <p style={{ margin: '10px 0 0' }}>
              <button type="button" className="boton suave" onClick={() => setCambiando(true)}>Cambiar de consultora</button>
            </p>
          )}
        </>
      ) : null}

      {esAdmin && cambios.length > 0 ? (
        <div className="cambios">
          {cambios.map((c) => (
            <div className="un-cambio" key={c.id}>
              <span className="mini">{c.creado_en.slice(0, 10).split('-').reverse().join('/')}</span>
              <div>
                <b>{c.de ?? 'sin consultora'}</b> → <b>{c.a ?? 'sin consultora'}</b>
                <div className="mini">{c.motivo} · lo hizo {c.quien ?? 'alguien'}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
