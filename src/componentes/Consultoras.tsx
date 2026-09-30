'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { altaDeConsultora, borrarUnaConsultora, corregirNombreDeConsultora } from '@/app/(app)/equipo/acciones'
import type { ConsultoraDelEquipo } from '@/lib/usuarios'

/**
 * El equipo de consultoras: una lista cerrada.
 *
 * En todas las demás pantallas la consultora SE ELIGE de esta lista. Acá es el
 * único lugar donde se escribe un nombre, y es a propósito: sumar a alguien al
 * equipo es una decisión, no el efecto secundario de tipear su nombre en la
 * ficha de un cliente o en una celda de la planilla. Así era antes y por eso
 * había tres «Romina».
 *
 * Las de afuera del equipo se muestran aparte y con sus clientes: son las que
 * quedaron de arrastre. No se las esconde ni se las junta sola con la del
 * equipo que se le parece —eso es adivinar (regla 3)—: se ven, y alguien pasa
 * los clientes a quien corresponda.
 */
export function Consultoras({ consultoras }: { consultoras: ConsultoraDelEquipo[] }) {
  const router = useRouter()
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [tocando, setTocando] = useState<number | null>(null)

  const delEquipo = consultoras.filter((c) => c.del_equipo)
  const deAfuera = consultoras.filter((c) => !c.del_equipo)

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
        Es la lista de la que se elige en todas las demás pantallas: en ningún otro lado se escribe
        una consultora a mano. {deAfuera.length > 0 ? 'Abajo están las que quedaron de afuera del equipo.' : null}
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
            {delEquipo.map((c) => (
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
          placeholder="Nombre de alguien que se suma al equipo" style={{ minWidth: 280 }}
          onKeyDown={(e) => { if (e.key === 'Enter') void crear() }}
        />
        <button type="button" className="boton" onClick={() => void crear()} disabled={nueva.trim() === ''}>
          Sumar al equipo
        </button>
      </p>
      <p className="mini apagado" style={{ marginTop: 0 }}>
        Escribilo como se va a leer en todas las pantallas. Si hay dos con el mismo nombre de pila,
        distinguilas acá —«Victoria P», «Victoria A»—: después no hay forma de saber cuál es cuál.
      </p>

      {deAfuera.length > 0 ? (
        <div style={{ marginTop: 26 }}>
          <h3 style={{ marginBottom: 4 }}>No son del equipo</h3>
          <p className="mini" style={{ marginTop: 0 }}>
            Quedaron de antes. No se juntan solas con la del equipo que se les parezca: que exista
            una «Romina Gómez» no la convierte en «Romina». Pasá sus clientes y después borralas.
          </p>
          <div className="tabla-marco">
            <table>
              <tbody>
                {deAfuera.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.nombre}</b></td>
                    <td className="num">
                      {c.clientes === 0
                        ? <span className="apagado">sin clientes</span>
                        : `${c.clientes} ${c.clientes === 1 ? 'cliente' : 'clientes'}`}
                    </td>
                    <td className="num">
                      <Link className="boton suave chico" href={`/clientes?asignar=${c.id}`}>Pasar sus clientes</Link>{' '}
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
        </div>
      ) : null}
    </section>
  )
}
