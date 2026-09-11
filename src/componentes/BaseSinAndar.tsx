'use client'

import { useState } from 'react'
import type { Revision } from '@/lib/revision'

/**
 * La pantalla que reemplaza al «Application error» con digest.
 *
 * Si el problema se arregla con SQL, el SQL está acá, entero y con un botón
 * para copiarlo. Quien ve esta pantalla está en el navegador: mandarlo a
 * correr un comando es mandarlo a buscar una computadora con el repo.
 */
export function BaseSinAndar({ revision }: { revision: Extract<Revision, { ok: false }> }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (!revision.sql) return
    try {
      await navigator.clipboard.writeText(revision.sql)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // Sin permiso de portapapeles queda el texto a la vista para seleccionarlo.
    }
  }

  return (
    <main className="entrada">
      <div className="rota">
        <div className="marca">Founders Brain</div>
        <h1>{revision.titulo}</h1>
        <p className="detalle">{revision.detalle}</p>
        <ol>
          {revision.pasos.map((paso, i) => <li key={i}>{paso}</li>)}
        </ol>

        {revision.sql ? (
          <div className="el-sql">
            <div className="arriba">
              <span className="mini">{revision.sql.split('\n').length} líneas de SQL</span>
              <button type="button" className="boton" onClick={() => void copiar()}>
                {copiado ? 'Copiado' : 'Copiar todo'}
              </button>
            </div>
            <pre>{revision.sql}</pre>
          </div>
        ) : null}
      </div>
    </main>
  )
}
