import Link from 'next/link'
import { TOTAL_BASE, TOTAL_CAMPOS } from '@/lib/campos'
import { QUE_DICE } from '@/lib/banderas-tipos'
import { quienMira } from '@/lib/quien-mira'
import { traerTablero } from '@/lib/tablero'

export const dynamic = 'force-dynamic'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export default async function Tablero() {
  // El layout ya frenó a quien no entró: acá sólo falta hasta dónde ve.
  const quien = await quienMira()
  const t = await traerTablero(quien?.alcance ?? { todo: false, consultoraId: null })
  const hoy = new Date()

  if (t.total === 0) {
    return (
      <>
        <header className="encabezado"><h1>Tablero</h1></header>
        <div className="tarjeta">
          <p style={{ margin: 0 }}>
            Todavía no hay ningún cliente cargado. <Link href="/importar">Subí el CSV de la planilla madre</Link>.
          </p>
        </div>
      </>
    )
  }

  const porcentaje = (n: number) => Math.round((n / t.total) * 100)

  return (
    <>
      <header className="encabezado">
        <h1>Tablero</h1>
        <p className="bajada">
          {MESES[hoy.getMonth()]} {hoy.getFullYear()} · {t.total} clientes en la cartera
        </p>
      </header>

      {/* A quién llamar sale de señales que puso o dijo una persona. Antes salía
          de «algo vencido», que daba el 89% de la cartera porque contaba como
          atraso del cliente lo que era trabajo nuestro sin cargar. */}
      <div className="tarjeta" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="rotulo">A quién hay que llamar esta semana</span>
          {t.graves > 0 ? <span className="chip mal">{porcentaje(t.graves)}% de la cartera</span> : null}
        </div>
        <div className={`cifra ${t.graves > 0 ? 'rojo' : 'verde'}`} style={{ fontSize: 44, marginTop: 6 }}>
          {t.graves} <span className="de">de {t.total}</span>
        </div>
        <div className="barra-progreso">
          <span className={t.graves > 0 ? 'mal' : 'bien'} style={{ width: `${porcentaje(t.graves)}%` }} />
        </div>
        <div className="pie">
          {t.graves === 0
            ? 'Nadie tiene una red flag levantada, una queja, ni un atraso real de tres semanas o más sobre las etapas marcadas.'
            : 'Una red flag levantada, una queja del cliente, o tres semanas o más de atraso sobre las etapas que alguien marcó.'}
          {' '}Cada uno dice por qué. <Link href="/clientes">Ver la lista</Link>.
        </div>
      </div>

      {/* El número que faltaba: de cuántos no se puede decir nada, y qué hacer
          al respecto. Antes esto estaba escondido adentro del rojo. */}
      {t.sinPoderMirar > 0 ? (
        <div className="tarjeta" style={{ marginBottom: 14 }}>
          <div className="rotulo">De cuántos no se puede decir nada todavía</div>
          <div className="cifra ambar" style={{ fontSize: 34, marginTop: 6 }}>
            {t.sinPoderMirar} <span className="de">de {t.total}</span>
          </div>
          <div className="pie">
            No están atrasados: <b>no sabemos</b>. Les falta cargado lo que ya venció, así que no hay
            con qué compararlos. Eso es trabajo nuestro, y se puede hacer hoy. De los que siguen en el
            programa, esto es lo que más falta:
          </div>
          {t.loQueFaltaCargar.length > 0 ? (
            <ul className="lo-que-falta">
              {t.loQueFaltaCargar.map((f) => (
                <li key={f.etiqueta}>
                  <b>{f.clientes}</b> {f.clientes === 1 ? 'cliente espera' : 'clientes esperan'} «{f.etiqueta.toLowerCase()}»
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="tarjeta" style={{ marginBottom: 14 }}>
        <div className="rotulo" style={{ marginBottom: 12 }}>Banderas levantadas</div>
        <div className="semaforo-cartera">
          {([
            ['roja', QUE_DICE.roja, t.banderas.roja],
            ['naranja', QUE_DICE.naranja, t.banderas.naranja],
            ['amarilla', QUE_DICE.amarilla, t.banderas.amarilla],
          ] as const).map(([color, palabra, cuantas]) => (
            <div key={color}>
              <span className={`semaforo bandera-${color}`}><i />{palabra}</span>
              <div className={`cifra ${cuantas === 0 ? 'apagado' : color === 'roja' ? 'rojo' : 'ambar'}`}>
                {cuantas} <span className="de">de {t.total}</span>
              </div>
            </div>
          ))}
        </div>
        {t.dijeron.quejas > 0 || t.dijeron.tibios > 0 ? (
          <p className="pie" style={{ marginTop: 12 }}>
            Además, de lo que se leyó en sesiones y encuestas:{' '}
            {t.dijeron.quejas > 0 ? (
              <b className="rojo">{t.dijeron.quejas} {t.dijeron.quejas === 1 ? 'cliente se quejó' : 'clientes se quejaron'} de nosotros</b>
            ) : null}
            {t.dijeron.quejas > 0 && t.dijeron.tibios > 0 ? ' y ' : null}
            {t.dijeron.tibios > 0 ? (
              <b className="ambar">{t.dijeron.tibios} {t.dijeron.tibios === 1 ? 'dijo' : 'dijeron'} algo de costado</b>
            ) : null}
            . Lo primero cuenta como grave; lo segundo es para mirar, no es grave.
          </p>
        ) : null}

        {t.losQueLevantaron.length > 0 ? (
          <ul className="con-bandera">
            {t.losQueLevantaron.map((b) => (
              <li key={b.id}>
                <Link href={`/clientes/${b.cliente_id}?bloque=atencion`} className={`punto ${b.color}`}>
                  {b.cliente}
                </Link>
                <span className="mini"> · {b.motivo}{b.consultora ? ` · ${b.consultora}` : ''}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="pie">
          Esto no lo calcula nadie: lo levanta una persona que estuvo en la sesión. Un cliente en verde
          con la bandera roja es exactamente el caso para el que existe.
        </div>
      </div>

      <div className="tarjeta" style={{ marginBottom: 14 }}>
        <div className="rotulo" style={{ marginBottom: 12 }}>Cómo va la cartera</div>
        <div className="semaforo-cartera">
          {([
            ['rojo', 'grave', t.porColor.rojo],
            ['naranja', 'atrasado', t.porColor.naranja],
            ['amarillo', 'para mirar', t.porColor.amarillo],
            ['verde', 'en tiempo', t.porColor.verde],
            ['azul', 'terminaron', t.porColor.azul],
            ['gris', 'sin datos', t.porColor.gris],
          ] as const).map(([color, palabra, cuantos]) => (
            <div key={color}>
              <span className={`semaforo ${color}`}><i />{palabra}</span>
              <div className={`cifra ${color === 'gris' ? 'apagado' : color === 'amarillo' || color === 'naranja' ? 'ambar' : color}`}>
                {cuantos} <span className="de">de {t.total}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="pie">
          «Sin datos» no es «en tiempo»: son clientes de los que todavía no se puede afirmar nada.
          Separarlos es todo: mezclados, el tablero decía que el 89% de la cartera necesitaba una llamada.
        </div>
      </div>

      <div className="rejilla">
        <div className="tarjeta">
          <div className="rotulo">Se pasaron del programa</div>
          <div className={`cifra ${t.sePasaron > 0 ? 'ambar' : ''}`}>
            {t.sePasaron} <span className="de">de {t.total}</span>
          </div>
          <div className="pie">Van por una semana más alta que la que dura lo que compraron.</div>
        </div>

        {/* Los datos base, no los 95. «Les faltan 9.450 datos» no es una tarea:
            es una pared, y encima hace pensar que sin los 95 no se puede
            analizar nada, que es falso. */}
        <div className="tarjeta">
          <div className="rotulo">Con los datos base completos</div>
          <div className={`cifra ${t.conBaseCompleta === t.total ? 'verde' : 'ambar'}`}>
            {t.conBaseCompleta} <span className="de">de {t.total}</span>
          </div>
          <div className="pie">
            Son los {TOTAL_BASE} datos con los que la aplicación saca cuentas. Faltan{' '}
            {t.faltanBase.toLocaleString('es-AR')} en total. Los otros {TOTAL_CAMPOS - TOTAL_BASE} suman al
            caso, pero no hacen falta para analizarlo.
          </div>
        </div>


      </div>

      <div className="bloques">
        <section className="tarjeta">
          <h2>Por consultora</h2>
          <table>
            <thead>
              <tr>
                <th>Consultora</th>
                <th className="num">Clientes</th>
                <th className="num">Graves</th>
                <th className="num">Sin poder mirar</th>
              </tr>
            </thead>
            <tbody>
              {t.porConsultora.map((c) => (
                <tr key={c.nombre}>
                  <td>{c.nombre}</td>
                  <td className="num">{c.clientes}</td>
                  <td className={`num ${c.graves > 0 ? 'rojo' : 'apagado'}`}>{c.graves}</td>
                  <td className={`num ${c.sinPoderMirar > 0 ? 'ambar' : 'apagado'}`}>{c.sinPoderMirar}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {t.sinFuente.length > 0 ? (
          <section className="tarjeta">
            <h2>Qué no se puede medir todavía</h2>
            <dl>
              {t.sinFuente.map((f) => (
                <div className="dato" key={f.fuente}>
                  <dt>{f.etiqueta}</dt>
                  <dd className="apagado">
                    {f.hitos} {f.hitos === 1 ? 'hito no se puede' : 'hitos no se pueden'} contestar sin esto
                  </dd>
                </div>
              ))}
            </dl>
            <p className="pie" style={{ marginTop: 12 }}>
              Mientras una de estas no esté cargada en ninguna parte de la cartera, sus hitos dicen
              «sin datos» y no «falta». Un tablero que afirma que un cliente no vendió cuando nadie
              cargó las ventas acierta por la razón equivocada.
            </p>
          </section>
        ) : null}
      </div>
    </>
  )
}
