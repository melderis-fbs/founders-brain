import Link from 'next/link'
import { ClienteNuevo } from '@/componentes/ClienteNuevo'
import { Etapas } from '@/componentes/Comparacion'
import { TablaDeClientes } from '@/componentes/TablaDeClientes'
import { ESTADOS, TOTAL_CAMPOS } from '@/lib/campos'
import { fuentesDeLaCartera, listarClientes, listarConsultoras } from '@/lib/clientes'
import { sinConsultoraAsignada } from '@/lib/permisos'
import { quienMira } from '@/lib/quien-mira'
import { dondeSeCorta, estadoDeEtapas, evaluarHitos, queNecesita } from '@/lib/hitos'
import { semaforoDe } from '@/lib/semaforo'
import { semanaEnLaQueVa, seLePasoElPrograma, textoDeSemana } from '@/lib/programa'

export const dynamic = 'force-dynamic'

export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<{ consultora?: string; estado?: string; buscar?: string }>
}) {
  const { consultora, estado, buscar } = await searchParams
  // «sin» es su propio filtro: los clientes que no tienen consultora asignada
  // son justo los que hay que repartir, y sin esto no hay forma de juntarlos.
  const sinConsultora = consultora === 'sin'
  const consultoraId = consultora && !sinConsultora ? Number(consultora) : null

  const quien = await quienMira()
  const alcance = quien?.alcance ?? { todo: false as const, consultoraId: null }
  const esAdmin = alcance.todo
  const sinAsignar = sinConsultoraAsignada(alcance)

  const [clientes, consultoras, conDatos] = await Promise.all([
    listarClientes(alcance, { consultoraId, sinConsultora, estado: estado || null, buscar: buscar || null }),
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
      semaforo: semaforoDe(evaluados),
      atraso: corte?.atrasoEnSemanas ?? -1,
      necesita: queNecesita(evaluados, c.faltan),
    }
  })

  // Primero a quién hay que llamar: el más atrasado. Después, el más incompleto.
  filas.sort((a, b) => b.atraso - a.atraso || b.cliente.faltan.length - a.cliente.faltan.length)

  return (
    <>
      <header className="encabezado" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
        <h1>Clientes</h1>
        <p className="bajada">
          {clientes.length === 0
            ? (buscar ? `Ningún cliente coincide con «${buscar}».` : 'Todavía no hay ninguno cargado.')
            : `${clientes.length} ${consultoraId || estado || buscar ? 'con este filtro' : 'en la cartera'} · ordenados por quién necesita atención primero`}
        </p>
        </div>
        <ClienteNuevo consultoras={consultoras} />
      </header>

      <form className="filtros" method="get">
        {esAdmin ? (
          <div className="campo">
            <label htmlFor="consultora">Consultora</label>
            <select id="consultora" name="consultora" defaultValue={consultora ?? ''}>
              <option value="">Todas</option>
              <option value="sin">— sin consultora —</option>
              {consultoras.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.clientes}</option>)}
            </select>
          </div>
        ) : null}
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
            {sinAsignar
              ? 'Todavía no te asignaron una consultora, así que todavía no ves ningún cliente. No es que no haya: es que falta asignarte. Pedíselo a quien administra.'
              : buscar
                ? 'Ningún cliente coincide con lo que buscaste.'
                : esAdmin
                  ? <>Todavía no entró ningún cliente. <Link href="/importar">Subí el CSV de la planilla madre</Link>, o cargá uno a mano con «Cliente nuevo».</>
                  : 'Todavía no hay ningún cliente tuyo cargado. Cargá uno con «Cliente nuevo».'}
          </p>
        </div>
      ) : (
        <TablaDeClientes
          puedeAsignar={esAdmin}
          consultoras={consultoras.map((c) => ({ id: c.id, nombre: c.nombre }))}
          filas={filas.map(({ cliente: c, etapas, necesita, atraso, semaforo }) => ({
            id: c.id,
            nombre: c.nombre,
            consultora: c.consultora,
            estado: c.estado,
            fechaInicio: c.fechaInicio,
            programaMeses: c.programaMeses,
            faltan: c.faltan.length,
            queFalta: c.faltan.map((f) => f.etiqueta.toLowerCase()).join(', '),
            etapas,
            semaforo,
            atraso,
            necesita,
          }))}
        />
      )}
    </>
  )
}
