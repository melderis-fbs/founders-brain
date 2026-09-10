import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CampoEditable } from '@/componentes/CampoEditable'
import { Comparacion } from '@/componentes/Comparacion'
import { Documentos } from '@/componentes/Documentos'
import { Semaforo } from '@/componentes/Semaforo'
import {
  CAMPOS, ETIQUETA_GRUPO, POR_QUE_EL_GRUPO, TOTAL_CAMPOS, type Campo, type Grupo,
} from '@/lib/campos'
import { origenesDe, type OrigenDeCampo } from '@/lib/campos-escritura'
import { documentosDe, fuentesDeLaCartera, traerCliente } from '@/lib/clientes'
import { evaluarHitos } from '@/lib/hitos'
import { semaforoDe } from '@/lib/semaforo'
import { seLePasoElPrograma, semanaEnLaQueVa, textoDeSemana } from '@/lib/programa'

export const dynamic = 'force-dynamic'

const GRUPOS: Grupo[] = ['identidad', 'negocio', 'autoridad', 'intentos', 'numeros', 'comercial']

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

export default async function Ficha({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; cargado?: string }>
}) {
  const { id } = await params
  const { error, cargado } = await searchParams
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
      {error ? <div className="aviso">{decodeURIComponent(error)}</div> : null}
      {cargado ? <div className="aviso ok">El documento se cargó.</div> : null}

      <div className="cabecera-ficha">
        <h1>{cliente.nombre}</h1>
        <div className="sub">
          <Semaforo estado={semaforoDe(evaluados)} />
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

      <p className="mini" style={{ marginTop: -8, marginBottom: 14 }}>{semaforoDe(evaluados).porque}</p>

      <div style={{ marginBottom: 14 }}>
        <Comparacion evaluados={evaluados} />
      </div>

      <div className="bloques">
        {GRUPOS.map((grupo) => (
          <section className="tarjeta" key={grupo}>
            <h2 title={POR_QUE_EL_GRUPO[grupo]}>{ETIQUETA_GRUPO[grupo]}</h2>
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

        <Documentos clienteId={cliente.id} documentos={documentos} />
      </div>
    </>
  )
}
