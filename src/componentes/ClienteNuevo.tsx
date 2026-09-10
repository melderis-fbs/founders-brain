'use client'

import { useState } from 'react'
import { altaDeCliente } from '@/app/(app)/clientes/acciones'
import { ESTADOS } from '@/lib/campos'

/**
 * Un cliente nuevo, a mano.
 *
 * Pide cuatro datos, no cincuenta y uno: sin nombre no hay ficha, y sin fecha
 * de inicio ni programa la comparación no puede decir nada. El resto se
 * completa en la ficha, que se abre sola apenas se crea.
 */
export function ClienteNuevo({ consultoras }: { consultoras: { id: number; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  async function crear(datos: FormData) {
    setGuardando(true)
    setError(null)
    const r = await altaDeCliente(datos)
    setGuardando(false)
    if (!r.ok) setError(r.error ?? 'No se pudo crear.')
  }

  if (!abierto) {
    return <button type="button" className="boton" onClick={() => setAbierto(true)}>Cliente nuevo</button>
  }

  return (
    <form action={crear} className="tarjeta" style={{ marginBottom: 16 }}>
      <h2>Cliente nuevo</h2>
      <div className="filtros" style={{ marginBottom: 12 }}>
        <div className="campo" style={{ flex: 1, minWidth: 240 }}>
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" type="text" required autoFocus placeholder="Nombre y apellido" />
        </div>
        <div className="campo">
          <label htmlFor="consultora">Consultora</label>
          <input id="consultora" name="consultora" type="text" list="consultoras-cargadas" placeholder="Sin asignar" />
          <datalist id="consultoras-cargadas">
            {consultoras.map((c) => <option key={c.id} value={c.nombre} />)}
          </datalist>
        </div>
        <div className="campo">
          <label htmlFor="programa_meses">Programa</label>
          <select id="programa_meses" name="programa_meses" defaultValue="">
            <option value="">Sin definir</option>
            <option value="4">4 meses</option>
            <option value="6">6 meses</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="fecha_inicio">Inicio del programa</label>
          <input id="fecha_inicio" name="fecha_inicio" type="date" />
        </div>
        <div className="campo">
          <label htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue="activo">
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {error ? <div className="error-campo" style={{ marginBottom: 10 }}>{error}</div> : null}

      <button className="boton" type="submit" disabled={guardando}>{guardando ? 'Creando…' : 'Crear y abrir la ficha'}</button>{' '}
      <button type="button" className="boton suave" onClick={() => { setAbierto(false); setError(null) }}>Cancelar</button>
      <p className="mini" style={{ marginBottom: 0, marginTop: 10 }}>
        Los otros datos se cargan en la ficha, que se abre apenas se crea.
      </p>
    </form>
  )
}
