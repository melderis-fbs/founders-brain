'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { ETIQUETA_DOCUMENTO, type TipoDocumento } from '@/lib/campos'
import { EXTENSIONES_ACEPTADAS, porQueNoSeLee } from '@/lib/extensiones'
import { adivinarFecha, adivinarTipo, adivinarTitulo } from '@/lib/nombre-de-archivo'

const TIPOS: TipoDocumento[] = ['onboarding', 'llamada_venta', 'contrato', 'sesion', 'notas', 'otro']

type Estado = 'esperando' | 'no_se_lee' | 'subiendo' | 'listo' | 'ya_estaba' | 'error'

type Fila = {
  /** Sirve de clave de React: dos archivos pueden llamarse igual. */
  id: number
  archivo: File
  tipo: TipoDocumento
  fecha: string
  titulo: string
  estado: Estado
  detalle: string | null
}

let proximoId = 1

function filaDe(archivo: File): Fila {
  const motivo = porQueNoSeLee(archivo.name)
  return {
    id: proximoId++,
    archivo,
    tipo: adivinarTipo(archivo.name),
    fecha: adivinarFecha(archivo.name) ?? '',
    titulo: adivinarTitulo(archivo.name),
    estado: motivo ? 'no_se_lee' : 'esperando',
    detalle: motivo,
  }
}

const COMO_SE_VE: Record<Estado, { texto: string; clase: string }> = {
  esperando: { texto: 'listo para subir', clase: '' },
  no_se_lee: { texto: 'no se puede leer', clase: 'mal' },
  subiendo: { texto: 'subiendo…', clase: 'ojo' },
  listo: { texto: 'cargado', clase: 'bien' },
  ya_estaba: { texto: 'ya estaba', clase: '' },
  error: { texto: 'no entró', clase: 'mal' },
}

/**
 * CARGAR TODOS LOS DOCUMENTOS DE UN CLIENTE DE UNA VEZ
 *
 * Un cliente puede tener quince archivos. Subirlos de a uno son quince vueltas
 * de formulario, y elegir a mano el tipo, la fecha y el título de cada uno son
 * cuarenta y cinco decisiones: nadie las toma, y todo queda cargado como «Otro»,
 * que es justo lo que hace que después se lea mal.
 *
 * Así que la pantalla propone y la consultora corrige. El tipo, la fecha y el
 * título salen del nombre del archivo —reglas, no modelo: esto no gasta un
 * peso— y quedan a la vista en una tabla, editables uno por uno, antes de que
 * se suba nada. Es la regla 4: propone la máquina, confirma una persona.
 *
 * Los archivos van de a uno al servidor, no los quince juntos. Dos razones: un
 * pedido con quince PDFs no entra en el tope de cuerpo que tiene Vercel, y de
 * a uno cada archivo cuenta cómo le fue. Al final queda el recuento de lo que
 * entró, lo que ya estaba y lo que no pudo, cada uno con su motivo (regla 10).
 */
export function VariosDocumentos({ clienteId, alTerminar }: { clienteId: number; alTerminar: () => void }) {
  const router = useRouter()
  const [filas, setFilas] = useState<Fila[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [termino, setTermino] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  function agregar(elegidos: FileList | null) {
    if (!elegidos || elegidos.length === 0) return
    setTermino(false)
    setFilas((antes) => [...antes, ...Array.from(elegidos).map(filaDe)])
    if (entrada.current) entrada.current.value = ''
  }

  function cambiar(id: number, cambio: Partial<Fila>) {
    setFilas((antes) => antes.map((f) => (f.id === id ? { ...f, ...cambio } : f)))
  }

  function quitar(id: number) {
    setFilas((antes) => antes.filter((f) => f.id !== id))
  }

  function tipoParaTodos(tipo: TipoDocumento) {
    setFilas((antes) => antes.map((f) => (f.estado === 'esperando' ? { ...f, tipo } : f)))
  }

  async function subirUna(fila: Fila): Promise<{ estado: Estado; detalle: string | null }> {
    const datos = new FormData()
    datos.set('json', '1')
    datos.set('cliente_id', String(clienteId))
    datos.set('tipo', fila.tipo)
    datos.set('fecha', fila.fecha)
    datos.set('titulo', fila.titulo)
    datos.set('archivo', fila.archivo)

    try {
      const r = await fetch('/api/documentos', { method: 'POST', body: datos })
      const cuerpo = (await r.json()) as { ok?: boolean; error?: string; yaEstaba?: boolean; nota?: string | null }
      if (!cuerpo.ok) return { estado: 'error', detalle: cuerpo.error ?? 'No se pudo guardar.' }
      if (cuerpo.yaEstaba) return { estado: 'ya_estaba', detalle: 'Este archivo ya estaba cargado en este cliente.' }
      return { estado: 'listo', detalle: cuerpo.nota ?? null }
    } catch {
      return { estado: 'error', detalle: 'Se cortó la conexión antes de terminar de subirlo.' }
    }
  }

  async function subirTodo() {
    setSubiendo(true)
    setTermino(false)

    // De a uno y esperando cada uno: quince extracciones de PDF a la vez le
    // tiran la función abajo, y en fila se ve avanzar.
    for (const fila of filas) {
      if (fila.estado !== 'esperando' && fila.estado !== 'error') continue
      cambiar(fila.id, { estado: 'subiendo', detalle: null })
      const resultado = await subirUna(fila)
      cambiar(fila.id, resultado)
    }

    setSubiendo(false)
    setTermino(true)
    router.refresh()
  }

  const pendientes = filas.filter((f) => f.estado === 'esperando' || f.estado === 'error').length
  const cargados = filas.filter((f) => f.estado === 'listo').length
  const repetidos = filas.filter((f) => f.estado === 'ya_estaba').length
  const afuera = filas.filter((f) => f.estado === 'no_se_lee' || f.estado === 'error').length

  return (
    <div>
      <div className="campo" style={{ marginBottom: 12 }}>
        <label htmlFor="varios">Elegí todos los archivos del cliente</label>
        <input
          id="varios" ref={entrada} type="file" multiple accept={EXTENSIONES_ACEPTADAS}
          onChange={(e) => agregar(e.target.files)} disabled={subiendo}
        />
        <span className="mini">
          Podés elegir la carpeta entera. Antes de subir nada te muestra qué entendió de cada nombre, para que lo corrijas.
        </span>
      </div>

      {filas.length > 0 ? (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 10 }}>
            <div className="campo">
              <label htmlFor="todos">Poner el mismo tipo a todos</label>
              <select id="todos" defaultValue="" disabled={subiendo}
                onChange={(e) => { if (e.target.value) tipoParaTodos(e.target.value as TipoDocumento) }}>
                <option value="">Dejar como está</option>
                {TIPOS.map((t) => <option key={t} value={t}>{ETIQUETA_DOCUMENTO[t]}</option>)}
              </select>
            </div>
          </div>

          <div className="tabla-marco" style={{ marginBottom: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Qué es</th>
                  <th>Fecha</th>
                  <th>Título</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{f.archivo.name}</div>
                      <div className="mini">{Math.max(1, Math.round(f.archivo.size / 1024)).toLocaleString('es-AR')} KB</div>
                    </td>
                    <td>
                      <select value={f.tipo} disabled={subiendo || f.estado === 'listo' || f.estado === 'ya_estaba'}
                        onChange={(e) => cambiar(f.id, { tipo: e.target.value as TipoDocumento })}>
                        {TIPOS.map((t) => <option key={t} value={t}>{ETIQUETA_DOCUMENTO[t]}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="date" value={f.fecha} disabled={subiendo || f.estado === 'listo' || f.estado === 'ya_estaba'}
                        onChange={(e) => cambiar(f.id, { fecha: e.target.value })} />
                    </td>
                    <td>
                      <input type="text" value={f.titulo} style={{ minWidth: 170 }}
                        disabled={subiendo || f.estado === 'listo' || f.estado === 'ya_estaba'}
                        onChange={(e) => cambiar(f.id, { titulo: e.target.value })} />
                    </td>
                    <td>
                      <span className={`chip ${COMO_SE_VE[f.estado].clase}`}>{COMO_SE_VE[f.estado].texto}</span>
                      {f.detalle ? <div className="mini">{f.detalle}</div> : null}
                    </td>
                    <td>
                      <button type="button" className="boton suave" disabled={subiendo} onClick={() => quitar(f.id)}>
                        Sacar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {termino ? (
        <p className="mini" style={{ marginTop: 0, marginBottom: 10 }}>
          {cargados === 0 ? 'No entró ninguno.' : `Se cargaron ${cargados} documento${cargados === 1 ? '' : 's'}.`}
          {repetidos > 0 ? ` ${repetidos} ya estaba${repetidos === 1 ? '' : 'n'} cargado${repetidos === 1 ? '' : 's'} y no se duplicó.` : ''}
          {afuera > 0 ? ` ${afuera} quedó afuera: el motivo está en su fila.` : ''}
        </p>
      ) : null}

      <button type="button" className="boton" disabled={subiendo || pendientes === 0} onClick={subirTodo}>
        {subiendo ? 'Subiendo…' : `Subir ${pendientes} archivo${pendientes === 1 ? '' : 's'}`}
      </button>{' '}
      <button type="button" className="boton suave" disabled={subiendo} onClick={alTerminar}>
        {termino ? 'Cerrar' : 'Cancelar'}
      </button>
    </div>
  )
}
