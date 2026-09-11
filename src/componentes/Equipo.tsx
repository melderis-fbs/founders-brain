'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { altaDeUsuario, borrarDelEquipo, cambiarElAcceso, moverDeConsultora, nuevaClave } from '@/app/(app)/equipo/acciones'
import type { UsuarioDelEquipo } from '@/lib/usuarios'

/**
 * El equipo: quién entra y qué ve cada uno.
 *
 * La consultora se escribe, no se elige de una lista cerrada: las consultoras
 * entran con la planilla y el nombre tiene que poder coincidir con el que ya
 * está ahí. La lista de las que hay se ofrece como sugerencia.
 */
export function Equipo({
  usuarios, consultoras, yo,
}: {
  usuarios: UsuarioDelEquipo[]
  consultoras: string[]
  yo: number
}) {
  const router = useRouter()
  const [nuevo, setNuevo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState<string | null>(null)
  const [tocando, setTocando] = useState<number | null>(null)

  async function crear(datos: FormData) {
    setError(null); setListo(null)
    const r = await altaDeUsuario(datos)
    if (r.ok) {
      setNuevo(false)
      setListo(`${datos.get('nombre')} ya puede entrar con ${datos.get('email')}.`)
      router.refresh()
    } else setError(r.error)
  }

  async function laClave(u: UsuarioDelEquipo) {
    const clave = prompt(`Clave nueva para ${u.nombre}. Mínimo 8 caracteres.\nSe le van a cerrar las sesiones abiertas.`)
    if (clave === null) return
    setTocando(u.id); setError(null); setListo(null)
    const r = await nuevaClave(u.id, clave)
    setTocando(null)
    if (r.ok) setListo(`Clave cambiada. Pasale la nueva a ${u.nombre} por un canal que no sea esta pantalla.`)
    else setError(r.error)
  }

  async function laConsultora(u: UsuarioDelEquipo) {
    const puesto = prompt(
      `¿De qué consultora es ${u.nombre}?\n\nDejalo vacío para que sea admin y vea toda la cartera.\n\nLas que hay: ${consultoras.join(', ')}`,
      u.consultora ?? '',
    )
    if (puesto === null) return
    setTocando(u.id); setError(null); setListo(null)
    const r = await moverDeConsultora(u.id, puesto.trim() || null)
    setTocando(null)
    if (r.ok) router.refresh()
    else setError(r.error)
  }

  async function borrar(u: UsuarioDelEquipo) {
    if (!confirm(`¿Borrar a ${u.nombre}?\n\nEsto lo saca de la lista para siempre. Si ya cargó datos, no te va a dejar: en ese caso dale de baja, que le saca el acceso y deja el rastro.`)) return
    setTocando(u.id); setError(null); setListo(null)
    const r = await borrarDelEquipo(u.id)
    setTocando(null)
    if (r.ok) { setListo(`${u.nombre} ya no está.`); router.refresh() } else setError(r.error)
  }

  async function elAcceso(u: UsuarioDelEquipo) {
    setTocando(u.id); setError(null); setListo(null)
    const r = await cambiarElAcceso(u.id, !u.activo)
    setTocando(null)
    if (r.ok) router.refresh()
    else setError(r.error)
  }

  return (
    <>
      {error ? <div className="error-campo" style={{ marginBottom: 12 }}>{error}</div> : null}
      {listo ? <div className="aviso ok">{listo}</div> : null}

      <div className="tabla-marco">
        <table>
          <thead>
            <tr>
              <th>Quién</th>
              <th style={{ width: 200 }}>Qué ve</th>
              <th style={{ width: 90 }}>Clientes</th>
              <th style={{ width: 150 }}>Última entrada</th>
              <th style={{ width: 330 }} />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activo ? undefined : 'apagado'}>
                <td>
                  <b>{u.nombre}</b>{u.id === yo ? <span className="mini"> · sos vos</span> : null}
                  <div className="mini">{u.email}{u.activo ? '' : ' · sin acceso'}</div>
                </td>
                <td>
                  {u.rol === 'admin'
                    ? <span className="semaforo verde"><i />toda la cartera</span>
                    : u.consultora
                      ? <>los de {u.consultora}</>
                      : <span className="semaforo gris" title="Sin consultora asignada no ve ningún cliente"><i />ningún cliente</span>}
                </td>
                <td className="num">{u.clientes}</td>
                <td className="mini">
                  {u.ultima_entrada ? u.ultima_entrada.slice(0, 10).split('-').reverse().join('/') : <span className="apagado">nunca entró</span>}
                </td>
                <td className="num">
                  <button type="button" className="boton suave chico" disabled={tocando === u.id} onClick={() => void laConsultora(u)}>
                    Qué ve
                  </button>{' '}
                  <button type="button" className="boton suave chico" disabled={tocando === u.id} onClick={() => void laClave(u)}>
                    Clave
                  </button>{' '}
                  <button type="button" className="boton suave chico" disabled={tocando === u.id} onClick={() => void elAcceso(u)}>
                    {u.activo ? 'Dar de baja' : 'Reactivar'}
                  </button>{' '}
                  <button type="button" className="boton suave chico peligro" disabled={tocando === u.id || u.id === yo}
                          title={u.id === yo ? 'No te podés borrar a vos mismo' : 'Borrarlo de la lista'}
                          onClick={() => void borrar(u)}>
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nuevo ? (
        <form action={crear} className="tarjeta" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Alguien nuevo</h2>
          <div className="filtros" style={{ marginBottom: 12 }}>
            <div className="campo" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" type="text" required placeholder="Julieta Ponce" />
            </div>
            <div className="campo" style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required placeholder="julieta@foundersbs.com" />
            </div>
            <div className="campo" style={{ minWidth: 180 }}>
              <label htmlFor="clave">Clave</label>
              <input id="clave" name="clave" type="text" required minLength={8} placeholder="mínimo 8 caracteres" />
            </div>
            <div className="campo" style={{ flex: 1, minWidth: 200 }}>
              <label htmlFor="consultora">De qué consultora</label>
              <input id="consultora" name="consultora" type="text" list="las-consultoras" placeholder="vacío = admin, ve todo" />
              <datalist id="las-consultoras">
                {consultoras.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <p className="mini" style={{ marginTop: 0 }}>
            La clave la ponés vos y se la pasás por otro lado. Se guarda cifrada: ni yo ni vos la
            vamos a poder volver a ver desde acá.
          </p>
          <button className="boton" type="submit">Crear</button>{' '}
          <button type="button" className="boton suave" onClick={() => { setNuevo(false); setError(null) }}>Cancelar</button>
        </form>
      ) : (
        <p style={{ marginTop: 16 }}>
          <button type="button" className="boton" onClick={() => setNuevo(true)}>Agregar a alguien</button>
        </p>
      )}
    </>
  )
}
