'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { decidirPropuesta } from '@/app/(app)/clientes/[id]/acciones'
import type { Campo } from '@/lib/campos'
import type { Propuesta } from '@/lib/propuestas'

/**
 * Completar la ficha desde los documentos.
 *
 * Propone sólo los campos vacíos, cada uno con la frase de donde salió, y se
 * confirma de a uno. Nada entra a la ficha hasta que alguien lo acepta: una
 * meta mensual mal deducida no es un dato flojo, es el objetivo que la
 * consultora persigue toda la semana.
 */
export function CompletarFicha({
  clienteId, propuestas, faltan, etiquetas, hayDocumentos,
}: {
  clienteId: number
  propuestas: Propuesta[]
  faltan: Campo[]
  etiquetas: Record<string, string>
  hayDocumentos: boolean
}) {
  const router = useRouter()
  const [corriendo, setCorriendo] = useState(false)
  const [enVivo, setEnVivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [decidiendo, setDecidiendo] = useState<number | null>(null)

  async function completar() {
    setCorriendo(true); setEnVivo(''); setError(null)
    try {
      const r = await fetch('/api/completar', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clienteId }),
      })
      if (!r.ok || !r.body) { setError(await r.text()); return }
      const lector = r.body.getReader()
      const dec = new TextDecoder()
      let todo = ''
      for (;;) {
        const { done, value } = await lector.read()
        if (done) break
        todo += dec.decode(value, { stream: true })
        setEnVivo(todo)
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Se cortó la conexión.')
    } finally {
      setCorriendo(false)
    }
  }

  async function decidir(id: number, decision: 'aceptar' | 'rechazar') {
    setDecidiendo(id); setError(null)
    const r = await decidirPropuesta(clienteId, id, decision)
    setDecidiendo(null)
    if (!r.ok) setError(r.error ?? 'No se pudo.')
    else router.refresh()
  }

  return (
    <div>
      <p className="mini" style={{ marginTop: 0 }}>
        Lee los documentos cargados y propone <b>sólo los campos vacíos</b>, cada uno con la frase
        de donde salió. Nada entra a la ficha hasta que lo confirmás.
      </p>

      {propuestas.length > 0 ? (
        <>
          <h3>Para confirmar · {propuestas.length}</h3>
          <div className="propuestas">
            {propuestas.map((p) => (
              <div className="propuesta" key={p.id}>
                <div className="que">
                  <span className="rotulo">{etiquetas[p.campo] ?? p.campo}</span>
                  <div className="valor">{p.valor}</div>
                  {p.cita ? <blockquote>«{p.cita}»</blockquote> : null}
                </div>
                <div className="decidir">
                  <button type="button" className="boton" disabled={decidiendo === p.id}
                          onClick={() => void decidir(p.id, 'aceptar')}>
                    {decidiendo === p.id ? '…' : 'Aceptar'}
                  </button>
                  <button type="button" className="boton suave" disabled={decidiendo === p.id}
                          onClick={() => void decidir(p.id, 'rechazar')}>
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mini">
            Lo que aceptás queda en la ficha con su cita: al pasar el mouse por el dato se ve de dónde salió.
          </p>
        </>
      ) : null}

      {hayDocumentos ? (
        <p className="siguiente">
          {propuestas.length > 0
            ? 'Confirmá lo que sirva y después '
            : 'Con lo que quedó cargado, '}
          <a href="?bloque=diagnostico">armá el diagnóstico del caso</a>
          {propuestas.length > 0 ? '.' : ': cuantos más datos tenga, menos «eso no está cargado» te va a contestar.'}
        </p>
      ) : null}

      {enVivo ? <div className="bloque-analisis"><pre>{enVivo.replace(/^#{1,4}\s+/gm, '')}</pre></div> : null}
      {error ? <div className="error-campo" style={{ margin: '12px 0' }}>{error}</div> : null}

      <p style={{ marginBottom: 0 }}>
        <button type="button" className="boton" onClick={() => void completar()} disabled={corriendo || !hayDocumentos || faltan.length === 0}>
          {corriendo ? 'Leyendo los documentos…' : 'Completar desde los documentos'}
        </button>
        <span className="mini" style={{ marginLeft: 12 }}>
          {faltan.length === 0
            ? 'No falta ningún dato.'
            : !hayDocumentos
              ? 'Primero hay que cargar algún documento de este cliente.'
              : `Faltan ${faltan.length} datos. Cuesta plata: corre sólo cuando apretás el botón.`}
        </span>
      </p>
    </div>
  )
}
