'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { marcarHitoClave } from '@/app/(app)/clientes/[id]/acciones'
import type { EtapaConEstado, FaseConEstado } from '@/lib/hitos-clave'
import { nombreDeEtapa } from '@/lib/modulos'

const COMO_SE_LEE: Record<EtapaConEstado['estado'], string> = {
  elegida: 'acá está',
  es_la_de_ahora: 'le toca por calendario',
  pasada: 'ya pasó',
  todavia_no: 'todavía no le toca',
}

/**
 * Las catorce etapas del programa, en orden, y los hitos clave.
 *
 * Dos marcas y las dos importan: dónde le tocaría estar por calendario, y
 * dónde dice la consultora que está. Cuando no coinciden, eso es la
 * conversación; por eso se ven las dos y no se esconde ninguna.
 */
export function FasesDelPrograma({
  clienteId, etapas, fases, hechos,
}: {
  clienteId: number
  etapas: EtapaConEstado[]
  fases: FaseConEstado[]
  hechos: Record<string, { hecho_en: string; quien: string | null }>
}) {
  const router = useRouter()
  const [tocando, setTocando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function marcar(clave: string, hecho: boolean) {
    setTocando(clave); setError(null)
    const r = await marcarHitoClave(clienteId, clave, hecho)
    setTocando(null)
    if (r.ok) router.refresh()
    else setError(r.error ?? 'No se pudo.')
  }

  const elegida = etapas.find((e) => e.estado === 'elegida')
  const porCalendario = etapas.find((e) => e.estado === 'es_la_de_ahora')

  return (
    <div className="programa">
      {error ? <div className="error-campo" style={{ marginBottom: 12 }}>{error}</div> : null}

      {elegida && porCalendario && elegida.etapa.clave !== porCalendario.etapa.clave ? (
        <p className="no-coinciden">
          Por calendario le tocaría <b>{porCalendario.etapa.nombre}</b> y está en{' '}
          <b>{elegida.etapa.nombre}</b>. Ahí está la conversación.
        </p>
      ) : null}

      <ol className="las-etapas">
        {etapas.map(({ etapa, estado, porque }) => (
          <li className={`una-etapa ${estado}`} key={etapa.clave} title={porque}>
            <span className="num">{etapa.numero}</span>
            <div>
              <span className="nombre">{nombreDeEtapa(etapa)}</span>
              <span className="mini">
                semana {etapa.desdeSemana}{etapa.hastaSemana !== etapa.desdeSemana ? ` a ${etapa.hastaSemana}` : ''}
                {estado !== 'todavia_no' && estado !== 'pasada' ? ` · ${COMO_SE_LEE[estado]}` : ''}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <h3>Hitos clave</h3>
      <p className="mini" style={{ marginTop: 0 }}>
        No salen de ningún dato: los marcás vos.
      </p>

      {fases.map(({ fase, hechos: cuantos, total }) => (
        <div className="hitos-de" key={fase.numero}>
          <span className="rotulo">{fase.periodo} · {cuantos} de {total}</span>
          {fase.hitosClave.map((h) => {
            const hecho = hechos[h.clave]
            return (
              <label className={`hito-clave ${hecho ? 'hecho' : ''}`} key={h.clave}>
                <input
                  type="checkbox" checked={Boolean(hecho)} disabled={tocando === h.clave}
                  onChange={(e) => void marcar(h.clave, e.target.checked)}
                />
                <span>
                  {h.etiqueta}
                  {h.cuando ? <i className="cuando"> · se espera {h.cuando}</i> : null}
                  {hecho ? (
                    <i className="cuando">
                      {' '}· lo marcó {hecho.quien ?? 'alguien'} el {hecho.hecho_en.split('-').reverse().join('/')}
                    </i>
                  ) : null}
                </span>
              </label>
            )
          })}
        </div>
      ))}
    </div>
  )
}
