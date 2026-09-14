'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { marcarHitoClave } from '@/app/(app)/clientes/[id]/acciones'
import type { FaseConEstado } from '@/lib/hitos-clave'

const COMO_SE_LEE: Record<FaseConEstado['estado'], string> = {
  terminada: 'Terminada',
  en_curso: 'Es la de ahora',
  pendiente: 'Todavía no le toca',
  quedo_a_medias: 'Quedó a medias',
}

/**
 * Las cuatro fases del programa, con lo que se trabaja y lo que quedó hecho.
 *
 * Los hitos clave no salen de ningún campo ni de ningún documento: los marca
 * la consultora. Por eso son casillas y no un cálculo — y por eso el estado de
 * la fase sale de ellos más el calendario, no de una columna «Estado» que
 * alguien tenga que acordarse de mover.
 */
export function FasesDelPrograma({
  clienteId, fases, hechos,
}: {
  clienteId: number
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

  return (
    <div className="fases-programa">
      <p className="mini" style={{ marginTop: 0 }}>
        Las cuatro fases del programa. Los hitos clave los marcás vos: no salen de ningún dato.
      </p>

      {error ? <div className="error-campo" style={{ marginBottom: 12 }}>{error}</div> : null}

      {fases.map(({ fase, estado, hechos: cuantos, total, porque }) => (
        <section className={`fase-programa ${estado}`} key={fase.numero}>
          <header>
            <div>
              <h3>Fase {fase.numero} · {fase.periodo}</h3>
              <span className="construye">{fase.queConstruimos}</span>
            </div>
            <div className="estado-fase">
              <b>{COMO_SE_LEE[estado]}</b>
              <span className="mini">{cuantos} de {total}</span>
            </div>
          </header>

          <p className="mini porque">{porque}</p>

          <div className="que-se-trabaja">
            <span className="rotulo">Qué se trabaja</span>
            <ul>{fase.modulos.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>

          <div className="hitos-clave">
            <span className="rotulo">Hitos clave</span>
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
        </section>
      ))}
    </div>
  )
}
