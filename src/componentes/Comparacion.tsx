import { dondeSeCorta, type EstadoHito, type HitoEvaluado } from '@/lib/hitos'
import { FASES } from '@/lib/modulos'

/**
 * Las cuatro fases del programa, dibujadas. Para escanear una fila.
 *
 * Son las fases y no las catorce etapas a propósito: catorce puntitos en una
 * fila no se escanean, se leen de a uno, y entonces dejan de servir para lo
 * único que sirven, que es ver de un vistazo dónde se cortó.
 */
export function Etapas({ estados }: { estados: Record<string, EstadoHito> }) {
  return (
    <span className="etapas">
      {FASES.map((f) => (
        <i
          key={f.numero} className={estados[f.numero]}
          title={`Fase ${f.numero} · ${f.periodo}: ${enPalabras(estados[f.numero])}`}
        />
      ))}
    </span>
  )
}

function enPalabras(estado: EstadoHito): string {
  if (estado === 'hecho') return 'hecho'
  if (estado === 'falta') return 'falta'
  if (estado === 'esta_semana') return 'es de esta semana'
  if (estado === 'todavia_no') return 'todavía no le toca'
  return 'sin datos para saberlo'
}

/**
 * Lo que tendría que estar hecho, contra lo que está.
 *
 * Es la pantalla entera de la aplicación resumida: la diferencia se ve, no se
 * calcula en la cabeza de nadie.
 */
export function Comparacion({
  evaluados, suelto = false,
}: {
  evaluados: readonly HitoEvaluado[]
  /** Dentro de una pestaña ya hay una tarjeta: no hace falta otra. */
  suelto?: boolean
}) {
  const corte = dondeSeCorta(evaluados)
  const seSabeAlgo = evaluados.some((e) => e.estado !== 'sin_datos')

  return (
    <div className={suelto ? undefined : 'tarjeta'}>
      <h2>Lo que tendría que estar hecho, y lo que está</h2>
      <div className="comparacion">
        {evaluados.map(({ hito, estado, atrasoEnSemanas, porQueNoSeSabe }) => (
          <div key={hito.clave} className={`linea ${estado} ${hito.bloquea ? 'bloquea' : ''}`}>
            <span className="que">{hito.etiqueta}</span>
            <span className="cuando">semana {hito.semana}</span>
            <span className={`como ${color(estado)}`} title={porQueNoSeSabe}>
              {estado === 'hecho' ? '✓ hecho' : null}
              {estado === 'falta'
                ? `✗ falta hace ${atrasoEnSemanas} ${atrasoEnSemanas === 1 ? 'semana' : 'semanas'}`
                : null}
              {estado === 'esta_semana' ? 'es de esta semana' : null}
              {estado === 'todavia_no' ? 'todavía no le toca' : null}
              {estado === 'sin_datos' ? 'sin datos' : null}
            </span>
          </div>
        ))}
      </div>

      {corte ? (
        <div className="corte">Se cortó en: {corte.hito.etiqueta.toLowerCase()}.</div>
      ) : seSabeAlgo ? (
        <div className="corte bien">No se corta en nada de lo que hoy se puede medir.</div>
      ) : (
        <div className="corte sin">
          Todavía no hay con qué comparar: falta la fecha de inicio, o las fuentes de estos datos no están cargadas.
        </div>
      )}
    </div>
  )
}

function color(estado: EstadoHito): string {
  if (estado === 'hecho') return 'verde'
  if (estado === 'falta') return 'rojo'
  return 'apagado'
}
