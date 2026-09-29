'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { marcarEtapaDelPrograma, marcarHitoClave } from '@/app/(app)/clientes/[id]/acciones'
import type { Avance, FilaDeEtapa } from '@/lib/avance'
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
  clienteId, avance, filas, hechos,
}: {
  clienteId: number
  avance: Avance
  filas: FilaDeEtapa[]
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
    setRecienTocadas((antes) => ({ ...antes, [clave]: hecho }))
    const r = await marcarHitoClave(clienteId, clave, hecho)
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
        documento: lo sabe quien estuvo en la sesión. Una etapa con hitos adentro se da por
        hecha cuando están todos marcados.
      </p>

      <ol className="las-etapas marcables">
        {filas.map(({ etapa, estado, hecha, marcadaAMano, hitosHechos, elegida, porque }) => {
          const marca = hechos[`etapa:${etapa.clave}`]
          const tiene = etapa.hitosClave.length
          return (
            <li className={`una-etapa ${estado}${elegida ? ' elegida' : ''}`} key={etapa.clave} title={porque}>
              <label>
                <input
                  type="checkbox" checked={hecha}
                  // Una etapa completa por sus hitos no se destilda desde acá:
                  // se destilda el hito que corresponda, que es donde está el dato.
                  disabled={tocando === etapa.clave || (hecha && !marcadaAMano)}
                  onChange={(e) => void marcarEtapa(etapa.clave, e.target.checked)}
                />
                <span className="num">{etapa.numero}</span>
                <div>
                  <span className="nombre">{nombreDeEtapa(etapa)}</span>
                  <span className="mini">
                    semana {etapa.desdeSemana}
                    {etapa.hastaSemana !== etapa.desdeSemana ? ` a ${etapa.hastaSemana}` : ''}
                    {tiene > 0 ? ` · ${hitosHechos} de ${tiene} hitos` : ''}
                    {estado === 'debia_estar' ? ' · ya tendría que estar' : ''}
                    {estado === 'es_la_de_ahora' ? ' · es la de esta semana' : ''}
                    {elegida ? ' · acá dice la consultora que está' : ''}
                    {hecha && !marcadaAMano ? ' · hecha porque están todos sus hitos' : ''}
                    {marca ? ` · la marcó ${marca.quien ?? 'alguien'} el ${marca.hecho_en.split('-').reverse().join('/')}` : ''}
                  </span>
                </div>
              </label>

              {/* Los hitos de la etapa, adentro de la etapa. Antes eran una lista
                  aparte agrupada por fase, y marcar uno no movía el avance. */}
              {tiene > 0 ? (
                <div className="hitos-de-la-etapa">
                  {etapa.hitosClave.map((h) => {
                    const hecho = hechos[h.clave]
                    const tildado = recienTocadas[h.clave] ?? Boolean(hecho)
                    return (
                      <label className={`hito-clave ${tildado ? 'hecho' : ''}`} key={h.clave}>
                        <input
                          type="checkbox" checked={tildado}
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
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
