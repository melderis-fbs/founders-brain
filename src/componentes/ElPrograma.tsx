'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { marcarEtapaDelPrograma, marcarHitoClave } from '@/app/(app)/clientes/[id]/acciones'
import type { Avance, FilaDeEtapa } from '@/lib/avance'
import type { FaseConEstado } from '@/lib/hitos-clave'
import { nombreDeEtapa } from '@/lib/modulos'

/**
 * EL PROGRAMA: DÓNDE ESTÁ Y DÓNDE TENDRÍA QUE ESTAR
 *
 * Las catorce etapas, en orden, con un casillero cada una. Tildarlas es lo que
 * hoy se hace en la planilla, y es lo único que le da contra qué comparar al
 * calendario.
 *
 * Arriba, las dos barras superpuestas: la gris es lo que el calendario pide a
 * esta altura, la de color es lo que tiene. La comparación se ve; no hay que
 * calcularla ni leer dos porcentajes y restarlos mentalmente.
 */
export function ElPrograma({
  clienteId, avance, filas, fases, hechos,
}: {
  clienteId: number
  avance: Avance
  filas: FilaDeEtapa[]
  fases: FaseConEstado[]
  hechos: Record<string, { hecho_en: string; quien: string | null }>
}) {
  const router = useRouter()
  const [tocando, setTocando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // El tilde se pinta en el acto y el servidor confirma después. Si falla se
  // vuelve atrás y se dice por qué: un casillero que tarda medio segundo en
  // marcarse se vuelve a tocar, y entonces se desmarca lo que se acababa de
  // marcar.
  const [recienTocadas, setRecienTocadas] = useState<Record<string, boolean>>({})

  async function marcarEtapa(clave: string, hecha: boolean) {
    setTocando(clave); setError(null)
    setRecienTocadas((antes) => ({ ...antes, [clave]: hecha }))
    const r = await marcarEtapaDelPrograma(clienteId, clave, hecha)
    setTocando(null)
    if (r.ok) {
      router.refresh()
    } else {
      setRecienTocadas((antes) => {
        const copia = { ...antes }
        delete copia[clave]
        return copia
      })
      setError(r.error ?? 'No se pudo.')
    }
  }

  async function marcarHito(clave: string, hecho: boolean) {
    setTocando(clave); setError(null)
    const r = await marcarHitoClave(clienteId, clave, hecho)
    setTocando(null)
    if (r.ok) router.refresh()
    else setError(r.error ?? 'No se pudo.')
  }

  const comparable = avance.estado !== 'sin_fecha' && avance.estado !== 'sin_marcar'

  return (
    <div className="programa">
      {error ? <div className="error-campo" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className={`avance ${avance.estado}`}>
        <div className="numeros">
          <div>
            <span className="rotulo">Tiene</span>
            <b className="cifra">{avance.hechas}<span className="de"> de {avance.total}</span></b>
          </div>
          <div>
            <span className="rotulo">Tendría que tener</span>
            <b className="cifra">
              {comparable || avance.estado === 'sin_marcar'
                ? <>{avance.esperadas}<span className="de"> de {avance.total}</span></>
                : <span className="apagado">—</span>}
            </b>
          </div>
          <div>
            <span className="rotulo">Estado</span>
            <b className="cifra chico">{avance.palabra}</b>
          </div>
        </div>

        {/* Las dos barras, una arriba de la otra: la diferencia se ve. */}
        <div className="dos-barras" aria-hidden="true">
          <div className="barra esperado" style={{ width: `${avance.porEsperado}%` }} />
          <div className="barra real" style={{ width: `${avance.porReal}%` }} />
        </div>

        <p className="titular">{avance.titular}</p>
      </div>

      <h3>Las catorce etapas</h3>
      <p className="mini" style={{ marginTop: 0 }}>
        Tildá lo que el cliente ya tiene cerrado. Esto no sale de ningún dato ni de ningún
        documento: lo sabe quien estuvo en la sesión.
      </p>

      <ol className="las-etapas marcables">
        {filas.map(({ etapa, estado: calculado, hecha: guardada, elegida, porque }) => {
          const marca = hechos[`etapa:${etapa.clave}`]
          const hecha = recienTocadas[etapa.clave] ?? guardada
          const estado = hecha === guardada ? calculado : (hecha ? 'hecha' : 'debia_estar')
          return (
            <li className={`una-etapa ${estado}${elegida ? ' elegida' : ''}`} key={etapa.clave} title={porque}>
              <label>
                <input
                  type="checkbox" checked={hecha}
                  onChange={(e) => void marcarEtapa(etapa.clave, e.target.checked)}
                />
                <span className="num">{etapa.numero}</span>
                <div>
                  <span className="nombre">{nombreDeEtapa(etapa)}</span>
                  <span className="mini">
                    semana {etapa.desdeSemana}
                    {etapa.hastaSemana !== etapa.desdeSemana ? ` a ${etapa.hastaSemana}` : ''}
                    {estado === 'debia_estar' ? ' · ya tendría que estar' : ''}
                    {estado === 'es_la_de_ahora' ? ' · es la de esta semana' : ''}
                    {elegida ? ' · acá dice la consultora que está' : ''}
                    {marca ? ` · la marcó ${marca.quien ?? 'alguien'} el ${marca.hecho_en.split('-').reverse().join('/')}` : ''}
                  </span>
                </div>
              </label>
            </li>
          )
        })}
      </ol>

      <h3>Hitos clave</h3>
      <p className="mini" style={{ marginTop: 0 }}>
        Lo puntual que tiene que quedar hecho en cada fase. También lo marcás vos.
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
                  onChange={(e) => void marcarHito(h.clave, e.target.checked)}
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
