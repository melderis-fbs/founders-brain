import Link from 'next/link'
import { Semaforo } from '@/componentes/Semaforo'
import { ETAPAS, ETIQUETA_ETAPA, PREGUNTA_ETAPA, type EstadoHito } from '@/lib/hitos'
import { HITOS } from '@/lib/hitos'
import { listarConsultoras } from '@/lib/clientes'
import { SEMANAS_CON_HITOS, traerGrilla, type ClienteEnGrilla } from '@/lib/grilla'
import { ETIQUETA_COLUMNA } from '@/lib/semaforo'

export const dynamic = 'force-dynamic'

const COLUMNAS = [...ETAPAS, 'al_dia', 'sin_datos'] as const

export default async function Grilla({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; consultora?: string }>
}) {
  const { vista, consultora } = await searchParams
  const enKanban = vista !== 'semanas'
  const consultoraId = consultora ? Number(consultora) : null
  const [clientes, consultoras] = await Promise.all([
    traerGrilla({ consultoraId }),
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
            ? 'Cada cliente en la etapa donde se corta. Si muchos se amontonan en la misma, suele ser el programa y no el cliente.'
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
              <span className="titulo">{ETIQUETA_COLUMNA[columna]}</span>
              <span className={`cuantos ${suyos.length === 0 ? 'apagado' : ''}`}>{suyos.length}</span>
              {columna in PREGUNTA_ETAPA ? (
                <div className="pregunta">{PREGUNTA_ETAPA[columna as keyof typeof PREGUNTA_ETAPA]}</div>
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
  const queVence = (semana: number) => HITOS.filter((h) => h.semana === semana).map((h) => h.etiqueta).join(' · ')

  return (
    <>
      <div className="referencias mini">
        <span><i className="celda hecho" /> hecho</span>
        <span><i className="celda falta" /> falta</span>
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
                <th key={s} className="num" title={queVence(s)}>{s}</th>
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
  if (estado === 'todavia_no') return 'todavía no le toca'
  return 'sin datos para saberlo'
}
