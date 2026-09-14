'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { dejarNota, sacarNota } from '@/app/(app)/clientes/[id]/acciones'
import type { Nota } from '@/lib/notas'

/**
 * Las notas de la consultora, al costado.
 *
 * Para lo que pasa entre sesiones y no es ni un dato de la ficha ni una
 * bandera. Cada una queda con su fecha y quién la escribió, y no se editan: si
 * algo cambió se escribe abajo, porque lo que importa es qué se sabía en ese
 * momento.
 */
export function Notas({ clienteId, notas, yo }: { clienteId: number; notas: Nota[]; yo: number }) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [yendo, setYendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function dejar() {
    if (texto.trim() === '') return
    setYendo(true); setError(null)
    const r = await dejarNota(clienteId, texto)
    setYendo(false)
    if (r.ok) { setTexto(''); router.refresh() } else setError(r.error ?? 'No se pudo.')
  }

  async function sacar(notaId: number) {
    if (!confirm('¿Borrar esta nota?')) return
    setError(null)
    const r = await sacarNota(clienteId, notaId)
    if (r.ok) router.refresh()
    else setError(r.error ?? 'No se pudo.')
  }

  return (
    <div className="tarjeta notas">
      <h2>Notas</h2>
      <p className="mini" style={{ marginTop: 0 }}>
        Lo que pasa entre sesiones. No se edita: si algo cambió, escribilo abajo.
      </p>

      <textarea
        className="edicion" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="Llamé y no atendió. Pidió mover la del jueves…"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void dejar() }}
      />
      <p style={{ margin: '9px 0 0' }}>
        <button type="button" className="boton" onClick={() => void dejar()} disabled={yendo || texto.trim() === ''}>
          {yendo ? 'Guardando…' : 'Dejar la nota'}
        </button>
      </p>

      {error ? <div className="error-campo" style={{ marginTop: 10 }}>{error}</div> : null}

      {notas.length === 0 ? (
        <p className="mini apagado" style={{ marginBottom: 0 }}>Todavía no hay ninguna.</p>
      ) : (
        <ul className="las-notas">
          {notas.map((n) => (
            <li key={n.id}>
              <p className="texto">{n.texto}</p>
              <div className="pie-nota">
                <span className="mini">
                  {n.quien ?? 'alguien'} · {n.creado_en.slice(0, 10).split('-').reverse().join('/')}
                </span>
                {n.usuario_id === yo ? (
                  <button type="button" className="borrar-nota" onClick={() => void sacar(n.id)}>borrar</button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
