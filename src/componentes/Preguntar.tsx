'use client'

import { useState } from 'react'

/**
 * Preguntar sobre este cliente.
 *
 * Corre sólo al apretar Enviar: nunca al abrir la ficha. Cada pregunta cuesta
 * plata, y esa es toda la razón de que haya un botón.
 */
const SUGERIDAS = [
  '¿Dónde se corta y por qué?',
  '¿Qué le pregunto en la próxima sesión?',
  '¿Es el cliente o somos nosotros?',
  '¿Qué dato me falta para poder concluir algo?',
]

type Turno = { role: 'user' | 'assistant'; content: string }

export function Preguntar({ clienteId, nombre }: { clienteId: number; nombre: string }) {
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [pregunta, setPregunta] = useState('')
  const [pensando, setPensando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(texto: string) {
    const limpio = texto.trim()
    if (limpio === '' || pensando) return

    const conLaPregunta: Turno[] = [...turnos, { role: 'user', content: limpio }]
    setTurnos([...conLaPregunta, { role: 'assistant', content: '' }])
    setPregunta('')
    setPensando(true)
    setError(null)

    try {
      const r = await fetch('/api/preguntar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clienteId, turnos: conLaPregunta }),
      })
      if (!r.ok || !r.body) {
        setError(await r.text())
        setTurnos(conLaPregunta)
        return
      }
      const lector = r.body.getReader()
      const decodificador = new TextDecoder()
      let respuesta = ''
      for (;;) {
        const { done, value } = await lector.read()
        if (done) break
        respuesta += decodificador.decode(value, { stream: true })
        setTurnos([...conLaPregunta, { role: 'assistant', content: respuesta }])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Se cortó la conexión.')
      setTurnos(conLaPregunta)
    } finally {
      setPensando(false)
    }
  }

  return (
    <section className="tarjeta">
      <h2>Preguntar sobre {nombre}</h2>
      <p className="mini" style={{ marginTop: -6 }}>
        Lee la ficha y los documentos cargados. Lo que no está cargado no se inventa: dice que falta.
      </p>

      {turnos.length === 0 ? (
        <div className="sugeridas">
          {SUGERIDAS.map((s) => (
            <button key={s} type="button" className="boton suave" onClick={() => void enviar(s)}>{s}</button>
          ))}
        </div>
      ) : (
        <div className="conversacion">
          {turnos.map((t, i) => (
            <div key={i} className={`turno ${t.role}`}>
              {t.content === '' ? <span className="apagado">pensando…</span> : t.content}
            </div>
          ))}
        </div>
      )}

      {error ? <div className="error-campo" style={{ margin: '10px 0' }}>{error}</div> : null}

      <div className="preguntar-caja">
        <textarea
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void enviar(pregunta) }
          }}
          rows={2}
          className="edicion"
          placeholder={`Preguntá sobre ${nombre}…`}
          disabled={pensando}
        />
        <button className="boton" type="button" onClick={() => void enviar(pregunta)} disabled={pensando || pregunta.trim() === ''}>
          {pensando ? 'Pensando…' : 'Enviar'}
        </button>
      </div>
    </section>
  )
}
