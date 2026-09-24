import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CampoEditable } from '@/componentes/CampoEditable'
import { CAMPOS_POR_CLAVE, dondeSeCarga, PESTANA_DEL_GRUPO } from '@/lib/campos'
import { Comparacion } from '@/componentes/Comparacion'
import { BanderaYConsultora } from '@/componentes/BanderaYConsultora'
import { Notas } from '@/componentes/Notas'
import { notasDe } from '@/lib/notas'
import { banderaDe, historialDeBanderas } from '@/lib/banderas'
import { cambiosDeCoach } from '@/lib/usuarios'
import { ElPrograma } from '@/componentes/ElPrograma'
import { estadoDeLasFases, etapasHechasDe, hechosDe } from '@/lib/hitos-clave'
import { avanceDe, filasDeEtapas } from '@/lib/avance'
import { LecturaDelCaso } from '@/componentes/LecturaDelCaso'
import { bloquesDeLaFicha, leerElCaso } from '@/lib/lectura'
import { CompletarFicha } from '@/componentes/CompletarFicha'
import { DiagnosticoDelCaso } from '@/componentes/DiagnosticoDelCaso'
import { Documentos } from '@/componentes/Documentos'
import { Preguntar } from '@/componentes/Preguntar'
import { Sesiones } from '@/componentes/Sesiones'
import { CAMPOS, POR_QUE_EL_GRUPO, TOTAL_CAMPOS, type Campo, type Grupo } from '@/lib/campos'
import { origenesDe, type OrigenDeCampo } from '@/lib/campos-escritura'
import { documentosDe, fuentesDeLaCartera, listarConsultoras, traerCliente } from '@/lib/clientes'
import { quienMira } from '@/lib/quien-mira'
import { ultimoDiagnostico } from '@/lib/diagnosticos'
import { pendientesDe } from '@/lib/propuestas'
import { dondeSeCorta, evaluarHitos, queNecesita } from '@/lib/hitos'
import { cuandoTermina, seLePasoElPrograma, semanaEnLaQueVa, textoDeSemana } from '@/lib/programa'
import { hayAlgunaSesionEnLaCartera, listarSesiones } from '@/lib/sesiones'

export const dynamic = 'force-dynamic'

/** Las pestañas. Cada una es un bloque, no veinte tarjetas apiladas. */
const PESTANAS = [
  { clave: 'resumen', texto: 'Resumen' },
  { clave: 'programa', texto: 'El programa' },
  { clave: 'cliente', texto: 'El cliente' },
  { clave: 'completar', texto: 'Completar la ficha' },
  { clave: 'diagnostico', texto: 'Diagnóstico' },
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
  searchParams: Promise<{ bloque?: string; error?: string; cargado?: string; campo?: string }>
}) {
  const { id } = await params
  const { bloque, error, cargado, campo: apuntado } = await searchParams
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
  const [bandera, historialBanderas, cambios, lasConsultoras] = await Promise.all([
    banderaDe(cliente.id), historialDeBanderas(cliente.id), cambiosDeCoach(cliente.id), listarConsultoras(),
  ])
  const notas = await notasDe(cliente.id)
  const hechos = await hechosDe(cliente.id)

  const inicio = cliente.valores.fecha_inicio as string
  const meses = cliente.valores.programa_meses as number
  const evaluados = evaluarHitos({
    semana: semanaEnLaQueVa(inicio),
    valores: cliente.valores,
    tiposDeDocumento: new Set(documentos.map((d) => d.tipo)),
    conDatos,
  })
  const fasesDelPrograma = estadoDeLasFases(semanaEnLaQueVa(inicio), new Set(hechos.keys()))

  // La comparación que contesta la pregunta de toda la aplicación. Aritmética
  // pura: restar fechas y contar etapas marcadas. No cuesta nada, corre siempre.
  const etapasHechas = etapasHechasDe(hechos)
  const avance = avanceDe(semanaEnLaQueVa(inicio), etapasHechas)
  const filasEtapas = filasDeEtapas(
    semanaEnLaQueVa(inicio),
    etapasHechas,
    (cliente.valores.etapa_actual as string) ?? null,
  )

  // Esto corre siempre: es aritmética, no cuesta nada. El modelo se llama
  // después, con un botón, y para lo que la aritmética no puede contestar.
  const lectura = leerElCaso({
    hitos: evaluados,
    valores: cliente.valores,
    sesiones,
    hayAlgunaSesionEnLaCartera: haySesiones,
    hayDiagnostico: diagnostico !== null,
  })
  const ficha = bloquesDeLaFicha(cliente.valores, { documentos: documentos.length, sesiones: sesiones.length })
  const corte = dondeSeCorta(evaluados)
  // Si vinieron a cargar un dato puntual, la pestaña la manda el dato: así el
  // enlace «falta la oferta» no depende de que quien lo escribió se acuerde de
  // en qué pestaña vive la oferta.
  const bloqueDelCampo = apuntado ? PESTANA_DEL_GRUPO[CAMPOS_POR_CLAVE.get(apuntado)?.grupo ?? 'identidad'] : null
  const pestana: Pestana = (PESTANAS.find((p) => p.clave === (bloqueDelCampo ?? bloque))?.clave ?? 'resumen') as Pestana

  // Arriba se muestra una sola etapa: la que eligió la consultora manda sobre
  // la del calendario, porque ella estuvo en la sesión y el calendario no.
  const termina = cuandoTermina(inicio, meses, cliente.valores.fecha_fin_prevista as string | null)

  const laEtapaDeAhora = (cliente.valores.etapa_actual as string | null)
    ?? filasEtapas.find((f) => f.estado === 'es_la_de_ahora')?.etapa.nombre
    ?? null

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
          apuntado={apuntado === campo.clave}
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

      {/* ── Lo que se lee de un vistazo ─────────────────────────────────
          Todo lo que una consultora necesita saber antes de abrir la boca:
          cuándo empezó, cuándo termina, de quién es, en qué semana va, qué
          etapa le toca, cómo viene y si hay una bandera levantada. */}
      <header className="cabecera-ficha tarjeta">
        <div className="titulo">
          <h1>{cliente.nombre}</h1>
          <span className={`chip-estado ${avance.estado}`}>{avance.palabra}</span>
          {seLePasoElPrograma(inicio, meses) ? <span className="chip mal">ya se pasó del programa</span> : null}
        </div>

        <div className="datos-clave">
          <div>
            <span className="rotulo">Empezó</span>
            <b className={inicio ? undefined : 'apagado'}>
              {inicio ? String(inicio).slice(0, 10).split('-').reverse().join('/') : 'sin fecha'}
            </b>
          </div>
          <div>
            <span className="rotulo">Termina</span>
            <b className={termina ? undefined : 'apagado'}>
              {termina ? termina.fecha.split('-').reverse().join('/') : 'sin fecha'}
              {termina?.calculada ? <div className="mini">calculada: {meses} meses desde el inicio</div> : null}
            </b>
          </div>
          <div>
            <span className="rotulo">Consultora</span>
            <b className={cliente.consultora ? undefined : 'apagado'}>{cliente.consultora ?? 'sin asignar'}</b>
          </div>
          <div>
            <span className="rotulo">Va en</span>
            <b>{textoDeSemana(inicio, meses)}</b>
          </div>
          <div>
            <span className="rotulo">Etapa</span>
            <b className={laEtapaDeAhora ? undefined : 'apagado'}>{laEtapaDeAhora ?? 'sin elegir'}</b>
          </div>
          <div>
            <span className="rotulo">Etapas hechas</span>
            <b className={avance.estado === 'al_dia' ? 'verde' : avance.estado === 'grave' ? 'rojo' : 'ambar'}>
              {avance.hechas} de {avance.total}
              <div className="mini">
                {avance.estado === 'sin_fecha' ? 'sin fecha no hay con qué comparar' : `le pedían ${avance.esperadas}`}
              </div>
            </b>
          </div>
          <div>
            <span className="rotulo">Ficha</span>
            <b className={cliente.faltan.length > 0 ? 'ambar' : 'verde'}>
              {TOTAL_CAMPOS - cliente.faltan.length} de {TOTAL_CAMPOS} datos
            </b>
          </div>
        </div>

        <BanderaYConsultora
          clienteId={cliente.id} bandera={bandera} historial={historialBanderas}
          cambios={cambios} consultoraActual={cliente.consultora}
          consultoras={lasConsultoras.map((c) => ({ id: c.id, nombre: c.nombre }))}
          esAdmin={quien?.usuario.rol === 'admin'}
        />
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
                <div className={`avance ${avance.estado}`}>
                  <span className="rotulo">Dónde está y dónde tendría que estar</span>
                  <div className="dos-barras" aria-hidden="true">
                    <div className="barra esperado" style={{ width: `${avance.porEsperado}%` }} />
                    <div className="barra real" style={{ width: `${avance.porReal}%` }} />
                  </div>
                  <p className="titular">{avance.titular}</p>
                  <p className="mini" style={{ margin: 0 }}>
                    <Link href={`/clientes/${cliente.id}?bloque=programa`}>Ver y marcar las catorce etapas →</Link>
                  </p>
                </div>

                <LecturaDelCaso lectura={lectura} ficha={ficha} clienteId={cliente.id} />
                <Comparacion evaluados={evaluados} suelto />
                <h2 style={{ marginTop: 26 }}>Identidad y programa</h2>
                <dl className="dos-columnas">{campos('identidad').map(dato)}</dl>
                {cliente.faltan.length > 0 ? (
                  <p className="faltantes">
                    Faltan <b>{cliente.faltan.length} de {TOTAL_CAMPOS}</b> datos. Tocá cualquiera y te deja escribiéndolo:{' '}
                    {cliente.faltan.map((c, i) => (
                      <span key={c.clave}>
                        {i > 0 ? ', ' : ''}
                        <Link href={dondeSeCarga(cliente.id, c.clave) ?? '#'}>{c.etiqueta.toLowerCase()}</Link>
                      </span>
                    ))}.
                  </p>
                ) : null}
              </>
            ) : null}

            {pestana === 'programa' ? (
              <ElPrograma
                clienteId={cliente.id} avance={avance} filas={filasEtapas}
                fases={fasesDelPrograma} hechos={Object.fromEntries(hechos)}
              />
            ) : null}

            {/* Todo lo que se sabe del cliente en un solo lado. Estaba repartido
                en cuatro pestañas y eso obligaba a recordar en cuál vivía cada
                dato para ir a buscarlo. */}
            {pestana === 'cliente' ? (
              <>
                <h2 style={{ marginTop: 0 }}>Su negocio</h2>
                <dl className="dos-columnas">{campos('negocio').map(dato)}</dl>

                <h2 style={{ marginTop: 26 }}>Lo que ya probó</h2>
                <p className="mini" style={{ marginTop: 0 }}>{POR_QUE_EL_GRUPO.intentos}</p>
                <dl className="dos-columnas">{campos('intentos').map(dato)}</dl>

                <h2 style={{ marginTop: 26 }}>Sus números</h2>
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
            {pestana === 'sesiones' ? (
              <Sesiones
                clienteId={cliente.id} sesiones={sesiones}
                fechaInicio={inicio ?? null}
                hitosPorSemana={evaluados.reduce<Record<number, string[]>>((acc, e) => {
                  ;(acc[e.hito.semana] ??= []).push(e.hito.etiqueta)
                  return acc
                }, {})}
              />
            ) : null}
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
              <Link className="boton suave" href={`/clientes/${cliente.id}?bloque=programa`}>Marcar etapas del programa</Link>
              <span className="boton suave apagada" title="Todavía no está">Preparar la próxima sesión</span>
              <span className="boton suave apagada" title="Todavía no está">Cerrar la sesión</span>
              <span className="boton suave apagada" title="Todavía no está">Cargar la semana</span>
              <span className="boton suave apagada" title="Todavía no está">Test de coherencia</span>
            </div>
          </div>

          <Notas clienteId={cliente.id} notas={notas} yo={quien?.usuario.id ?? 0} />

          <Preguntar clienteId={cliente.id} nombre={cliente.nombre} />
        </aside>
      </div>
    </>
  )
}
