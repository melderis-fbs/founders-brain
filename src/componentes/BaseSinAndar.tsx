import type { Revision } from '@/lib/revision'

/** La pantalla que reemplaza al «Application error» con digest. */
export function BaseSinAndar({ revision }: { revision: Extract<Revision, { ok: false }> }) {
  return (
    <main className="entrada">
      <div className="rota">
        <div className="marca">Founders Brain</div>
        <h1>{revision.titulo}</h1>
        <p className="detalle">{revision.detalle}</p>
        <ol>
          {revision.pasos.map((paso, i) => <li key={i}>{paso}</li>)}
        </ol>
      </div>
    </main>
  )
}
