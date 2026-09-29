'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { corregirSesion, eliminarSesion, nuevaSesion, pegarTranscripcion } from '@/app/(app)/clientes/[id]/acciones'
import { colorDeSesion, ESTADOS_SESION, ETIQUETA_ESTADO, semanaDeLaSesion, type SesionEnLista } from '@/lib/sesiones-tipos'

import { etapasDeLaSemana, faseDeLaSemana } from '@/lib/modulos'

const EXTENSIONES = '.txt,.md,.vtt,.srt,.json,.log,.pdf,.docx'

/**
 * Las sesiones: una fila cada una, y se abre la que interesa.
 *
 * Adentro está lo que pasó, el lugar para pegar la transcripción y el botón
 * Analizar. El análisis cuesta plata, así que corre sólo al apretarlo.
 */
export function Sesiones({
  clienteId, sesiones, fechaInicio, hitosPorSemana,
}: {
  clienteId: number
  sesiones: SesionEnLista[]
  /** El arranque del programa: con eso cada sesión se ubica en su semana. */
  fechaInicio: string | null
  /** Qué tendría que haber pasado en cada semana, para mirarlo al lado. */
  hitosPorSemana: Record<number, string[]>
}) {
  const router = useRouter()
  const [abierta, setAbierta] = useState<number | null>(null)
  const [nueva, setNueva] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear(datos: FormData) {
    setError(null)
    const r = await nuevaSesion(clienteId, datos)
    if (r.ok) { setNueva(false); router.refresh() } else setError(r.error ?? 'No se pudo crear.')
  }

  return (
    <div>
      <div className="entre" style={{ marginBottom: 14 }}>
        <span className="mini">
          {sesiones.length === 0
            ? 'Todavía no hay ninguna sesión cargada.'
            : `${sesiones.length} ${sesiones.length === 1 ? 'sesión' : 'sesiones'}`}
        </span>
        {nueva ? null : <button type="button" className="boton suave" onClick={() => setNueva(true)}>Sesión nueva</button>}
      </div>

      {nueva ? (
        <form action={crear} className="tarjeta" style={{ marginBottom: 14, background: 'var(--papel)' }}>
          <div className="filtros" style={{ marginBottom: 10 }}>
            <div className="campo" style={{ minWidth: 90 }}>
              <label htmlFor="numero">Número</label>
              <input id="numero" name="numero" type="text" placeholder="sigue sola" style={{ minWidth: 90 }} />
            </div>
            <div className="campo">
              <label htmlFor="fecha">Fecha</label>
              <input id="fecha" name="fecha" type="date" />
            </div>
            <div className="campo">
              <label htmlFor="estado">Estado</label>
              <select id="estado" name="estado" defaultValue="hecha">
                {ESTADOS_SESION.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
              </select>
            </div>
            <div className="campo" style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="que_paso">Qué pasó (opcional)</label>
              <input id="que_paso" name="que_paso" type="text" placeholder="Lo pone solo el análisis si lo dejás vacío" />
            </div>
          </div>
          {error ? <div className="error-campo" style={{ marginBottom: 10 }}>{error}</div> : null}
          <button className="boton" type="submit">Crear</button>{' '}
          <button type="button" className="boton suave" onClick={() => { setNueva(false); setError(null) }}>Cancelar</button>
        </form>
      ) : null}

      {sesiones.length > 0 ? (
        <div className="tabla-marco">
          <table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>Sesión</th>
                <th style={{ width: 110 }}>Fecha</th>
                <th style={{ width: 190 }}>Semana del programa</th>
                <th style={{ width: 150 }}>Cómo quedó</th>
                <th>Qué pasó</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {sesiones.map((s) => {
                const color = colorDeSesion(s)
                return (
                  <Fila key={s.id} sesion={s} color={color} clienteId={clienteId}
                        semana={semanaDeLaSesion(fechaInicio, s.fecha)} hitosPorSemana={hitosPorSemana}
                        abierta={abierta === s.id} alAbrir={() => setAbierta(abierta === s.id ? null : s.id)} />
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

function Fila({
  sesion, color, clienteId, semana, hitosPorSemana, abierta, alAbrir,
}: {
  sesion: SesionEnLista
  color: { color: string; palabra: string; porque: string }
  clienteId: number
  semana: number | null
  hitosPorSemana: Record<number, string[]>
  abierta: boolean
  alAbrir: () => void
}) {
  const loDeEsaSemana = semana === null ? [] : hitosPorSemana[semana] ?? []
  return (
    <>
      <tr className={abierta ? 'abierta' : undefined}>
        <td className="num">{sesion.numero ?? '—'}</td>
        <td className="mini">{sesion.fecha ? sesion.fecha.split('-').reverse().join('/') : <span className="apagado">sin fecha</span>}</td>
        <td className="mini">
          {semana === null ? (
            <span className="apagado" title={sesion.fecha ? 'El programa no tiene fecha de inicio cargada' : 'Cargale la fecha a la sesión'}>
              {sesion.fecha ? 'falta el inicio del programa' : 'sin fecha, sin semana'}
            </span>
          ) : (
            <>
              <b>semana {semana}</b>
              {faseDeLaSemana(semana) ? (
                <div>
                  fase {faseDeLaSemana(semana)!.numero}
                  {etapasDeLaSemana(semana).length > 0 ? ` · ${etapasDeLaSemana(semana).map((e) => e.nombre).join(' · ')}` : ''}
                </div>
              ) : null}
              {loDeEsaSemana.length > 0
                ? <div className="apagado">vencía: {loDeEsaSemana.join(' · ')}</div>
                : <div className="apagado">no vencía ningún hito esa semana</div>}
            </>
          )}
        </td>
        <td>
          <span className={`semaforo ${color.color}`} title={color.porque}><i />{color.palabra}</span>
        </td>
        <td className={sesion.que_paso ? undefined : 'apagado'}>
          {sesion.que_paso ?? 'todavía no se cargó qué pasó'}
        </td>
        <td className="num">
          <button type="button" className="boton suave" style={{ padding: '5px 12px', fontSize: 13 }} onClick={alAbrir}>
            {abierta ? 'Cerrar' : 'Abrir'}
          </button>
        </td>
      </tr>
      {abierta ? (
        <tr className="detalle-sesion">
          <td colSpan={6}>
            <CorregirSesion clienteId={clienteId} sesion={sesion} />
            <Detalle clienteId={clienteId} sesionId={sesion.id} />
          </td>
        </tr>
      ) : null}
    </>
  )
}

/**
 * Corregir o borrar una sesión ya cargada.
 *
 * La fecha era lo más urgente: se ponía al crearla y no se podía cambiar nunca
 * más. Una sesión mal fechada cae en la semana equivocada del programa, y ahí
 * la comparación entera queda corrida.
 */
function CorregirSesion({ clienteId, sesion }: { clienteId: number; sesion: SesionEnLista }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState<'no' | 'corregir' | 'borrar'>('no')
  const [yendo, setYendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function corregir(datos: FormData) {
    setYendo(true); setError(null)
    const r = await corregirSesion(clienteId, sesion.id, {
      numero: String(datos.get('numero') ?? ''),
      fecha: String(datos.get('fecha') ?? ''),
      estado: String(datos.get('estado') ?? ''),
      quePaso: String(datos.get('que_paso') ?? ''),
    })
    setYendo(false)
    if (r.ok) { setAbierto('no'); router.refresh() } else setError(r.error ?? 'No se pudo corregir.')
  }

  async function borrar() {
    setYendo(true); setError(null)
    const r = await eliminarSesion(clienteId, sesion.id)
    setYendo(false)
    if (r.ok) router.refresh()
    else setError(r.error ?? 'No se pudo borrar.')
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <p className="mini" style={{ margin: 0 }}>
        <button type="button" className="como-enlace"
                onClick={() => { setAbierto(abierto === 'corregir' ? 'no' : 'corregir'); setError(null) }}>
          corregir los datos de esta sesión
        </button>
        {' · '}
        <button type="button" className="como-enlace"
                onClick={() => { setAbierto(abierto === 'borrar' ? 'no' : 'borrar'); setError(null) }}>
          borrarla
        </button>
      </p>

      {error ? <div className="error-campo">{error}</div> : null}

      {abierto === 'corregir' ? (
        <form action={corregir} className="al-corregir">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="campo">
              <label htmlFor={`n-${sesion.id}`}>Número</label>
              <input id={`n-${sesion.id}`} name="numero" type="text" defaultValue={sesion.numero ?? ''} style={{ minWidth: 80 }} />
            </div>
            <div className="campo">
              <label htmlFor={`f-${sesion.id}`}>Fecha</label>
              <input id={`f-${sesion.id}`} name="fecha" type="date" defaultValue={sesion.fecha ?? ''} />
            </div>
            <div className="campo">
              <label htmlFor={`e-${sesion.id}`}>Estado</label>
              <select id={`e-${sesion.id}`} name="estado" defaultValue={sesion.estado}>
                {ESTADOS_SESION.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
              </select>
            </div>
            <div className="campo" style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor={`q-${sesion.id}`}>Qué pasó</label>
              <input id={`q-${sesion.id}`} name="que_paso" type="text" defaultValue={sesion.que_paso ?? ''} />
            </div>
            <button className="boton" type="submit" disabled={yendo}>Guardar</button>
            <button type="button" className="boton suave" onClick={() => setAbierto('no')}>Cancelar</button>
          </div>
          <p className="mini" style={{ margin: '7px 0 0' }}>
            La transcripción y el análisis no se tocan desde acá.
          </p>
        </form>
      ) : null}

      {abierto === 'borrar' ? (
        <div className="al-corregir">
          <p style={{ margin: '0 0 8px' }}>
            ¿Borrar la sesión {sesion.numero ?? 'sin número'}? Se va con su transcripción y su análisis.
          </p>
          <button type="button" className="boton" disabled={yendo} onClick={() => void borrar()}>Sí, borrarla</button>{' '}
          <button type="button" className="boton suave" onClick={() => setAbierto('no')}>No</button>
        </div>
      ) : null}
    </div>
  )
}

function Detalle({ clienteId, sesionId }: { clienteId: number; sesionId: number }) {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState<{ transcripcion: string | null; analisis: string | null; puntos: string[] | null; compromisos: string[] | null } | null>(null)
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [enVivo, setEnVivo] = useState('')
  const [error, setError] = useState<string | null>(null)

  // El texto de la sesión se trae sólo cuando se abre: una transcripción son
  // decenas de miles de caracteres y no tiene por qué viajar con la lista.
  if (cargando && sesion === null) {
    void fetch(`/api/sesiones/${sesionId}?cliente=${clienteId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setSesion(d); setTexto(d?.transcripcion ?? ''); setEditando(!d?.transcripcion); setCargando(false) })
      .catch(() => setCargando(false))
  }

  async function guardar() {
    setError(null)
    const r = await pegarTranscripcion(clienteId, sesionId, texto)
    if (r.ok) { setEditando(false); setSesion((s) => ({ ...(s ?? { analisis: null, puntos: null, compromisos: null }), transcripcion: texto })); router.refresh() }
    else setError(r.error ?? 'No se pudo guardar.')
  }

  async function analizar() {
    setAnalizando(true); setEnVivo(''); setError(null)
    try {
      const r = await fetch('/api/sesiones/analizar', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clienteId, sesionId }),
      })
      if (!r.ok || !r.body) { setError(await r.text()); return }
      const lector = r.body.getReader()
      const dec = new TextDecoder()
      let todo = ''
      for (;;) {
        const { done, value } = await lector.read()
        if (done) break
        todo += dec.decode(value, { stream: true })
        setEnVivo(todo)
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Se cortó la conexión.')
    } finally {
      setAnalizando(false)
    }
  }

  if (cargando) return <p className="mini apagado" style={{ margin: 0 }}>abriendo…</p>

  const hayTranscripcion = Boolean(sesion?.transcripcion)

  return (
    <div className="dentro-sesion">
      {sesion?.puntos && sesion.puntos.length > 0 && !enVivo ? (
        <div className="bloque-analisis">
          <h3>Lo que salió de la sesión</h3>
          <ul>{sesion.puntos.map((p, i) => <li key={i}>{p}</li>)}</ul>
          {sesion.compromisos && sesion.compromisos.length > 0 ? (
            <>
              <h3>Compromisos</h3>
              <ul>{sesion.compromisos.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Mientras se escribe se muestra tal cual llega, sin los ## del formato:
          esos son para partirlo después, no para que los lea nadie. */}
      {enVivo ? <div className="bloque-analisis"><pre>{enVivo.replace(/^#{1,3}\s+/gm, '')}</pre></div> : null}

      <h3>Transcripción</h3>
      {editando ? (
        <>
          <textarea className="edicion" rows={8} value={texto} onChange={(e) => setTexto(e.target.value)}
                    placeholder="Pegá acá la transcripción de la sesión…" />
          <p style={{ margin: '10px 0 0' }}>
            <button type="button" className="boton" onClick={() => void guardar()}>Guardar</button>{' '}
            {hayTranscripcion ? <button type="button" className="boton suave" onClick={() => { setEditando(false); setTexto(sesion?.transcripcion ?? '') }}>Cancelar</button> : null}
          </p>

          {/* Una transcripción de Zoom baja como archivo y son cincuenta mil
              caracteres: pegarlos a mano es un trámite. Va por el endpoint
              porque una acción de servidor se traba en 1 MB. */}
          <form action="/api/sesiones/transcripcion" method="post" encType="multipart/form-data"
                className="subir-transcripcion">
            <input type="hidden" name="cliente_id" value={clienteId} />
            <input type="hidden" name="sesion_id" value={sesionId} />
            <label htmlFor={`archivo-${sesionId}`}>…o subí el archivo de la transcripción</label>
            <div>
              <input id={`archivo-${sesionId}`} name="archivo" type="file" accept={EXTENSIONES} required />
              <button className="boton suave" type="submit">Subir</button>
            </div>
            <span className="mini">
              Lo que baja de Zoom o Meet (.vtt, .txt, .docx, PDF). Reemplaza lo que haya cargado; analizar sigue siendo aparte.
            </span>
          </form>
        </>
      ) : (
        <>
          <p className="mini">{(sesion?.transcripcion ?? '').length.toLocaleString('es-AR')} caracteres cargados.</p>
          <p style={{ margin: '10px 0 0' }}>
            <button type="button" className="boton" onClick={() => void analizar()} disabled={analizando}>
              {analizando ? 'Analizando…' : sesion?.analisis ? 'Analizar de nuevo' : 'Analizar'}
            </button>{' '}
            <button type="button" className="boton suave" onClick={() => setEditando(true)}>Corregir la transcripción</button>
          </p>
          <p className="mini" style={{ marginTop: 8, marginBottom: 0 }}>
            Analizar cuesta plata: corre sólo cuando apretás el botón.
          </p>
        </>
      )}

      {error ? <div className="error-campo" style={{ marginTop: 10 }}>{error}</div> : null}
    </div>
  )
}
