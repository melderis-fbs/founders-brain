import Link from 'next/link'
import { Etapas } from '@/componentes/Comparacion'
import { ESTADOS, TOTAL_CAMPOS } from '@/lib/campos'
import { fuentesDeLaCartera, listarClientes, listarConsultoras } from '@/lib/clientes'
import { dondeSeCorta, estadoDeEtapas, evaluarHitos, queNecesita } from '@/lib/hitos'
import { semanaEnLaQueVa, seLePasoElPrograma, textoDeSemana } from '@/lib/programa'

export const dynamic = 'force-dynamic'

export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<{ consultora?: string; estado?: string; buscar?: string }>
}) {
  const { consultora, estado, buscar } = await searchParams
  const consultoraId = consultora ? Number(consultora) : null

  const [clientes, consultoras, conDatos] = await Promise.all([
    listarClientes({ consultoraId, estado: estado || null, buscar: buscar || null }),
    listarConsultoras(),
    fuentesDeLaCartera(),
  ])

  const filas = clientes.map((c) => {
    const semana = semanaEnLaQueVa(c.fechaInicio)
    const evaluados = evaluarHitos({
      semana,
      valores: c.presencia,
      tiposDeDocumento: new Set(c.tieneOnboarding ? ['onboarding'] : []),
      conDatos,
    })
    const corte = dondeSeCorta(evaluados)
    return {
      cliente: c,
      semana,
      evaluados,
      etapas: estadoDeEtapas(evaluados),
      atraso: corte?.atrasoEnSemanas ?? -1,
      necesita: queNecesita(evaluados, c.faltan),
    }
  })

  // Primero a quién hay que llamar: el más atrasado. Después, el más incompleto.
  filas.sort((a, b) => b.atraso - a.atraso || b.cliente.faltan.length - a.cliente.faltan.length)

  return (
    <>
      <header className="encabezado">
        <h1>Clientes</h1>
        <p className="bajada">
          {clientes.length === 0
            ? (buscar ? `Ningún cliente coincide con «${buscar}».` : 'Todavía no hay ninguno cargado.')
            : `${clientes.length} ${consultoraId || estado || buscar ? 'con este filtro' : 'en la cartera'} · ordenados por quién necesita atención primero`}
        </p>
      </header>

      <form className="filtros" method="get">
        <div className="campo">
          <label htmlFor="consultora">Consultora</label>
          <select id="consultora" name="consultora" defaultValue={consultora ?? ''}>
            <option value="">Todas</option>
            {consultoras.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.clientes}</option>)}
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
        {buscar ? <input type="hidden" name="buscar" value={buscar} /> : null}
        {consultora || estado || buscar ? <Link className="boton suave" href="/clientes">Limpiar</Link> : null}
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
                <th>Etapas</th>
                <th>Estado</th>
                <th>Qué necesita</th>
                <th className="num">Datos</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ cliente: c, etapas, necesita, atraso }) => (
                <tr key={c.id}>
                  <td><Link className="nombre-cliente" href={`/clientes/${c.id}`}>{c.nombre}</Link></td>
                  <td className={c.consultora ? undefined : 'apagado'}>{c.consultora ?? 'sin asignar'}</td>
                  <td className={`semana ${seLePasoElPrograma(c.fechaInicio, c.programaMeses) ? 'rojo' : c.fechaInicio ? '' : 'apagado'}`}>
                    {textoDeSemana(c.fechaInicio, c.programaMeses)}
                  </td>
                  <td><Etapas estados={etapas} /></td>
                  <td>{c.estado ? <span className={`chip ${c.estado}`}>{c.estado}</span> : <span className="apagado">sin estado</span>}</td>
                  <td className={atraso >= 0 ? 'rojo' : undefined}>{necesita}</td>
                  <td className="num mini" title={c.faltan.map((f) => f.etiqueta.toLowerCase()).join(', ')}>
                    {c.faltan.length === 0 ? <span className="verde">completa</span> : `faltan ${c.faltan.length} de ${TOTAL_CAMPOS}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
