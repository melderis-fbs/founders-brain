'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { anotarEnLaAlerta, descartarAlerta, prenderAlerta } from '@/app/(app)/clientes/[id]/acciones'
import {
  COLOR_DE, DE_DONDE_SE_DICE, NOMBRE_DE_QUE, QUE_ES, esQueja,
  type TemperaturaGuardada,
} from '@/lib/temperatura-tipos'

/**
 * LA ALERTA: lo que el cliente dijo de nosotros.
 *
 * Todo lo demás de esta ficha sale de restar fechas. Esto sale de una frase, y
 * por eso la frase se muestra siempre: una consultora no va a llamar a un
 * cliente porque una pantalla se puso roja, va a llamarlo porque leyó lo que
 * dijo. Sin la cita, la alerta o se obedece a ciegas o se ignora.
 *
 * El modelo propone y ella decide: puede descartarla —diciendo por qué— y puede
 * agregar lo suyo, que es lo que el modelo no puede saber porque no estuvo en
 * la sesión. Eso que escribe no lo pisa ningún análisis posterior.
 */

const ENCUESTA_SIN_LEER = 'sin_leer'

export function Temperatura({
  clienteId, alertas, encuestasSinLeer,
}: {
  clienteId: number
  alertas: TemperaturaGuardada[]
  encuestasSinLeer: { id: number; titulo: string }[]
}) {
  const router = useRouter()
  const [leyendo, setLeyendo] = useState<number | null>(null)
  const [salida, setSalida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verDescartadas, setVerDescartadas] = useState(false)

  const prendidas = alertas.filter((a) => a.descartada_en === null && a.temperatura !== 'bien')
  const descartadas = alertas.filter((a) => a.descartada_en !== null)
  const leidasSinNada = alertas.filter((a) => a.descartada_en === null && a.temperatura === 'bien')

  async function leerEncuesta(documentoId: number) {
    setLeyendo(documentoId); setSalida(''); setError(null)
    try {
      const r = await fetch('/api/temperatura', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clienteId, documentoId }),
      })
      if (!r.ok || !r.body) { setError(await r.text()); setLeyendo(null); return }
      const lector = r.body.getReader()
      const decodificador = new TextDecoder()
      let todo = ''
      for (;;) {
        const { done, value } = await lector.read()
        if (done) break
        todo += decodificador.decode(value, { stream: true })
        setSalida(todo)
      }
      router.refresh()
    } catch {
      setError('Se cortó la conexión. Volvé a probar.')
    } finally {
      setLeyendo(null)
    }
  }

  const hayAlgo = prendidas.length > 0 || encuestasSinLeer.length > 0 || descartadas.length > 0 || leidasSinNada.length > 0
  if (!hayAlgo) return null

  return (
    <div className="tarjeta" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Lo que dijo de nosotros</h2>
      <p className="mini apagado" style={{ marginTop: 0 }}>
        Sale de las sesiones analizadas y de las encuestas. Estar frustrado con su negocio
        no cuenta: acá va sólo lo que dijo de nosotros, y siempre con la frase.
      </p>

      {prendidas.length === 0 ? (
        <p className="mini" style={{ marginBottom: 0 }}>
          {leidasSinNada.length > 0
            ? `Se leyeron ${leidasSinNada.length} ${leidasSinNada.length === 1 ? 'sesión o encuesta' : 'sesiones y encuestas'} y no dijo nada en contra nuestro.`
            : descartadas.length > 0
              ? 'Lo que se había detectado se descartó.'
              : 'Todavía no se leyó nada suyo.'}
        </p>
      ) : (
        <ul className="las-alertas">
          {prendidas.map((a) => (
            <Alerta key={a.id} clienteId={clienteId} alerta={a} />
          ))}
        </ul>
      )}

      {encuestasSinLeer.length > 0 ? (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--borde)', paddingTop: 12 }}>
          <p className="mini" style={{ margin: '0 0 8px' }}>
            {encuestasSinLeer.length === 1
              ? 'Hay una encuesta cargada que nadie leyó todavía:'
              : `Hay ${encuestasSinLeer.length} encuestas cargadas que nadie leyó todavía:`}
          </p>
          {encuestasSinLeer.map((e) => (
            <p key={e.id} style={{ margin: '0 0 6px' }}>
              <button
                type="button" className="boton" data-tipo={ENCUESTA_SIN_LEER}
                onClick={() => void leerEncuesta(e.id)} disabled={leyendo !== null}
              >
                {leyendo === e.id ? 'Leyendo…' : `Leer «${e.titulo}»`}
              </button>
            </p>
          ))}
          <p className="mini apagado" style={{ margin: 0 }}>Cuesta plata: corre sólo cuando apretás el botón.</p>
        </div>
      ) : null}

      {salida ? (
        <div className="bloque-analisis" style={{ marginTop: 12 }}>
          <pre>{salida.replace(/^#{1,3}\s+/gm, '')}</pre>
        </div>
      ) : null}
      {error ? <div className="error-campo" style={{ marginTop: 10 }}>{error}</div> : null}

      {descartadas.length > 0 ? (
        <p className="mini" style={{ margin: '12px 0 0' }}>
          <button type="button" className="como-enlace" onClick={() => setVerDescartadas(!verDescartadas)}>
            {verDescartadas ? 'Ocultar' : `Ver ${descartadas.length} ${descartadas.length === 1 ? 'descartada' : 'descartadas'}`}
          </button>
        </p>
      ) : null}

      {verDescartadas ? (
        <ul className="las-alertas apagado" style={{ marginTop: 8 }}>
          {descartadas.map((a) => (
            <li key={a.id}>
              <p className="mini" style={{ margin: 0 }}>
                <b>{a.temperatura}</b> en {DE_DONDE_SE_DICE[a.de]}
                {a.origen ? ` · ${a.origen}` : ''} — la descartó {a.descartada_por_nombre ?? 'alguien'}:
                «{a.por_que_se_descarto}»
              </p>
              <button type="button" className="como-enlace" onClick={() => void prenderAlerta(clienteId, a.id).then(() => router.refresh())}>
                volver a prenderla
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function Alerta({ clienteId, alerta }: { clienteId: number; alerta: TemperaturaGuardada }) {
  const router = useRouter()
  const [porQue, setPorQue] = useState('')
  const [descartando, setDescartando] = useState(false)
  const [nota, setNota] = useState(alerta.nota ?? '')
  const [yendo, setYendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const color = COLOR_DE[alerta.temperatura]
  const grave = esQueja(alerta.temperatura)

  async function descartar() {
    setYendo(true); setError(null)
    const r = await descartarAlerta(clienteId, alerta.id, porQue)
    setYendo(false)
    if (r.ok) { setDescartando(false); setPorQue(''); router.refresh() } else setError(r.error ?? 'No se pudo.')
  }

  async function guardarNota() {
    setYendo(true); setError(null)
    const r = await anotarEnLaAlerta(clienteId, alerta.id, nota)
    setYendo(false)
    if (r.ok) router.refresh(); else setError(r.error ?? 'No se pudo.')
  }

  return (
    <li className={`alerta ${color}`}>
      <p className="cabeza">
        <span className={`chip ${grave ? 'mal' : 'ojo'}`}>{alerta.temperatura}</span>
        <span className="mini">
          {QUE_ES[alerta.temperatura]} · en {DE_DONDE_SE_DICE[alerta.de]}
          {alerta.origen ? ` (${alerta.origen})` : ''}
          {alerta.de_que ? ` · por ${NOMBRE_DE_QUE[alerta.de_que]}` : ''}
        </span>
      </p>
      {/* Tibio no es grave: es un yellow flag. Se dice en la pantalla para que
          nadie lo lea como una urgencia. */}
      <p className="mini apagado" style={{ margin: '2px 0 6px' }}>
        {grave ? 'Cuenta como grave en el semáforo.' : 'Yellow flag: se mira, no es grave.'}
      </p>

      {alerta.porque ? <p className="texto">{alerta.porque}</p> : null}

      {alerta.citas.length > 0 ? (
        <ul className="citas">
          {alerta.citas.map((c, i) => <li key={i}>«{c}»</li>)}
        </ul>
      ) : null}

      {alerta.lo_otro ? (
        <p className="mini apagado">No es queja, pero conviene saberlo: {alerta.lo_otro}</p>
      ) : null}
      {alerta.que_preguntar ? (
        <p className="mini">Para la próxima: {alerta.que_preguntar}</p>
      ) : null}

      <div style={{ marginTop: 8 }}>
        <textarea
          className="edicion" rows={2} value={nota} onChange={(e) => setNota(e.target.value)}
          placeholder="Lo que sabés vos y no está en la transcripción…"
        />
        <p style={{ margin: '6px 0 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button" className="boton" disabled={yendo || nota.trim() === '' || nota === (alerta.nota ?? '')}
            onClick={() => void guardarNota()}
          >
            Guardar lo mío
          </button>
          {descartando ? null : (
            <button type="button" className="boton suave" onClick={() => setDescartando(true)} disabled={yendo}>
              No era una queja
            </button>
          )}
        </p>
        {alerta.nota_en ? (
          <p className="mini apagado" style={{ margin: '4px 0 0' }}>
            Lo escribió {alerta.nota_por_nombre ?? 'alguien'} el {alerta.nota_en.slice(0, 10).split('-').reverse().join('/')}.
          </p>
        ) : null}
      </div>

      {descartando ? (
        <div style={{ marginTop: 8 }}>
          <input
            className="edicion" value={porQue} onChange={(e) => setPorQue(e.target.value)}
            placeholder="Por qué no era: se quejaba de su cliente, no de nosotros…"
          />
          <p style={{ margin: '6px 0 0', display: 'flex', gap: 8 }}>
            <button type="button" className="boton" onClick={() => void descartar()} disabled={yendo || porQue.trim() === ''}>
              Descartarla
            </button>
            <button type="button" className="boton suave" onClick={() => { setDescartando(false); setPorQue('') }}>
              Dejarla
            </button>
          </p>
        </div>
      ) : null}

      {error ? <div className="error-campo" style={{ marginTop: 6 }}>{error}</div> : null}
    </li>
  )
}
