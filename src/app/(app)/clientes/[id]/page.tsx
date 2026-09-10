import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CampoEditable } from '@/componentes/CampoEditable'
import { Comparacion } from '@/componentes/Comparacion'
import {
  CAMPOS, ETIQUETA_DOCUMENTO, ETIQUETA_GRUPO, TOTAL_CAMPOS,
  type Campo, type Grupo, type TipoDocumento,
} from '@/lib/campos'
import { origenesDe, type OrigenDeCampo } from '@/lib/campos-escritura'
import { documentosDe, fuentesDeLaCartera, traerCliente } from '@/lib/clientes'
import { evaluarHitos } from '@/lib/hitos'
import { seLePasoElPrograma, semanaEnLaQueVa, textoDeSemana } from '@/lib/programa'

export const dynamic = 'force-dynamic'

const GRUPOS: Grupo[] = ['identidad', 'negocio', 'numeros', 'comercial']

/** Lo que se ve. Nunca un número sin su unidad. */
function comoSeLee(campo: Campo, valor: unknown): string | null {
  if (valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '')) return null
  if (campo.tipo === 'booleano') return valor ? 'sí' : 'no'
  if (campo.clave === 'programa_meses') return `${valor} meses`
  if (campo.tipo === 'fecha') return String(valor).slice(0, 10).split('-').reverse().join('/')
  if ((campo.tipo === 'numero' || campo.tipo === 'entero') && typeof valor === 'number') {
    return valor.toLocaleString('es-AR')
  }
  return String(valor)
}

/** Lo que se edita: tiene que volver a entrar tal cual salió. */
function comoSeEdita(campo: Campo, valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (campo.tipo === 'booleano') return valor ? 'sí' : 'no'
  if (campo.tipo === 'fecha') return String(valor).slice(0, 10)
  return String(valor)
}

function deDonde(origen: OrigenDeCampo | undefined): string | undefined {
  if (!origen) return undefined
  const cuando = new Date(origen.actualizado_en).toLocaleDateString('es-AR')
  if (origen.origen === 'persona') return `Corregido a mano en la ficha, el ${cuando}`
  if (origen.origen === 'documento') return `Salió de un documento, el ${cuando}${origen.cita ? ` · «${origen.cita}»` : ''}`
  return `Vino de la planilla, el ${cuando}`
}

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cliente = await traerCliente(Number(id))
  if (!cliente) notFound()

  const [documentos, origenes, conDatos] = await Promise.all([
    documentosDe(cliente.id), origenesDe(cliente.id), fuentesDeLaCartera(),
  ])
  const inicio = cliente.valores.fecha_inicio as string
  const meses = cliente.valores.programa_meses as number
  const semana = textoDeSemana(inicio, meses)
  const pasado = seLePasoElPrograma(inicio, meses)

  const evaluados = evaluarHitos({
    semana: semanaEnLaQueVa(inicio),
    valores: cliente.valores,
    tiposDeDocumento: new Set(documentos.map((d) => d.tipo)),
    conDatos,
  })

  return (
    <>
      <p className="mini"><Link href="/clientes">← Clientes</Link></p>

      <div className="cabecera-ficha">
        <h1>{cliente.nombre}</h1>
        <div className="sub">
          <span className={pasado ? 'rojo' : undefined} style={{ fontWeight: 600 }}>{semana}</span>
          {pasado ? <span className="chip mal">ya se pasó del programa</span> : null}
          <span>{cliente.consultora ?? 'sin consultora asignada'}</span>
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

      <div style={{ marginBottom: 14 }}>
        <Comparacion evaluados={evaluados} />
      </div>

      <div className="bloques">
        {GRUPOS.map((grupo) => (
          <section className="tarjeta" key={grupo}>
            <h2>{ETIQUETA_GRUPO[grupo]}</h2>
            <dl>
              {CAMPOS.filter((c) => c.grupo === grupo).map((campo) => (
                <div className="dato" key={campo.clave}>
                  <dt>{campo.etiqueta}</dt>
                  <dd>
                    <CampoEditable
                      clienteId={cliente.id}
                      clave={campo.clave}
                      tipo={campo.tipo}
                      opciones={campo.opciones}
                      ayuda={campo.ayuda}
                      valorCrudo={comoSeEdita(campo, cliente.valores[campo.clave])}
                      valorMostrado={comoSeLee(campo, cliente.valores[campo.clave])}
                      deDonde={deDonde(origenes.get(campo.clave))}
                    />
                  </dd>
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
