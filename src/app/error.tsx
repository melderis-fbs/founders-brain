'use client'

/**
 * Cuando algo revienta, decirlo.
 *
 * Sin esto, un error del servidor en Vercel sale como «Application error» y un
 * número, que no le sirve a nadie. Con esto sale una pantalla que dice qué
 * pasó, dónde mirar y cómo volver.
 */
// En producción Next reemplaza el mensaje real por un párrafo genérico en
// inglés. Repetirlo no informa nada: mejor una frase propia.
const GENERICO = 'An error occurred in the Server Components render'

function queDice(error: Error): string {
  if (!error.message || error.message.startsWith(GENERICO)) {
    return 'El servidor cortó al armar la página.'
  }
  return error.message
}

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rota" style={{ margin: '40px auto' }}>
      <div className="marca">Founders Brain</div>
      <h1>Algo se rompió en esta pantalla</h1>
      <p className="detalle">
        {queDice(error)}
        {error.digest ? ` (referencia ${error.digest})` : null}
      </p>
      <ol>
        <li>Probá de nuevo: si fue un corte de conexión con la base, con reintentar alcanza.</li>
        <li>Si vuelve a pasar, casi siempre es que falta correr una migración en Supabase. Están en <code>supabase/migrations/</code> y hay que correrlas en orden.</li>
        <li>En Vercel, la referencia de arriba aparece en los logs del despliegue con el error completo.</li>
      </ol>
      <p style={{ marginTop: 16 }}>
        <button className="boton" type="button" onClick={reset}>Probar de nuevo</button>{' '}
        <a className="boton suave" href="/tablero">Ir al tablero</a>
      </p>
    </div>
  )
}
