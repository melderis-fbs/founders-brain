import Link from 'next/link'
import { CAMPOS_POR_CLAVE, dondeSeCarga } from '@/lib/campos'
import type { HitoEvaluado } from '@/lib/hitos'

/**
 * QUÉ FALTA CARGAR DE ESTE CLIENTE, Y DÓNDE SE CARGA.
 *
 * El semáforo dejó de decir «atrasado» por lo que no cargamos nosotros, y eso
 * estuvo bien, pero dejó a la vista lo que faltaba de verdad: decía «falta
 * cargar oferta y promesa cerradas» y no había forma de saber dónde se escribe
 * eso. Un cartel que nombra un problema y no el lugar donde se arregla es la
 * mitad del trabajo.
 *
 * Cada dato es un enlace que abre su campo listo para escribir. Y si ya hay
 * documentos cargados, se dice que puede estar ahí adentro: subir el onboarding
 * no llena la ficha solo —lo propone el modelo y lo confirma una persona— y eso
 * no se entendía desde ninguna pantalla.
 */
function estaVacio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true
  if (typeof valor === 'string') return valor.trim() === ''
  return false
}

export function FaltaCargar({
  clienteId, sinCargar, valores, documentos,
}: {
  clienteId: number
  sinCargar: readonly HitoEvaluado[]
  /** La ficha, para nombrar SÓLO los campos que de verdad están vacíos. */
  valores: Record<string, unknown>
  documentos: number
}) {
  if (sinCargar.length === 0) return null

  const deLaFicha = sinCargar.filter((e) => e.hito.fuente === 'ficha')
  const deDocumentos = sinCargar.filter((e) => e.hito.fuente === 'documentos')

  // Sólo los que están vacíos de verdad. Un hito necesita sus dos campos, así
  // que aparece acá aunque uno ya esté cargado: nombrar los dos mandaría a
  // cargar algo que ya está, que es la manera más rápida de que nadie vuelva a
  // creerle a este cartel.
  //
  // Un mismo campo puede faltarle a dos hitos: se nombra una sola vez.
  const camposQueFaltan: string[] = []
  for (const e of deLaFicha) {
    for (const clave of e.hito.camposQueLoDan ?? []) {
      if (!estaVacio(valores[clave])) continue
      if (!camposQueFaltan.includes(clave)) camposQueFaltan.push(clave)
    }
  }
  if (camposQueFaltan.length === 0 && deDocumentos.length === 0) return null

  return (
    <div className="falta-cargar">
      <h2>Qué falta cargar de este cliente</h2>
      <p className="mini" style={{ marginTop: 0 }}>
        Esto no dice que el cliente esté atrasado: dice que todavía no lo escribimos, así que no hay
        con qué compararlo. Tocá cualquiera y te deja escribiéndolo.
      </p>

      {camposQueFaltan.length > 0 ? (
        <ul className="los-campos">
          {camposQueFaltan.map((clave) => {
            const campo = CAMPOS_POR_CLAVE.get(clave)
            const donde = dondeSeCarga(clienteId, clave)
            return (
              <li key={clave}>
                {donde ? <Link href={donde}>{campo?.etiqueta ?? clave}</Link> : (campo?.etiqueta ?? clave)}
                {campo?.ayuda ? <span className="mini apagado"> · {campo.ayuda}</span> : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {deDocumentos.length > 0 ? (
        <p className="mini">
          Falta subir el <b>formulario de onboarding</b> de este cliente.{' '}
          <Link href={`/clientes/${clienteId}?bloque=documentos`}>Cargarlo →</Link>
        </p>
      ) : null}

      {documentos > 0 && camposQueFaltan.length > 0 ? (
        <p className="mini" style={{ marginBottom: 0 }}>
          Ojo: hay <b>{documentos} {documentos === 1 ? 'documento cargado' : 'documentos cargados'}</b> y
          puede que varios de estos datos ya estén ahí adentro. Subir un documento no llena la ficha
          solo —el modelo los propone y los confirmás vos, uno por uno—.{' '}
          <Link href={`/clientes/${clienteId}?bloque=completar`}>Sacarlos de los documentos →</Link>
        </p>
      ) : null}
    </div>
  )
}
