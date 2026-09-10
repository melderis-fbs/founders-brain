import Link from 'next/link'
import { TOTAL_CAMPOS } from '@/lib/campos'
import { traerTablero } from '@/lib/tablero'

export const dynamic = 'force-dynamic'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export default async function Tablero() {
  const t = await traerTablero()
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

      <div className="tarjeta" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="rotulo">A quién hay que llamar</span>
          {t.conAtraso > 0 ? <span className="chip mal">{porcentaje(t.conAtraso)}% de la cartera</span> : null}
        </div>
        <div className={`cifra ${t.conAtraso > 0 ? 'rojo' : 'verde'}`} style={{ fontSize: 44, marginTop: 6 }}>
          {t.conAtraso} <span className="de">de {t.total}</span>
        </div>
        <div className="barra-progreso">
          <span className={t.conAtraso > 0 ? 'mal' : 'bien'} style={{ width: `${porcentaje(t.conAtraso)}%` }} />
        </div>
        <div className="pie">
          Clientes con algo vencido de lo que tendría que estar hecho a esta altura del programa.
          {' '}<Link href="/clientes">Ver la lista, ordenada por quién primero</Link>.
        </div>
      </div>

      <div className="tarjeta" style={{ marginBottom: 14 }}>
        <div className="rotulo" style={{ marginBottom: 12 }}>Cómo va la cartera</div>
        <div className="semaforo-cartera">
          {([
            ['rojo', 'grave', t.porColor.rojo],
            ['amarillo', 'atrasado', t.porColor.amarillo],
            ['verde', 'en tiempo', t.porColor.verde],
            ['gris', 'sin datos', t.porColor.gris],
          ] as const).map(([color, palabra, cuantos]) => (
            <div key={color}>
              <span className={`semaforo ${color}`}><i />{palabra}</span>
              <div className={`cifra ${color === 'gris' ? 'apagado' : color === 'amarillo' ? 'ambar' : color}`}>
                {cuantos} <span className="de">de {t.total}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="pie">
          «Sin datos» no es «en tiempo»: son clientes de los que todavía no se puede afirmar nada.
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

        <div className="tarjeta">
          <div className="rotulo">Fichas a medias</div>
          <div className={`cifra ${t.fichasAMedias > 0 ? 'ambar' : 'verde'}`}>
            {t.fichasAMedias} <span className="de">de {t.total}</span>
          </div>
          <div className="pie">Les faltan {t.datosQueFaltan.toLocaleString('es-AR')} datos en total, sobre {TOTAL_CAMPOS} por cliente.</div>
        </div>

        <div className="tarjeta">
          <div className="rotulo">Dónde se corta la mayoría</div>
          {t.corteMasComun ? (
            <>
              <div className="cifra rojo">
                {t.corteMasComun.cuantos} <span className="de">clientes</span>
              </div>
              <div className="pie">
                En «{t.corteMasComun.etiqueta.toLowerCase()}», que vencía en la semana {t.corteMasComun.semana}.
                Cuando se corta el mismo lugar en tantos, suele ser el programa y no el cliente.
              </div>
            </>
          ) : (
            <>
              <div className="cifra apagado">—</div>
              <div className="pie">Nadie tiene vencido nada de lo que hoy se puede medir.</div>
            </>
          )}
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
                <th className="num">Con atraso</th>
                <th className="num">Fichas a medias</th>
              </tr>
            </thead>
            <tbody>
              {t.porConsultora.map((c) => (
                <tr key={c.nombre}>
                  <td>{c.nombre}</td>
                  <td className="num">{c.clientes}</td>
                  <td className={`num ${c.conAtraso > 0 ? 'rojo' : 'apagado'}`}>{c.conAtraso}</td>
                  <td className={`num ${c.fichasAMedias > 0 ? 'ambar' : 'apagado'}`}>{c.fichasAMedias}</td>
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
