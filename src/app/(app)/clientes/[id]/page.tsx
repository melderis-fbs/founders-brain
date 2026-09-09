import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CAMPOS, ETIQUETA_DOCUMENTO, ETIQUETA_GRUPO, TOTAL_CAMPOS, type Campo, type Grupo, type TipoDocumento } from '@/lib/campos'
import { documentosDe, traerCliente } from '@/lib/clientes'
import { seLePasoElPrograma, textoDeSemana } from '@/lib/programa'

export const dynamic = 'force-dynamic'

const GRUPOS: Grupo[] = ['identidad', 'negocio', 'numeros', 'comercial']

function mostrar(campo: Campo, valor: unknown): React.ReactNode {
  if (valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '')) {
    return <span className="falta">falta</span>
  }
  if (campo.tipo === 'booleano') return valor ? 'sí' : 'no'
  if (campo.tipo === 'numero' && typeof valor === 'number') return valor.toLocaleString('es-AR')
  if (campo.clave === 'programa_meses') return `${valor} meses`
  if (campo.tipo === 'fecha') return String(valor).split('-').reverse().join('/')
  return String(valor)
}

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cliente = await traerCliente(Number(id))
  if (!cliente) notFound()

  const documentos = await documentosDe(cliente.id)
  const semana = textoDeSemana(cliente.valores.fecha_inicio as string, cliente.valores.programa_meses as number)
  const pasado = seLePasoElPrograma(cliente.valores.fecha_inicio as string, cliente.valores.programa_meses as number)

  return (
    <>
      <p className="mini"><Link href="/clientes">← Clientes</Link></p>

      <div className="cabecera-ficha">
        <h1>{cliente.nombre}</h1>
        <div className="sub">
          {semana}
          {pasado ? ' · ya se pasó del programa' : ''}
          {cliente.consultora ? ` · ${cliente.consultora}` : ' · sin consultora asignada'}
        </div>
        <div className="faltantes">
          {cliente.faltan.length === 0 ? (
            <>No le falta ningún dato de los {TOTAL_CAMPOS}.</>
          ) : (
            <>
              Faltan <b>{cliente.faltan.length} de {TOTAL_CAMPOS}</b> datos:{' '}
              {cliente.faltan.map((c) => c.etiqueta.toLowerCase()).join(', ')}.
            </>
          )}
        </div>
      </div>

      <div className="bloques">
        {GRUPOS.map((grupo) => (
          <section className="tarjeta" key={grupo}>
            <h2>{ETIQUETA_GRUPO[grupo]}</h2>
            <dl>
              {CAMPOS.filter((c) => c.grupo === grupo).map((campo) => (
                <div className="dato" key={campo.clave}>
                  <dt>{campo.etiqueta}</dt>
                  <dd>{mostrar(campo, cliente.valores[campo.clave])}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section className="tarjeta">
          <h2>Documentos</h2>
          {documentos.length === 0 ? (
            <p className="apagado" style={{ margin: 0 }}>No hay ningún documento cargado de este cliente.</p>
          ) : (
            <dl>
              {documentos.map((d) => (
                <div className="dato" key={d.id}>
                  <dt>{ETIQUETA_DOCUMENTO[d.tipo as TipoDocumento] ?? d.tipo}</dt>
                  <dd>
                    {d.caracteres.toLocaleString('es-AR')} caracteres · entró por {d.origen}
                    <br />
                    <span className="mini">{new Date(d.creado_en).toLocaleDateString('es-AR')}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
    </>
  )
}
