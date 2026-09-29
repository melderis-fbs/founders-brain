'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { corregirDocumento, eliminarDocumento, pegarDocumento } from '@/app/(app)/clientes/[id]/acciones'
import { ETIQUETA_DOCUMENTO, type TipoDocumento } from '@/lib/campos'
import { EXTENSIONES_ACEPTADAS } from '@/lib/extensiones'
import { VariosDocumentos } from './VariosDocumentos'

export type DocumentoEnLista = {
  id: number
  tipo: string
  titulo: string
  fecha: string | null
  caracteres: number
  origen: string
  creado_en: string
}

const TIPOS: TipoDocumento[] = ['onboarding', 'match_de_marca', 'llamada_venta', 'contrato', 'sesion', 'notas', 'otro']

/**
 * Los documentos del cliente: los que hay, y cómo cargar uno nuevo.
 *
 * Pegar texto es el camino principal, el que siempre funciona. Subir archivo
 * va por un endpoint del servidor —no por una acción— porque una acción tiene
 * tope de 1 MB y un contrato en PDF no entra.
 *
 * «Subir varios» es para el caso real: un cliente con quince archivos. Vive en
 * `VariosDocumentos` porque es otra pantalla, con su tabla para revisar antes
 * de subir.
 */
export function Documentos({
  clienteId, documentos, suelto = false,
}: {
  clienteId: number
  documentos: DocumentoEnLista[]
  /** Dentro de una pestaña ya hay una tarjeta: no hace falta otra. */
  suelto?: boolean
}) {
  const router = useRouter()
  const [modo, setModo] = useState<'ninguno' | 'pegar' | 'archivo' | 'varios'>('ninguno')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [texto, setTexto] = useState<string>('')
  const [editando, setEditando] = useState<number | null>(null)
  const [borrando, setBorrando] = useState<number | null>(null)

  async function corregir(id: number, datos: FormData) {
    setGuardando(true); setError(null)
    const r = await corregirDocumento(clienteId, id, {
      tipo: String(datos.get('tipo') ?? ''),
      fecha: String(datos.get('fecha') ?? ''),
      titulo: String(datos.get('titulo') ?? ''),
    })
    setGuardando(false)
    if (r.ok) { setEditando(null); router.refresh() } else setError(r.error ?? 'No se pudo corregir.')
  }

  async function borrar(id: number) {
    setGuardando(true); setError(null)
    const r = await eliminarDocumento(clienteId, id)
    setGuardando(false)
    if (r.ok) { setBorrando(null); setAbierto(null); router.refresh() } else setError(r.error ?? 'No se pudo borrar.')
  }

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

  const Marco = suelto ? 'div' : 'section'

  return (
    <Marco className={suelto ? undefined : 'tarjeta'}>
      {suelto ? null : <h2>Documentos</h2>}

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
                  {' · '}
                  <button type="button" className="como-enlace"
                          onClick={() => { setEditando(editando === d.id ? null : d.id); setBorrando(null); setError(null) }}>
                    corregir
                  </button>
                  {' · '}
                  <button type="button" className="como-enlace"
                          onClick={() => { setBorrando(borrando === d.id ? null : d.id); setEditando(null); setError(null) }}>
                    borrar
                  </button>
                </div>

                {editando === d.id ? (
                  <form action={(datos) => corregir(d.id, datos)} className="al-corregir">
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div className="campo">
                        <label htmlFor={`tipo-${d.id}`}>Qué es</label>
                        <select id={`tipo-${d.id}`} name="tipo" defaultValue={d.tipo}>
                          {TIPOS.map((t) => <option key={t} value={t}>{ETIQUETA_DOCUMENTO[t]}</option>)}
                        </select>
                      </div>
                      <div className="campo">
                        <label htmlFor={`fecha-${d.id}`}>Fecha</label>
                        <input id={`fecha-${d.id}`} name="fecha" type="date" defaultValue={d.fecha ?? ''} />
                      </div>
                      <div className="campo" style={{ flex: 1, minWidth: 160 }}>
                        <label htmlFor={`titulo-${d.id}`}>Título</label>
                        <input id={`titulo-${d.id}`} name="titulo" type="text" defaultValue={d.titulo} />
                      </div>
                      <button className="boton" type="submit" disabled={guardando}>Guardar</button>
                      <button type="button" className="boton suave" onClick={() => setEditando(null)}>Cancelar</button>
                    </div>
                    <p className="mini" style={{ margin: '7px 0 0' }}>
                      El texto no se toca: es lo que trajo el archivo. Si cambiás qué es, se borra el resumen,
                      porque ese resumen se hizo leyéndolo como otra cosa.
                    </p>
                  </form>
                ) : null}

                {borrando === d.id ? (
                  <div className="al-corregir">
                    <p style={{ margin: '0 0 8px' }}>
                      ¿Borrar <b>{d.titulo}</b>? Se va con su texto y su resumen, y el diagnóstico deja de verlo.
                    </p>
                    <button type="button" className="boton" disabled={guardando} onClick={() => void borrar(d.id)}>
                      Sí, borrarlo
                    </button>{' '}
                    <button type="button" className="boton suave" onClick={() => setBorrando(null)}>No</button>
                  </div>
                ) : null}

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
          <button type="button" className="boton suave" onClick={() => setModo('archivo')}>Subir archivo</button>{' '}
          <button type="button" className="boton suave" onClick={() => setModo('varios')}>Subir varios</button>
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

      {modo === 'varios' ? (
        <VariosDocumentos clienteId={clienteId} alTerminar={() => setModo('ninguno')} />
      ) : null}

      {modo === 'archivo' ? (
        <form action="/api/documentos" method="post" encType="multipart/form-data">
          <input type="hidden" name="cliente_id" value={clienteId} />
          <Cabecera />
          <div className="campo" style={{ marginBottom: 10 }}>
            <label htmlFor="archivo">Archivo</label>
            <input id="archivo" name="archivo" type="file" accept={EXTENSIONES_ACEPTADAS} required />
            <span className="mini">PDF, .docx y texto plano. De un PDF escaneado no sale texto y te lo va a decir.</span>
          </div>
          <button className="boton" type="submit">Subir</button>{' '}
          <button type="button" className="boton suave" onClick={() => setModo('ninguno')}>Cancelar</button>
        </form>
      ) : null}
    </Marco>
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
