'use client'

import { useState } from 'react'

/**
 * Qué se repite entre las encuestas.
 *
 * Cuesta plata, así que corre sólo con el botón, como todo lo que llama al
 * modelo. Con menos de tres encuestas no se ofrece: lo que se parezca entre dos
 * es casualidad, y llamarlo patrón manda a arreglar algo que no está roto.
 */
export function PatronesDeEncuestas({ cuantas }: { cuantas: number }) {
  const [corriendo, setCorriendo] = useState(false)
  const [enVivo, setEnVivo] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function buscar() {
    setCorriendo(true); setEnVivo(''); setError(null)
    try {
      const r = await fetch('/api/encuestas', { method: 'POST' })
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Se cortó la conexión.')
    } finally {
      setCorriendo(false)
    }
  }

  return (
    <section className="tarjeta">
      <h2 style={{ marginTop: 0 }}>Qué se repite</h2>
      <p className="mini" style={{ marginTop: 0 }}>
        Una queja dicha por una persona es un caso. Dicha por ocho es un problema nuestro, y eso
        no se ve leyendo las encuestas de a una.
      </p>

      {error ? <div className="error-campo" style={{ margin: '10px 0' }}>{error}</div> : null}
      {enVivo ? <div className="bloque-analisis"><pre>{enVivo}</pre></div> : null}

      <p style={{ margin: '12px 0 0' }}>
        <button type="button" className="boton" disabled={corriendo || cuantas < 3} onClick={() => void buscar()}>
          {corriendo ? 'Leyéndolas…' : enVivo ? 'Volver a buscar' : `Buscar patrones en ${cuantas}`}
        </button>{' '}
        <span className="mini">
          {cuantas < 3
            ? 'Hacen falta al menos tres encuestas con texto adentro.'
            : 'Cuesta plata: corre sólo cuando apretás el botón.'}
        </span>
      </p>
    </section>
  )
}
