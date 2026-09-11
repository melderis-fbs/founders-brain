import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CampoEditable } from '@/componentes/CampoEditable'
import { Comparacion } from '@/componentes/Comparacion'
import { LecturaDelCaso } from '@/componentes/LecturaDelCaso'
import { leerElCaso } from '@/lib/lectura'
import { CompletarFicha } from '@/componentes/CompletarFicha'
import { DiagnosticoDelCaso } from '@/componentes/DiagnosticoDelCaso'
import { Documentos } from '@/componentes/Documentos'
import { Preguntar } from '@/componentes/Preguntar'
import { Semaforo } from '@/componentes/Semaforo'
import { Sesiones } from '@/componentes/Sesiones'
import { CAMPOS, POR_QUE_EL_GRUPO, TOTAL_CAMPOS, type Campo, type Grupo } from '@/lib/campos'
import { origenesDe, type OrigenDeCampo } from '@/lib/campos-escritura'
import { documentosDe, fuentesDeLaCartera, traerCliente } from '@/lib/clientes'
import { quienMira } from '@/lib/quien-mira'
import { ultimoDiagnostico } from '@/lib/diagnosticos'
import { pendientesDe } from '@/lib/propuestas'
import { dondeSeCorta, evaluarHitos, queNecesita } from '@/lib/hitos'
import { seLePasoElPrograma, semanaEnLaQueVa, textoDeSemana } from '@/lib/programa'
import { semaforoDe } from '@/lib/semaforo'
import { hayAlgunaSesionEnLaCartera, listarSesiones } from '@/lib/sesiones'

export const dynamic = 'force-dynamic'

/** Las pestañas. Cada una es un bloque, no veinte tarjetas apiladas. */
const PESTANAS = [
  { clave: 'resumen', texto: 'Resumen' },
  { clave: 'completar', texto: 'Completar la ficha' },
  { clave: 'diagnostico', texto: 'Diagnóstico' },
  { clave: 'negocio', texto: 'Su negocio' },
  { clave: 'autoridad', texto: 'Su autoridad' },
  { clave: 'intentos', texto: 'Lo que ya probó' },
  { clave: 'numeros', texto: 'Números y pagos' },
  { clave: 'sesiones', texto: 'Sesiones' },
  { clave: 'documentos', texto: 'Documentos' },
] as const

type Pestana = (typeof PESTANAS)[number]['clave']

function comoSeLee(campo: Campo, valor: unknown): string | null {
  if (valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '')) return null
  if (campo.tipo === 'booleano') return valor ? 'sí' : 'no'
  if (campo.clave === 'programa_meses') return `${valor} meses`
  if (campo.tipo === 'fecha') return String(valor).slice(0, 10).split('-').reverse().join('/')
  if ((campo.tipo === 'numero' || campo.tipo === 'entero') && typeof valor === 'number') return valor.toLocaleString('es-AR')
  return String(valor)
}

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
  searchParams: Promise<{ bloque?: string; error?: string; cargado?: string }>
}) {
  const { id } = await params
  const { bloque, error, cargado } = await searchParams
  // Un cliente de otra consultora da lo mismo que uno que no existe: 404. Si
  // dijéramos «no tenés permiso», eso ya confirma que el cliente existe.
  const quien = await quienMira()
  const cliente = await traerCliente(Number(id), quien?.alcance ?? { todo: false, consultoraId: null })
  if (!cliente) notFound()

  const [documentos, origenes, conDatos, sesiones, diagnostico, propuestas, haySesiones] = await Promise.all([
    documentosDe(cliente.id), origenesDe(cliente.id), fuentesDeLaCartera(),
    listarSesiones(cliente.id), ultimoDiagnostico(cliente.id), pendientesDe(cliente.id),
    hayAlgunaSesionEnLaCartera(),
  ])

  const inicio = cliente.valores.fecha_inicio as string
  const meses = cliente.valores.programa_meses as number
  const evaluados = evaluarHitos({
    semana: semanaEnLaQueVa(inicio),
    valores: cliente.valores,
    tiposDeDocumento: new Set(documentos.map((d) => d.tipo)),
    conDatos,
  })
  const semaforo = semaforoDe(evaluados)

  // Esto corre siempre: es aritmética, no cuesta nada. El modelo se llama
  // después, con un botón, y para lo que la aritmética no puede contestar.
  const lectura = leerElCaso({
    hitos: evaluados,
    valores: cliente.valores,
    sesiones,
    hayAlgunaSesionEnLaCartera: haySesiones,
    hayDiagnostico: diagnostico !== null,
  })
  const corte = dondeSeCorta(evaluados)
  const pestana: Pestana = (PESTANAS.find((p) => p.clave === bloque)?.clave ?? 'resumen') as Pestana

  const campos = (grupo: Grupo) => CAMPOS.filter((c) => c.grupo === grupo)
  const dato = (campo: Campo) => (
    <div className="dato" key={campo.clave}>
      <dt title={campo.ayuda}>{campo.etiqueta}</dt>
      <dd>
        <CampoEditable
          clienteId={cliente.id} clave={campo.clave} tipo={campo.tipo} opciones={campo.opciones} ayuda={campo.ayuda}
          valorCrudo={comoSeEdita(campo, cliente.valores[campo.clave])}
          valorMostrado={comoSeLee(campo, cliente.valores[campo.clave])}
          deDonde={deDonde(origenes.get(campo.clave))}
        />
      </dd>
    </div>
  )

  return (
    <>
      <p className="mini"><Link href="/clientes">← Clientes</Link></p>
      {error ? <div className="aviso">{decodeURIComponent(error)}</div> : null}
      {cargado ? (
        <div className="aviso ok">
          {bloque === 'sesiones' ? 'La transcripción se cargó. Analizarla es aparte: cuesta plata.' : 'El documento se cargó.'}
        </div>
      ) : null}

      {/* ── Lo que se lee de un vistazo ─────────────────────────────────── */}
      <header className="cabecera-ficha tarjeta">
        <div className="titulo">
          <h1>{cliente.nombre}</h1>
          <Semaforo estado={semaforo} />
          {seLePasoElPrograma(inicio, meses) ? <span className="chip mal">ya se pasó del programa</span> : null}
        </div>
        <p className="porque">{semaforo.porque}</p>

        <div className="datos-clave">
          <div>
            <span className="rotulo">Va en</span>
            <b>{textoDeSemana(inicio, meses)}</b>
          </div>
          <div>
            <span className="rotulo">Consultora</span>
            <b className={cliente.consultora ? undefined : 'apagado'}>{cliente.consultora ?? 'sin asignar'}</b>
          </div>
          <div>
            <span className="rotulo">Dónde se corta</span>
            <b className={corte ? 'rojo' : 'apagado'}>{corte ? corte.hito.etiqueta.toLowerCase() : 'en nada medible'}</b>
          </div>
          <div>
            <span className="rotulo">Ficha</span>
            <b className={cliente.faltan.length > 0 ? 'ambar' : 'verde'}>
              {TOTAL_CAMPOS - cliente.faltan.length} de {TOTAL_CAMPOS} datos
            </b>
          </div>
          <div>
            <span className="rotulo">Sesiones</span>
            <b className={sesiones.length === 0 ? 'apagado' : undefined}>{sesiones.length}</b>
          </div>
        </div>
      </header>

      <div className="ficha">
        <div>
          <nav className="pestanas">
            {PESTANAS.map((p) => (
              <Link key={p.clave} href={`/clientes/${cliente.id}?bloque=${p.clave}`} className={p.clave === pestana ? 'activa' : undefined}>
                {p.texto}
                {p.clave === 'completar' && propuestas.length > 0 ? <span className="cuantos">{propuestas.length}</span> : null}
                {p.clave === 'sesiones' && sesiones.length > 0 ? <span className="cuantos">{sesiones.length}</span> : null}
                {p.clave === 'documentos' && documentos.length > 0 ? <span className="cuantos">{documentos.length}</span> : null}
              </Link>
            ))}
          </nav>

          <div className="tarjeta panel">
            {pestana === 'resumen' ? (
              <>
                <LecturaDelCaso lectura={lectura} />
                <Comparacion evaluados={evaluados} suelto />
                <h2 style={{ marginTop: 26 }}>Identidad y programa</h2>
                <dl className="dos-columnas">{campos('identidad').map(dato)}</dl>
                {cliente.faltan.length > 0 ? (
                  <p className="faltantes">
                    Faltan <b>{cliente.faltan.length} de {TOTAL_CAMPOS}</b> datos:{' '}
                    {cliente.faltan.map((c) => c.etiqueta.toLowerCase()).join(', ')}.
                  </p>
                ) : null}
              </>
            ) : null}

            {pestana === 'negocio' || pestana === 'autoridad' || pestana === 'intentos' ? (
              <>
                {POR_QUE_EL_GRUPO[pestana] ? <p className="mini" style={{ marginTop: 0 }}>{POR_QUE_EL_GRUPO[pestana]}</p> : null}
                <dl className="dos-columnas">{campos(pestana).map(dato)}</dl>
              </>
            ) : null}

            {pestana === 'numeros' ? (
              <>
                <h2>Sus números</h2>
                <dl className="dos-columnas">{campos('numeros').map(dato)}</dl>
                <h2 style={{ marginTop: 26 }}>Lo comercial</h2>
                <dl className="dos-columnas">{campos('comercial').map(dato)}</dl>
              </>
            ) : null}

            {pestana === 'completar' ? (
              <CompletarFicha
                clienteId={cliente.id}
                propuestas={propuestas}
                faltan={cliente.faltan}
                etiquetas={Object.fromEntries(CAMPOS.map((c) => [c.clave, c.etiqueta]))}
                documentos={documentos}
              />
            ) : null}
            {pestana === 'diagnostico' ? <DiagnosticoDelCaso clienteId={cliente.id} guardado={diagnostico} /> : null}
            {pestana === 'sesiones' ? <Sesiones clienteId={cliente.id} sesiones={sesiones} /> : null}
            {pestana === 'documentos' ? <Documentos clienteId={cliente.id} documentos={documentos} suelto /> : null}
          </div>
        </div>

        {/* ── Las acciones, siempre en el mismo lugar ────────────────────── */}
        <aside className="acciones">
          <div className="tarjeta">
            <h2>Acciones</h2>
            <div className="lista-acciones">
              <Link className="boton suave" href={`/clientes/${cliente.id}?bloque=sesiones`}>Cargar o analizar una sesión</Link>
              <Link className="boton suave" href={`/clientes/${cliente.id}?bloque=documentos`}>Cargar un documento</Link>
              <Link className="boton suave" href={`/clientes/${cliente.id}?bloque=completar`}>
                Completar desde los documentos{propuestas.length > 0 ? ` · ${propuestas.length}` : ''}
              </Link>
              <Link className="boton suave" href={`/clientes/${cliente.id}?bloque=diagnostico`}>Diagnóstico del caso</Link>
              <span className="boton suave apagada" title="Todavía no está">Preparar la próxima sesión</span>
            </div>
          </div>

          <Preguntar clienteId={cliente.id} nombre={cliente.nombre} />
        </aside>
      </div>
    </>
  )
}
