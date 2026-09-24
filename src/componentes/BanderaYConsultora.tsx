'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { levantarBandera, pasarDeCoach, resolverBandera } from '@/app/(app)/clientes/[id]/acciones'
import { COLORES, CUANDO_SE_LEVANTA, QUE_DICE, type Bandera, type ColorDeBandera } from '@/lib/banderas-tipos'
import type { CambioDeCoach } from '@/lib/usuarios'

const SIN = 'sin'

/**
 * LA BANDERA, EN LA CABECERA
 *
 * Todo lo demás de la ficha se calcula. Esto no: lo sabe una persona que estuvo
 * en la sesión, y mientras no lo escriba, el cliente se ve bien porque los datos
 * están al día.
 *
 * Antes vivía en una pestaña, que es como decir que no existe: nadie entra a una
 * pestaña a ver si hay un problema. Acá está arriba, como un desplegable, al lado
 * del nombre.
 *
 * Bajarla y levantarla siguen pidiendo que se escriba por qué. Un color solo no
 * le dice nada al que la mire dentro de dos semanas.
 */
export function BanderaYConsultora({
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
  const [eligiendo, setEligiendo] = useState<ColorDeBandera | null>(null)
  const [bajando, setBajando] = useState(false)
  const [texto, setTexto] = useState('')
  const [cambiando, setCambiando] = useState(false)
  const [aQuien, setAQuien] = useState('')
  const [porQue, setPorQue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [yendo, setYendo] = useState(false)

  const resueltas = historial.filter((b) => b.resuelta_en !== null)

  function elegir(valor: string) {
    setError(null)
    setTexto('')
    if (valor === SIN) {
      // Sacarla exige decir cómo se resolvió; poner ninguna donde no había
      // ninguna no es nada.
      setEligiendo(null)
      setBajando(bandera !== null)
      return
    }
    setBajando(false)
    setEligiendo(valor as ColorDeBandera)
  }

  async function guardar() {
    setYendo(true); setError(null)
    const r = bajando
      ? await resolverBandera(clienteId, texto)
      : await levantarBandera(clienteId, eligiendo!, texto)
    setYendo(false)
    if (r.ok) { cerrar(); router.refresh() } else setError(r.error ?? 'No se pudo.')
  }

  function cerrar() {
    setEligiendo(null); setBajando(false); setTexto(''); setError(null)
  }

  async function cambiarCoach() {
    setYendo(true); setError(null)
    const r = await pasarDeCoach(clienteId, aQuien === 'ninguna' ? null : Number(aQuien), porQue)
    setYendo(false)
    if (r.ok) { setCambiando(false); setPorQue(''); setAQuien(''); router.refresh() } else setError(r.error ?? 'No se pudo.')
  }

  const abierto = eligiendo !== null || bajando

  return (
    <div className="bandera-arriba">
      <div className="fila">
        <label className="rotulo" htmlFor="bandera">Bandera</label>
        <select id="bandera" className={`selector-bandera ${bandera?.color ?? ''}`}
                value={abierto ? (eligiendo ?? SIN) : (bandera?.color ?? SIN)}
                onChange={(e) => elegir(e.target.value)}>
          <option value={SIN}>sin bandera</option>
          {COLORES.map((c) => <option key={c} value={c}>{QUE_DICE[c]}</option>)}
        </select>

        {bandera && !abierto ? <span className="motivo-corto">{bandera.motivo}</span> : null}

        {esAdmin && !cambiando ? (
          <button type="button" className="como-enlace" onClick={() => setCambiando(true)}>
            cambiar de consultora
          </button>
        ) : null}
      </div>

      {error ? <div className="error-campo">{error}</div> : null}

      {abierto ? (
        <div className="al-levantar">
          <label htmlFor="motivo-bandera">
            {bajando
              ? '¿Cómo se resolvió? Es lo que va a servir la próxima vez que pase algo parecido.'
              : `${QUE_DICE[eligiendo!]} — ${CUANDO_SE_LEVANTA[eligiendo!]}. ¿Por qué?`}
          </label>
          <textarea id="motivo-bandera" className="edicion" rows={3} value={texto} autoFocus
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder={bajando
                      ? 'Qué se hizo.'
                      : 'Lo que pasó, con las palabras del cliente si las tenés. Esto es lo que va a leer el que la mire dentro de dos semanas.'} />
          <p style={{ margin: '9px 0 0' }}>
            <button type="button" className="boton" onClick={() => void guardar()} disabled={yendo}>
              {bajando ? 'Bajarla' : 'Levantarla'}
            </button>{' '}
            <button type="button" className="boton suave" onClick={cerrar}>Cancelar</button>
          </p>
        </div>
      ) : null}

      {cambiando ? (
        <div className="al-levantar">
          <div className="campo" style={{ marginBottom: 9 }}>
            <label htmlFor="a-quien">Hoy es de <b>{consultoraActual ?? 'nadie'}</b>. ¿A quién pasa?</label>
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
      ) : null}

      {resueltas.length > 0 || (esAdmin && cambios.length > 0) ? (
        <details className="antes">
          <summary className="mini">
            {[
              resueltas.length > 0 ? `${resueltas.length} ${resueltas.length === 1 ? 'bandera anterior' : 'banderas anteriores'}` : null,
              esAdmin && cambios.length > 0 ? `${cambios.length} ${cambios.length === 1 ? 'cambio de consultora' : 'cambios de consultora'}` : null,
            ].filter(Boolean).join(' · ')}
          </summary>

          {resueltas.map((b) => (
            <div className="una-antes" key={b.id}>
              <span className={`chip-bandera ${b.color}`}>{QUE_DICE[b.color]}</span>
              <p className="motivo">{b.motivo}</p>
              <p className="mini">
                Se resolvió el {b.resuelta_en!.slice(0, 10).split('-').reverse().join('/')}: {b.como_se_resolvio}
              </p>
            </div>
          ))}

          {/* De quién es cada cliente no es información de una consultora. */}
          {esAdmin ? cambios.map((c) => (
            <div className="un-cambio" key={c.id}>
              <span className="mini">{c.creado_en.slice(0, 10).split('-').reverse().join('/')}</span>
              <div>
                <b>{c.de ?? 'sin consultora'}</b> → <b>{c.a ?? 'sin consultora'}</b>
                <div className="mini">{c.motivo} · lo hizo {c.quien ?? 'alguien'}</div>
              </div>
            </div>
          )) : null}
        </details>
      ) : null}
    </div>
  )
}
