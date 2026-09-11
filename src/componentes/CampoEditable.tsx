'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { guardarCampo } from '@/app/(app)/clientes/[id]/acciones'
import type { TipoCampo } from '@/lib/campos'

/**
 * Un dato de la ficha, editable donde está.
 *
 * Se hace clic sobre el valor y ahí mismo se escribe: no hay pantalla de
 * edición, no hay botón «modificar» arriba. Lo que no se entiende no se guarda
 * y se dice por qué, con las mismas palabras que usa la importación.
 */
export function CampoEditable({
  clienteId, clave, tipo, opciones, valorCrudo, valorMostrado, ayuda, deDonde, apuntado = false,
}: {
  clienteId: number
  clave: string
  tipo: TipoCampo
  opciones?: readonly string[]
  valorCrudo: string
  valorMostrado: string | null
  ayuda?: string
  deDonde?: string
  /** Alguien vino desde otra pantalla a cargar justo este dato. */
  apuntado?: boolean
}) {
  const router = useRouter()
  const [editando, setEditando] = useState(apuntado)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const campoRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)
  // Guardar puede dispararse por Enter y por perder el foco casi a la vez.
  // Sin esto, la misma edición se manda dos veces.
  const enVuelo = useRef(false)

  useEffect(() => {
    if (editando) campoRef.current?.focus()
  }, [editando])

  // Si vino apuntado desde otro lado, que quede a la vista: llegar a la
  // pestaña correcta y tener que buscar el campo con la vista es la mitad del
  // trabajo sin hacer.
  useEffect(() => {
    if (apuntado) campoRef.current?.scrollIntoView({ block: 'center' })
  }, [apuntado])

  async function guardar() {
    if (enVuelo.current) return
    const escrito = campoRef.current?.value ?? ''
    if (escrito === valorCrudo) {
      setEditando(false)
      setError(null)
      return
    }
    enVuelo.current = true
    setGuardando(true)
    try {
      const r = await guardarCampo(clienteId, clave, escrito)
      if (r.ok) {
        setEditando(false)
        setError(null)
        router.refresh()
      } else {
        setError(r.error)
        // Si no se guardó, el foco se queda donde está el problema.
        campoRef.current?.focus()
      }
    } finally {
      enVuelo.current = false
      setGuardando(false)
    }
  }

  function teclas(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setEditando(false); setError(null) }
    // En los textos largos, Enter hace un salto de línea; se guarda con Ctrl+Enter.
    if (e.key === 'Enter' && (tipo !== 'texto_largo' || e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void guardar()
    }
  }

  if (!editando) {
    return (
      <button
        type="button"
        className={`valor-editable ${valorMostrado === null ? 'falta' : ''}`}
        onClick={() => setEditando(true)}
        title={deDonde}
      >
        {valorMostrado ?? 'falta'}
      </button>
    )
  }

  const comunes = {
    ref: campoRef as never,
    defaultValue: valorCrudo,
    onKeyDown: teclas,
    onBlur: () => void guardar(),
    readOnly: guardando,
    className: guardando ? 'edicion guardando' : 'edicion',
  }

  return (
    <div className="editando">
      {tipo === 'texto_largo' ? (
        <textarea {...comunes} rows={3} />
      ) : tipo === 'opcion' || tipo === 'booleano' ? (
        <select {...comunes}>
          <option value="">— sin dato —</option>
          {(tipo === 'booleano' ? ['sí', 'no'] : (opciones ?? [])).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input {...comunes} type={tipo === 'fecha' ? 'date' : 'text'} placeholder={ayuda} />
      )}
      {error ? <div className="error-campo">{error}</div> : null}
    </div>
  )
}
