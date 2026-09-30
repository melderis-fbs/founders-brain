'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { eliminarCliente } from '@/app/(app)/clientes/[id]/acciones'
import type { QueSeVa } from '@/lib/borrar-tipos'

/**
 * Borrar un cliente entero.
 *
 * Hace falta: la planilla trae duplicados y filas mal, y un cliente inventado
 * ensucia el tablero de todos. Pero es lo único de la aplicación que no se
 * puede deshacer, así que pide dos cosas:
 *
 * 1. Que se vea qué se lleva puesto, con números. «¿Estás seguro?» no es una
 *    pregunta; «se van 12 documentos y 8 sesiones» sí.
 * 2. Que se escriba el nombre. Es la diferencia entre un click de más y perder
 *    el expediente entero de un cliente real.
 */
export function BorrarCliente({ clienteId, seVa }: { clienteId: number; seVa: QueSeVa }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [escrito, setEscrito] = useState('')
  const [yendo, setYendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function borrar() {
    setYendo(true); setError(null)
    const r = await eliminarCliente(clienteId, escrito)
    if (r.ok) { router.push('/clientes'); return }
    setYendo(false)
    setError(r.error ?? 'No se pudo borrar.')
  }

  const cuenta: [number, string, string][] = [
    [seVa.documentos, 'documento', 'documentos'],
    [seVa.sesiones, 'sesión', 'sesiones'],
    [seVa.meses, 'mes cargado', 'meses cargados'],
    [seVa.datosCargados, 'dato de la ficha', 'datos de la ficha'],
    [seVa.notas, 'nota', 'notas'],
    [seVa.banderas, 'bandera', 'banderas'],
    [seVa.diagnosticos, 'diagnóstico', 'diagnósticos'],
    [seVa.propuestas, 'propuesta', 'propuestas'],
  ]
  const hay = cuenta.filter(([n]) => n > 0).map(([n, uno, varios]) => `${n} ${n === 1 ? uno : varios}`)

  if (!abierto) {
    return (
      <p className="mini" style={{ margin: '14px 0 0' }}>
        <button type="button" className="como-enlace" onClick={() => setAbierto(true)}>
          borrar este cliente
        </button>
      </p>
    )
  }

  return (
    <div className="al-corregir" style={{ borderLeftColor: 'var(--rojo)' }}>
      <p style={{ margin: '0 0 8px' }}>
        Borrar <b>{seVa.nombre}</b> se lleva{' '}
        {hay.length === 0 ? 'la ficha, que está vacía' : hay.join(', ')}. <b>No se puede deshacer.</b>
      </p>
      <p className="mini" style={{ margin: '0 0 10px' }}>
        Lo único que queda es el registro de lo que se le gastó al modelo: esa plata se gastó igual.
      </p>

      <div className="campo" style={{ maxWidth: 380, marginBottom: 10 }}>
        <label htmlFor="confirmar">Escribí «{seVa.nombre}» para confirmar</label>
        <input id="confirmar" type="text" value={escrito} autoFocus autoComplete="off"
               onChange={(e) => { setEscrito(e.target.value); setError(null) }} />
      </div>

      {error ? <div className="error-campo" style={{ marginBottom: 8 }}>{error}</div> : null}

      <button type="button" className="boton" disabled={yendo || escrito.trim() === ''} onClick={() => void borrar()}>
        {yendo ? 'Borrando…' : 'Borrarlo para siempre'}
      </button>{' '}
      <button type="button" className="boton suave" onClick={() => { setAbierto(false); setEscrito(''); setError(null) }}>
        Cancelar
      </button>
    </div>
  )
}
