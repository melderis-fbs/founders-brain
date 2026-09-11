'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { altaDeConsultora, borrarUnaConsultora, corregirNombreDeConsultora } from '@/app/(app)/equipo/acciones'
import type { ConsultoraDelEquipo } from '@/lib/usuarios'

/**
 * Las consultoras, con o sin clientes.
 *
 * Las que vienen de la planilla aparecen solas, pero una que todavía no tiene
 * ningún cliente cargado no aparecía por ningún lado, y entonces no había
 * forma de crearla y después pasarle su cartera. Acá está la lista completa,
 * y el enlace para ir a asignarle clientes.
 */
export function Consultoras({ consultoras }: { consultoras: ConsultoraDelEquipo[] }) {
  const router = useRouter()
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tocando, setTocando] = useState<number | null>(null)

  async function crear() {
    setError(null)
    const r = await altaDeConsultora(nueva)
    if (r.ok) { setNueva(''); router.refresh() } else setError(r.error)
  }

  async function renombrar(c: ConsultoraDelEquipo) {
    const puesto = prompt(
      `¿Cómo se escribe bien?\n\nLos ${c.clientes} clientes se quedan con ella: cuelgan de la consultora, no del texto.`,
      c.nombre,
    )
    if (puesto === null || puesto.trim() === c.nombre) return
    setTocando(c.id); setError(null)
    const r = await corregirNombreDeConsultora(c.id, puesto)
    setTocando(null)
    if (r.ok) router.refresh()
    else setError(r.error)
  }

  async function borrar(c: ConsultoraDelEquipo) {
    if (!confirm(`¿Borrar a ${c.nombre} de las consultoras?`)) return
    setTocando(c.id); setError(null)
    const r = await borrarUnaConsultora(c.id)
    setTocando(null)
    if (r.ok) router.refresh()
    else setError(r.error)
  }

  return (
    <section style={{ marginTop: 30 }}>
      <h2>Las consultoras</h2>
      <p className="mini" style={{ marginTop: 0 }}>
        Salen de la planilla. Si alguna no vino ahí —o vino escrita distinto— se crea o se corrige acá.
      </p>

      {error ? <div className="error-campo" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className="tabla-marco">
        <table>
          <thead>
            <tr>
              <th>Consultora</th>
              <th style={{ width: 110 }}>Clientes</th>
              <th style={{ width: 150 }}>Quién entra</th>
              <th style={{ width: 330 }} />
            </tr>
          </thead>
          <tbody>
            {consultoras.map((c) => (
              <tr key={c.id}>
                <td><b>{c.nombre}</b></td>
                <td className="num">
                  {c.clientes === 0
                    ? <span className="apagado" title="Todavía no tiene ningún cliente asignado">ninguno</span>
                    : c.clientes}
                </td>
                <td className="mini">
                  {c.usuarios === 0
                    ? <span className="apagado">nadie todavía</span>
                    : `${c.usuarios} ${c.usuarios === 1 ? 'persona' : 'personas'}`}
                </td>
                <td className="num">
                  <Link className="boton suave chico" href={`/clientes?asignar=${c.id}`}>
                    {c.clientes === 0 ? 'Pasarle clientes' : 'Cambiarle clientes'}
                  </Link>{' '}
                  <button type="button" className="boton suave chico" disabled={tocando === c.id}
                          onClick={() => void renombrar(c)}>
                    Corregir el nombre
                  </button>{' '}
                  <button type="button" className="boton suave chico peligro" disabled={tocando === c.id}
                          onClick={() => void borrar(c)}>
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text" value={nueva} onChange={(e) => setNueva(e.target.value)}
          placeholder="Nombre de una consultora nueva" style={{ minWidth: 260 }}
          onKeyDown={(e) => { if (e.key === 'Enter') void crear() }}
        />
        <button type="button" className="boton" onClick={() => void crear()} disabled={nueva.trim() === ''}>
          Agregar
        </button>
      </p>
    </section>
  )
}
