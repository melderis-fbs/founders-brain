import Link from 'next/link'
import { TOTAL_CAMPOS } from '@/lib/campos'
import { listarClientes, listarConsultoras } from '@/lib/clientes'
import { ESTADOS } from '@/lib/campos'
import { seLePasoElPrograma, textoDeSemana } from '@/lib/programa'

export const dynamic = 'force-dynamic'

export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<{ consultora?: string; estado?: string }>
}) {
  const { consultora, estado } = await searchParams
  const consultoraId = consultora ? Number(consultora) : null

  const [clientes, consultoras] = await Promise.all([
    listarClientes({ consultoraId, estado: estado || null }),
    listarConsultoras(),
  ])

  // Arriba, quien más incompleto está: hoy es la razón más concreta para llamar
  // a alguien. Cuando esté el paso 3, este orden lo manda el atraso.
  const ordenados = [...clientes].sort((a, b) => b.faltan.length - a.faltan.length || a.nombre.localeCompare(b.nombre))

  return (
    <>
      <div className="titulo-fila">
        <h1>Clientes</h1>
        <span className="cuenta">
          {clientes.length === 0 ? 'ninguno cargado todavía' : `${clientes.length} de ${consultoraId || estado ? 'los filtrados' : 'la cartera'}`}
        </span>
      </div>

      <form className="filtros" method="get">
        <div className="campo">
          <label htmlFor="consultora">Consultora</label>
          <select id="consultora" name="consultora" defaultValue={consultora ?? ''}>
            <option value="">Todas</option>
            {consultoras.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} · {c.clientes}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue={estado ?? ''}>
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <button className="boton suave" type="submit">Filtrar</button>
        {consultora || estado ? <Link className="boton suave" href="/clientes">Limpiar</Link> : null}
      </form>

      {clientes.length === 0 ? (
        <div className="tarjeta">
          <p style={{ margin: 0 }}>
            Todavía no entró ningún cliente. <Link href="/importar">Subí el CSV de la planilla madre</Link>.
          </p>
        </div>
      ) : (
        <div className="tabla-marco">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Consultora</th>
                <th>Va en</th>
                <th>Estado</th>
                <th className="num">Docs</th>
                <th>Qué le falta</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((c) => {
                const semana = textoDeSemana(c.fechaInicio, c.programaMeses)
                const pasado = seLePasoElPrograma(c.fechaInicio, c.programaMeses)
                const nombres = c.faltan.map((f) => f.etiqueta.toLowerCase())
                return (
                  <tr key={c.id}>
                    <td>
                      <Link className="nombre-cliente" href={`/clientes/${c.id}`}>{c.nombre}</Link>
                    </td>
                    <td className={c.consultora ? undefined : 'apagado'}>{c.consultora ?? 'sin asignar'}</td>
                    <td className={pasado ? 'pasado' : c.fechaInicio ? undefined : 'apagado'}>{semana}</td>
                    <td>
                      {c.estado
                        ? <span className={`marca-estado ${c.estado}`}>{c.estado}</span>
                        : <span className="apagado">sin estado</span>}
                    </td>
                    <td className="num">{c.documentos === 0 ? <span className="apagado">0</span> : c.documentos}</td>
                    <td title={nombres.join(', ')}>
                      {nombres.length === 0 ? (
                        <span className="apagado">nada, la ficha está completa</span>
                      ) : (
                        <span className="faltan-lista">
                          faltan <b>{nombres.length} de {TOTAL_CAMPOS}</b>: {nombres.slice(0, 3).join(', ')}
                          {nombres.length > 3 ? ` y ${nombres.length - 3} más` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
