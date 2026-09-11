'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { decidirPropuesta } from '@/app/(app)/clientes/[id]/acciones'
import { ETIQUETA_DOCUMENTO, type TipoDocumento } from '@/lib/campos'
import { acotaCampos, camposQueBuscar } from '@/lib/lectura-de-documentos'
import type { Campo } from '@/lib/campos'
import type { DocumentoEnLista } from './Documentos'
import type { Propuesta } from '@/lib/propuestas'

/**
 * Completar la ficha desde los documentos.
 *
 * Propone sólo los campos vacíos, cada uno con la frase de donde salió, y se
 * confirma de a uno. Nada entra a la ficha hasta que alguien lo acepta: una
 * meta mensual mal deducida no es un dato flojo, es el objetivo que la
 * consultora persigue toda la semana.
 */
export function CompletarFicha({
  clienteId, propuestas, faltan, etiquetas, documentos,
}: {
  clienteId: number
  propuestas: Propuesta[]
  faltan: Campo[]
  etiquetas: Record<string, string>
  documentos: DocumentoEnLista[]
}) {
  const router = useRouter()
  const [corriendo, setCorriendo] = useState(false)
  const [enVivo, setEnVivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [decidiendo, setDecidiendo] = useState<number | null>(null)
  const [leyendo, setLeyendo] = useState<number | null>(null)

  async function completar(documentoId: number) {
    setCorriendo(true); setEnVivo(''); setError(null); setLeyendo(documentoId)
    try {
      const r = await fetch('/api/completar', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clienteId, documentoId }),
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
      setCorriendo(false); setLeyendo(null)
    }
  }

  async function decidir(id: number, decision: 'aceptar' | 'rechazar') {
    setDecidiendo(id); setError(null)
    const r = await decidirPropuesta(clienteId, id, decision)
    setDecidiendo(null)
    if (!r.ok) setError(r.error ?? 'No se pudo.')
    else router.refresh()
  }

  return (
    <div>
      <p className="mini" style={{ marginTop: 0 }}>
        Se lee <b>un documento por vez</b>: cada tipo se lee distinto y da datos distintos. Propone
        sólo los campos vacíos, cada uno con la frase de donde salió, y nada entra a la ficha hasta
        que lo confirmás.
      </p>

      {propuestas.length > 0 ? (
        <>
          <h3>Para confirmar · {propuestas.length}</h3>
          <div className="propuestas">
            {propuestas.map((p) => (
              <div className="propuesta" key={p.id}>
                <div className="que">
                  <span className="rotulo">{etiquetas[p.campo] ?? p.campo}</span>
                  <div className="valor">{p.valor}</div>
                  {p.cita ? <blockquote>«{p.cita}»</blockquote> : null}
                  {p.documento ? <div className="mini">de {p.documento}</div> : null}
                </div>
                <div className="decidir">
                  <button type="button" className="boton" disabled={decidiendo === p.id}
                          onClick={() => void decidir(p.id, 'aceptar')}>
                    {decidiendo === p.id ? '…' : 'Aceptar'}
                  </button>
                  <button type="button" className="boton suave" disabled={decidiendo === p.id}
                          onClick={() => void decidir(p.id, 'rechazar')}>
                    Descartar
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mini">
            Lo que aceptás queda en la ficha con su cita: al pasar el mouse por el dato se ve de dónde salió.
          </p>
        </>
      ) : null}

      {documentos.length > 0 ? (
        <p className="siguiente">
          {propuestas.length > 0
            ? 'Confirmá lo que sirva y después '
            : 'Con lo que quedó cargado, '}
          <a href="?bloque=diagnostico">armá el diagnóstico del caso</a>
          {propuestas.length > 0 ? '.' : ': cuantos más datos tenga, menos «eso no está cargado» te va a contestar.'}
        </p>
      ) : null}

      {enVivo ? <div className="bloque-analisis"><pre>{enVivo.replace(/^#{1,4}\s+/gm, '')}</pre></div> : null}
      {error ? <div className="error-campo" style={{ margin: '12px 0' }}>{error}</div> : null}

      <h3>Qué documento leer</h3>
      {documentos.length === 0 ? (
        <p className="mini">
          Primero hay que cargar algún documento de este cliente, en la pestaña Documentos.
        </p>
      ) : faltan.length === 0 ? (
        <p className="mini">No falta ningún dato: no hay nada que completar.</p>
      ) : (
        <div className="para-leer">
          {documentos.map((d) => {
            const tipo = d.tipo as TipoDocumento
            const puede = camposQueBuscar(tipo, faltan)
            return (
              <div className="documento-a-leer" key={d.id}>
                <div className="que">
                  <span className="rotulo">{ETIQUETA_DOCUMENTO[tipo] ?? d.tipo}</span>
                  <div className="valor">{d.titulo}</div>
                  <div className="mini">
                    {puede.length === 0
                      ? 'De este tipo de documento sale otra clase de datos, y los que puede dar ya están cargados.'
                      : acotaCampos(tipo)
                        ? `Se le buscan ${puede.length} de los ${faltan.length} datos que faltan: ${puede.slice(0, 4).map((c) => c.etiqueta.toLowerCase()).join(', ')}${puede.length > 4 ? '…' : ''}`
                        : `Sin tipo declarado: se le buscan los ${faltan.length} datos que faltan, pero sólo entra lo que esté dicho con todas las letras.`}
                  </div>
                </div>
                <button type="button" className="boton" disabled={corriendo || puede.length === 0}
                        onClick={() => void completar(d.id)}>
                  {leyendo === d.id ? 'Leyendo…' : 'Leer este'}
                </button>
              </div>
            )
          })}
          <p className="mini" style={{ marginBottom: 0 }}>
            Cuesta plata: corre sólo cuando apretás el botón, y sobre el documento que elegiste.
          </p>
        </div>
      )}
    </div>
  )
}
