import type { HitoEvaluado } from '@/lib/hitos'
import { ETAPAS, ETIQUETA_ETAPA, PREGUNTA_ETAPA, type Etapa } from '@/lib/hitos'

/**
 * Las cinco fases del negocio, cada una con su pregunta.
 *
 * El programa se mide en semanas; esto se mide en preguntas. Un cliente puede
 * ir en la semana 14 y seguir sin contestar «¿qué vende, a quién y por
 * cuánto?», y eso es más importante que la semana en la que va.
 *
 * La fase donde está es la primera que todavía no cerró, no la que le tocaría
 * por calendario.
 */
export function Fases({ evaluados }: { evaluados: HitoEvaluado[] }) {
  const dondeEsta = ETAPAS.find((etapa) =>
    evaluados.some((e) => e.hito.etapa === etapa && e.estado !== 'hecho'),
  ) ?? null

  return (
    <div className="fases">
      <p className="mini" style={{ marginTop: 0 }}>
        Las etapas se miden por lo que está contestado, no por la semana en la que va.
      </p>

      {ETAPAS.map((etapa) => {
        const suyos = evaluados.filter((e) => e.hito.etapa === etapa)
        if (suyos.length === 0) return null
        const hechos = suyos.filter((e) => e.estado === 'hecho').length
        const evaluables = suyos.filter((e) => e.estado !== 'sin_datos').length

        return (
          <section className={`fase ${dondeEsta === etapa ? 'donde-esta' : ''}`} key={etapa}>
            <header>
              <div>
                <h3>{ETIQUETA_ETAPA[etapa]}</h3>
                <span className="pregunta">{PREGUNTA_ETAPA[etapa]}</span>
              </div>
              <span className="cuenta">
                {hechos} de {evaluables}
                {evaluables < suyos.length ? <i> · {suyos.length - evaluables} sin datos</i> : null}
              </span>
            </header>

            <div className="hitos">
              {suyos.map((e) => <UnHito key={e.hito.clave} e={e} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function UnHito({ e }: { e: HitoEvaluado }) {
  const cuando =
    e.estado === 'hecho' ? 'hecho'
    : e.estado === 'falta' ? `falta hace ${e.atrasoEnSemanas} ${e.atrasoEnSemanas === 1 ? 'semana' : 'semanas'}`
    : e.estado === 'todavia_no' ? `le toca en la semana ${e.hito.semana}`
    : `sin datos · ${e.porQueNoSeSabe}`

  return (
    <div className={`hito ${e.estado}`}>
      <span className="marca" aria-hidden />
      <div>
        <span className="que">
          {e.hito.etiqueta}
          {e.hito.bloquea ? <b className="traba" title="Sin esto, lo que viene después no se le puede exigir">traba</b> : null}
        </span>
        <span className="cuando">semana {e.hito.semana} · {cuando}</span>
      </div>
    </div>
  )
}
