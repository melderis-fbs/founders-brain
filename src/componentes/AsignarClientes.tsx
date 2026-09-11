'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { pasarClientes } from '@/app/(app)/equipo/acciones'

/**
 * Pasarle varios clientes a una consultora de una vez.
 *
 * El caso real: una consultora que sí tiene clientes pero en la aplicación no
 * tiene ninguno asignado, porque la planilla no traía su nombre. Hacerlo
 * cliente por cliente son veinticinco pantallas.
 *
 * Se marca con las casillas y se asigna. Lo que se mueve queda en el historial
 * de cada cliente como cualquier otro cambio.
 */
export function AsignarClientes({
  consultoras, marcados, alLimpiar,
}: {
  consultoras: { id: number; nombre: string }[]
  marcados: number[]
  alLimpiar: () => void
}) {
  const router = useRouter()
  const [aQuien, setAQuien] = useState('')
  const [yendo, setYendo] = useState(false)
  const [dicho, setDicho] = useState<string | null>(null)

  async function asignar() {
    if (aQuien === '') return
    setYendo(true); setDicho(null)
    const r = await pasarClientes(marcados, aQuien === 'ninguna' ? null : Number(aQuien))
    setYendo(false)
    if (!r.ok) { setDicho(r.error); return }

    const nombre = aQuien === 'ninguna' ? 'sin consultora' : consultoras.find((c) => String(c.id) === aQuien)?.nombre
    setDicho(
      r.movidos === 0
        ? `Ninguno se movió: los ${marcados.length} que marcaste ya estaban así.`
        : `${r.movidos} ${r.movidos === 1 ? 'cliente pasó' : 'clientes pasaron'} a ${nombre}.`,
    )
    alLimpiar()
    router.refresh()
  }

  if (marcados.length === 0) {
    return dicho ? <div className="aviso ok">{dicho}</div> : null
  }

  return (
    <div className="barra-asignar">
      <span><b>{marcados.length}</b> {marcados.length === 1 ? 'marcado' : 'marcados'}</span>
      <select value={aQuien} onChange={(e) => setAQuien(e.target.value)} aria-label="A qué consultora">
        <option value="">Pasarlos a…</option>
        {consultoras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        <option value="ninguna">— dejarlos sin consultora —</option>
      </select>
      <button type="button" className="boton" onClick={() => void asignar()} disabled={aQuien === '' || yendo}>
        {yendo ? 'Pasando…' : 'Pasar'}
      </button>
      <button type="button" className="boton suave" onClick={alLimpiar}>Desmarcar todos</button>
      {dicho ? <span className="mini">{dicho}</span> : null}
    </div>
  )
}
