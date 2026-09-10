'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { DiagnosticoGuardado } from '@/lib/diagnosticos'

/**
 * El diagnóstico del caso.
 *
 * Si ya se hizo, se muestra el guardado con su fecha y no se vuelve a hacer
 * solo: correrlo de nuevo es una decisión de alguien. Cada corrida cuesta plata.
 */
export function DiagnosticoDelCaso({
  clienteId, guardado,
}: {
  clienteId: number
  guardado: DiagnosticoGuardado | null
}) {
  const router = useRouter()
  const [corriendo, setCorriendo] = useState(false)
  const [enVivo, setEnVivo] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function correr() {
    setCorriendo(true); setEnVivo(''); setError(null)
    try {
      const r = await fetch('/api/diagnostico', {
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

  const boton = (
    <p style={{ margin: 0 }}>
      <button type="button" className="boton" onClick={() => void correr()} disabled={corriendo}>
        {corriendo ? 'Pensando…' : guardado ? 'Volver a diagnosticar' : 'Diagnosticar el caso'}
      </button>
      <span className="mini" style={{ marginLeft: 12 }}>
        Cuesta plata: corre sólo cuando apretás el botón.
      </span>
    </p>
  )

  if (enVivo) {
    return (
      <div>
        <div className="bloque-analisis"><pre>{enVivo.replace(/^#{1,3}\s+/gm, '')}</pre></div>
        {boton}
      </div>
    )
  }

  if (!guardado) {
    return (
      <div>
        <p className="mini" style={{ marginTop: 0 }}>
          Lee la ficha, la comparación con lo esperado y los documentos cargados, y contesta cuatro cosas:
          dónde se corta, por qué —con la frase que lo sostiene—, si es el cliente o somos nosotros,
          y qué hacer. Tres acciones como máximo.
        </p>
        {error ? <div className="error-campo" style={{ margin: '12px 0' }}>{error}</div> : null}
        {boton}
      </div>
    )
  }

  return (
    <div>
      <p className="mini" style={{ marginTop: 0 }}>
        Hecho el {new Date(guardado.creado_en).toLocaleString('es-AR')}. No se rehace solo.
      </p>

      {guardado.donde_se_corta ? (
        <div className="corte" style={{ marginTop: 0, marginBottom: 18 }}>
          Se corta en: {guardado.donde_se_corta}
        </div>
      ) : null}

      {guardado.acciones && guardado.acciones.length > 0 ? (
        <>
          <h3>Qué hacer</h3>
          <ol className="acciones-diag">{guardado.acciones.map((a, i) => <li key={i}>{a}</li>)}</ol>
        </>
      ) : null}

      {guardado.de_quien_es ? (
        <>
          <h3>¿Es el cliente o somos nosotros?</h3>
          <p className="parrafo">{guardado.de_quien_es}</p>
        </>
      ) : null}

      <h3>El diagnóstico completo</h3>
      <div className="bloque-analisis"><pre>{guardado.texto.replace(/^#{1,3}\s+/gm, '')}</pre></div>

      {guardado.falta_cargar && guardado.falta_cargar.length > 0 ? (
        <>
          <h3>Qué falta cargar para poder decir más</h3>
          <ul className="acciones-diag">{guardado.falta_cargar.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </>
      ) : null}

      {error ? <div className="error-campo" style={{ margin: '12px 0' }}>{error}</div> : null}
      {boton}
    </div>
  )
}
