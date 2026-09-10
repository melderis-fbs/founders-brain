'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { pegarDocumento } from '@/app/(app)/clientes/[id]/acciones'
import { ETIQUETA_DOCUMENTO, type TipoDocumento } from '@/lib/campos'

export type DocumentoEnLista = {
  id: number
  tipo: string
  titulo: string
  fecha: string | null
  caracteres: number
  origen: string
  creado_en: string
}

const TIPOS: TipoDocumento[] = ['onboarding', 'llamada_venta', 'contrato', 'sesion', 'notas', 'otro']
const EXTENSIONES = '.txt,.md,.csv,.vtt,.srt,.json,.log,.pdf,.docx'

/**
 * Los documentos del cliente: los que hay, y cómo cargar uno nuevo.
 *
 * Pegar texto es el camino principal, el que siempre funciona. Subir archivo
 * va por un endpoint del servidor —no por una acción— porque una acción tiene
 * tope de 1 MB y un contrato en PDF no entra.
 */
export function Documentos({ clienteId, documentos }: { clienteId: number; documentos: DocumentoEnLista[] }) {
  const router = useRouter()
  const [modo, setModo] = useState<'ninguno' | 'pegar' | 'archivo'>('ninguno')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [texto, setTexto] = useState<string>('')

  async function pegar(datos: FormData) {
    setGuardando(true)
    setError(null)
    const r = await pegarDocumento(clienteId, datos)
    setGuardando(false)
    if (r.ok) { setModo('ninguno'); router.refresh() } else setError(r.error ?? 'No se pudo guardar.')
  }

  async function abrir(id: number) {
    if (abierto === id) { setAbierto(null); return }
    setAbierto(id)
    setTexto('cargando…')
    const r = await fetch(`/api/documentos/${id}/texto?cliente=${clienteId}`)
    setTexto(r.ok ? await r.text() : 'No se pudo leer el documento.')
  }

  return (
    <section className="tarjeta">
      <h2>Documentos</h2>

      {documentos.length === 0 ? (
        <p className="apagado" style={{ margin: '0 0 14px' }}>No hay ninguno cargado de este cliente.</p>
      ) : (
        <dl style={{ marginBottom: 14 }}>
          {documentos.map((d) => (
            <div className="dato" key={d.id}>
              <dt>{ETIQUETA_DOCUMENTO[d.tipo as TipoDocumento] ?? d.tipo}</dt>
              <dd>
                <button type="button" className="valor-editable" onClick={() => abrir(d.id)}>
                  {d.titulo}
                </button>
                <div className="mini">
                  {d.caracteres.toLocaleString('es-AR')} caracteres · entró por {d.origen}
                  {d.fecha ? ` · ${d.fecha.split('-').reverse().join('/')}` : ''}
                </div>
                {abierto === d.id ? <pre className="texto-documento">{texto}</pre> : null}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {error ? <div className="error-campo" style={{ marginBottom: 10 }}>{error}</div> : null}

      {modo === 'ninguno' ? (
        <p style={{ margin: 0 }}>
          <button type="button" className="boton suave" onClick={() => setModo('pegar')}>Pegar texto</button>{' '}
          <button type="button" className="boton suave" onClick={() => setModo('archivo')}>Subir archivo</button>
        </p>
      ) : null}

      {modo === 'pegar' ? (
        <form action={pegar}>
          <Cabecera />
          <div className="campo" style={{ marginBottom: 10 }}>
            <label htmlFor="texto">Texto del documento</label>
            <textarea id="texto" name="texto" rows={8} className="edicion" required
              placeholder="Pegá acá el onboarding, la llamada de venta, la transcripción de la sesión…" />
          </div>
          <button className="boton" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>{' '}
          <button type="button" className="boton suave" onClick={() => { setModo('ninguno'); setError(null) }}>Cancelar</button>
        </form>
      ) : null}

      {modo === 'archivo' ? (
        <form action="/api/documentos" method="post" encType="multipart/form-data">
          <input type="hidden" name="cliente_id" value={clienteId} />
          <Cabecera />
          <div className="campo" style={{ marginBottom: 10 }}>
            <label htmlFor="archivo">Archivo</label>
            <input id="archivo" name="archivo" type="file" accept={EXTENSIONES} required />
            <span className="mini">PDF, .docx y texto plano. De un PDF escaneado no sale texto y te lo va a decir.</span>
          </div>
          <button className="boton" type="submit">Subir</button>{' '}
          <button type="button" className="boton suave" onClick={() => setModo('ninguno')}>Cancelar</button>
        </form>
      ) : null}
    </section>
  )
}

function Cabecera() {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
      <div className="campo">
        <label htmlFor="tipo">Qué es</label>
        <select id="tipo" name="tipo" defaultValue="onboarding">
          {TIPOS.map((t) => <option key={t} value={t}>{ETIQUETA_DOCUMENTO[t]}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="fecha">Fecha</label>
        <input id="fecha" name="fecha" type="date" />
      </div>
      <div className="campo" style={{ flex: 1, minWidth: 180 }}>
        <label htmlFor="titulo">Título (opcional)</label>
        <input id="titulo" name="titulo" type="text" placeholder="Se pone solo si lo dejás vacío" />
      </div>
    </div>
  )
}
