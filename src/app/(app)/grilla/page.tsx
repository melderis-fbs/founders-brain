import Link from 'next/link'
import { Semaforo } from '@/componentes/Semaforo'
import type { EstadoHito } from '@/lib/hitos'
import { HITOS } from '@/lib/hitos'
import { listarConsultoras } from '@/lib/clientes'
import { quienMira } from '@/lib/quien-mira'
import { SEMANAS_CON_HITOS, traerGrilla, type ClienteEnGrilla } from '@/lib/grilla'
import {
  etapasDeLaSemana, ETAPAS, ETAPA_POR_CLAVE, faseDeLaSemana, nombreDeEtapa, type ClaveEtapa,
} from '@/lib/modulos'

export const dynamic = 'force-dynamic'

const COLUMNAS: string[] = [...ETAPAS.map((e) => e.clave), 'termino', 'sin_fecha']

export default async function Grilla({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; consultora?: string }>
}) {
  const { vista, consultora } = await searchParams
  const enKanban = vista !== 'semanas'
  const consultoraId = consultora ? Number(consultora) : null
  const quien = await quienMira()
  const [clientes, consultoras] = await Promise.all([
    traerGrilla(quien?.alcance ?? { todo: false, consultoraId: null }, { consultoraId }),
    listarConsultoras(),
  ])

  if (clientes.length === 0) {
    return (
      <>
        <header className="encabezado"><h1>La grilla</h1></header>
        <div className="tarjeta"><p style={{ margin: 0 }}>Todavía no hay clientes. <Link href="/importar">Cargá la planilla</Link>.</p></div>
      </>
    )
  }

  return (
    <>
      <header className="encabezado">
        <h1>La grilla</h1>
        <p className="bajada">
          {enKanban
            ? 'Cada cliente en la etapa donde tendría que estar a esta altura del programa. El color dice si llegó o no; la carta, dónde se corta.'
            : 'Qué pasó con lo que vencía en cada semana. Las columnas son sólo las semanas en las que el método espera algo.'}
        </p>
      </header>

      <form className="filtros" method="get">
        <Link className={`boton ${enKanban ? '' : 'suave'}`} href={consultoraId ? `/grilla?consultora=${consultoraId}` : '/grilla'}>Por etapa</Link>
        <Link className={`boton ${enKanban ? 'suave' : ''}`} href={`/grilla?vista=semanas${consultoraId ? `&consultora=${consultoraId}` : ''}`}>Por semanas</Link>
        {enKanban ? null : <input type="hidden" name="vista" value="semanas" />}
        <div className="campo" style={{ marginLeft: 10 }}>
          <label htmlFor="consultora">Consultora</label>
          <select id="consultora" name="consultora" defaultValue={consultora ?? ''}>
            <option value="">Todas</option>
            {consultoras.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.clientes}</option>)}
          </select>
        </div>
        <button className="boton suave" type="submit">Filtrar</button>
      </form>

      {enKanban ? <Kanban clientes={clientes} /> : <PorSemanas clientes={clientes} />}
    </>
  )
}

function Kanban({ clientes }: { clientes: ClienteEnGrilla[] }) {
  return (
    <div className="kanban">
      {COLUMNAS.map((columna) => {
        const suyos = clientes.filter((c) => c.columna === columna)
        return (
          <section className="columna" key={columna}>
            <header>
              <span className="titulo">
                {columna === 'sin_fecha' ? 'Sin fecha de inicio'
                  : columna === 'termino' ? 'Se le terminó el programa'
                  : ETAPA_POR_CLAVE.get(columna as ClaveEtapa)!.nombre}
              </span>
              <span className={`cuantos ${suyos.length === 0 ? 'apagado' : ''}`}>{suyos.length}</span>
              {columna === 'sin_fecha' ? (
                <div className="pregunta">No se puede comparar contra nada hasta que se cargue el inicio.</div>
              ) : columna === 'termino' ? (
                <div className="pregunta">Pasaron las 16 semanas.</div>
              ) : (
                <div className="pregunta">
                  semana {ETAPA_POR_CLAVE.get(columna as ClaveEtapa)!.desdeSemana}
                  {ETAPA_POR_CLAVE.get(columna as ClaveEtapa)!.hastaSemana !== ETAPA_POR_CLAVE.get(columna as ClaveEtapa)!.desdeSemana
                    ? ` a ${ETAPA_POR_CLAVE.get(columna as ClaveEtapa)!.hastaSemana}` : ''}
                </div>
              )}
              {suyos.length > 0 ? (
                <div className="cuantos-llegaron">
                  {(() => {
                    const bien = suyos.filter((c) => c.semaforo.color === 'verde').length
                    const gris = suyos.filter((c) => c.semaforo.color === 'gris').length
                    const mal = suyos.length - bien - gris
                    return `${bien} ${bien === 1 ? 'llegó' : 'llegaron'} · ${mal} no${gris > 0 ? ` · ${gris} sin datos` : ''}`
                  })()}
                </div>
              ) : null}
            </header>
            <div className="cartas">
              {suyos.length === 0 ? <p className="apagado mini" style={{ padding: '4px 2px' }}>Ninguno.</p> : null}
              {suyos.map((c) => (
                <Link className={`carta ${c.semaforo.color}`} key={c.id} href={`/clientes/${c.id}`} title={c.semaforo.porque}>
                  <div className="nombre">{c.nombre}</div>
                  <div className="mini">
                    {c.semana === null ? 'sin fecha de inicio' : `semana ${c.semana}${c.totalSemanas ? ` de ${c.totalSemanas}` : ''}`}
                    {c.consultora ? ` · ${c.consultora}` : ''}
                  </div>
                  <div className="necesita">{c.necesita}</div>
                  {c.etapaElegida ? <div className="mini se-corta">la eligió la consultora</div> : null}
                  {c.seCortaEn !== null ? (
                    <div className="mini se-corta">se corta en la fase {c.seCortaEn}</div>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function PorSemanas({ clientes }: { clientes: ClienteEnGrilla[] }) {
  const ordenados = clientes
  const queVence = (semana: number) => {
    const fase = faseDeLaSemana(semana)
    const hitos = HITOS.filter((h) => h.semana === semana).map((h) => h.etiqueta)
    return [
      fase ? `Fase ${fase.numero} · ${fase.periodo}` : null,
      ...etapasDeLaSemana(semana).map(nombreDeEtapa),
      hitos.length > 0 ? `Vence: ${hitos.join(' · ')}` : null,
    ].filter(Boolean).join('\n')
  }

  return (
    <>
      <div className="referencias mini">
        <span><i className="celda hecho" /> hecho</span>
        <span><i className="celda falta" /> falta</span>
        <span><i className="celda esta_semana" /> es de esta semana</span>
        <span><i className="celda todavia_no" /> todavía no le toca</span>
        <span><i className="celda sin_datos" /> sin datos para saberlo</span>
      </div>
      <div className="tabla-marco">
        <table className="grilla-semanas">
          <thead>
            <tr>
              <th className="pegada">Cliente</th>
              <th>Va en</th>
              <th>Estado</th>
              {SEMANAS_CON_HITOS.map((s) => (
                <th key={s} className="num semana-col" title={queVence(s)}>
                  {s}
                  {faseDeLaSemana(s) ? <i>fase {faseDeLaSemana(s)!.numero}</i> : null}
                </th>
              ))}
              <th className="sobrante" />
            </tr>
          </thead>
          <tbody>
            {ordenados.map((c) => (
              <tr key={c.id}>
                <td className="pegada"><Link className="nombre-cliente" href={`/clientes/${c.id}`}>{c.nombre}</Link></td>
                <td className="semana mini">{c.semana === null ? 'sin inicio' : `sem ${c.semana}`}</td>
                <td><Semaforo estado={c.semaforo} /></td>
                {SEMANAS_CON_HITOS.map((s) => (
                  <td key={s} className="celda-td">
                    <i className={`celda ${c.porSemana[s]}`} title={`Semana ${s} · ${queVence(s)} · ${enPalabras(c.porSemana[s])}`} />
                  </td>
                ))}
                <td className="sobrante" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function enPalabras(estado: EstadoHito): string {
  if (estado === 'hecho') return 'hecho'
  if (estado === 'falta') return 'falta'
  if (estado === 'esta_semana') return 'es de esta semana, todavía está a tiempo'
  if (estado === 'todavia_no') return 'todavía no le toca'
  return 'sin datos para saberlo'
}
