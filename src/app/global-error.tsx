'use client'

/** Lo mismo, para cuando lo que se rompe es el marco entero de la aplicación. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#111113', margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: 'min(560px, 92vw)' }}>
          <div style={{ color: '#a1a1aa', fontWeight: 700, letterSpacing: '.14em', fontSize: 10, textTransform: 'uppercase' }}>
            Founders Brain
          </div>
          <h1 style={{ fontSize: 21, margin: '10px 0 6px' }}>La aplicación no pudo arrancar</h1>
          <p style={{ color: '#71717a', fontSize: 13, margin: '0 0 16px' }}>
            {error.message || 'El servidor cortó antes de poder dibujar nada.'}
            {error.digest ? ` (referencia ${error.digest})` : null}
          </p>
          <ol style={{ fontSize: 13.5, lineHeight: 1.7, paddingLeft: 20, margin: 0 }}>
            <li>Revisá que <code>DATABASE_URL</code> esté cargada en Vercel, con la cadena del pooler (puerto 6543).</li>
            <li>Revisá que estén corridas todas las migraciones de <code>supabase/migrations/</code>, en orden.</li>
            <li>Después de cambiar una variable de entorno hay que volver a desplegar.</li>
          </ol>
          <p style={{ marginTop: 18 }}>
            <button
              type="button" onClick={reset}
              style={{ font: 'inherit', fontWeight: 600, padding: '9px 17px', borderRadius: 10, border: '1px solid #111113', background: '#111113', color: '#fff', cursor: 'pointer' }}
            >
              Probar de nuevo
            </button>
          </p>
        </div>
      </body>
    </html>
  )
}
