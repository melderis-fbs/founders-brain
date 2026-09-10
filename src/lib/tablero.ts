import { listarClientes, fuentesDeLaCartera } from './clientes'
import { dondeSeCorta, evaluarHitos, FUENTES_ETIQUETA, HITOS, type Fuente } from './hitos'
import { seLePasoElPrograma, semanaEnLaQueVa } from './programa'

/**
 * Los números de la semana.
 *
 * Todos son cuentas, no puntajes: cada uno se explica en una frase y viene con
 * contra qué se compara. Y el tablero dice también qué NO se puede medir
 * todavía, que hoy es la información más útil que tiene para dar.
 */
export type Tablero = {
  total: number
  conAtraso: number
  sePasaron: number
  fichasAMedias: number
  datosQueFaltan: number
  /** Dónde se corta la mayoría: casi siempre es el programa, no el cliente. */
  corteMasComun: { etiqueta: string; semana: number; cuantos: number } | null
  porConsultora: { nombre: string; clientes: number; conAtraso: number; fichasAMedias: number }[]
  /** Qué fuentes todavía no se cargan, y cuántos hitos no se pueden medir por eso. */
  sinFuente: { fuente: Fuente; etiqueta: string; hitos: number }[]
}

export async function traerTablero(): Promise<Tablero> {
  const [clientes, conDatos] = await Promise.all([listarClientes(), fuentesDeLaCartera()])

  let conAtraso = 0
  let sePasaron = 0
  let fichasAMedias = 0
  let datosQueFaltan = 0
  const cortes = new Map<string, { etiqueta: string; semana: number; cuantos: number }>()
  const porConsultora = new Map<string, { nombre: string; clientes: number; conAtraso: number; fichasAMedias: number }>()

  for (const c of clientes) {
    const evaluados = evaluarHitos({
      semana: semanaEnLaQueVa(c.fechaInicio),
      valores: c.presencia,
      tiposDeDocumento: new Set(c.tieneOnboarding ? ['onboarding'] : []),
      conDatos,
    })
    const corte = dondeSeCorta(evaluados)
    const atrasado = corte !== null
    const aMedias = c.faltan.length > 0

    if (atrasado) conAtraso++
    if (seLePasoElPrograma(c.fechaInicio, c.programaMeses)) sePasaron++
    if (aMedias) fichasAMedias++
    datosQueFaltan += c.faltan.length

    if (corte) {
      const previo = cortes.get(corte.hito.clave)
      cortes.set(corte.hito.clave, {
        etiqueta: corte.hito.etiqueta,
        semana: corte.hito.semana,
        cuantos: (previo?.cuantos ?? 0) + 1,
      })
    }

    const nombre = c.consultora ?? 'Sin asignar'
    const suyo = porConsultora.get(nombre) ?? { nombre, clientes: 0, conAtraso: 0, fichasAMedias: 0 }
    suyo.clientes++
    if (atrasado) suyo.conAtraso++
    if (aMedias) suyo.fichasAMedias++
    porConsultora.set(nombre, suyo)
  }

  const sinFuente = [...new Set(HITOS.map((h) => h.fuente))]
    .filter((f) => !conDatos.has(f))
    .map((fuente) => ({
      fuente,
      etiqueta: FUENTES_ETIQUETA[fuente],
      hitos: HITOS.filter((h) => h.fuente === fuente).length,
    }))
    .sort((a, b) => b.hitos - a.hitos)

  return {
    total: clientes.length,
    conAtraso,
    sePasaron,
    fichasAMedias,
    datosQueFaltan,
    corteMasComun: [...cortes.values()].sort((a, b) => b.cuantos - a.cuantos)[0] ?? null,
    porConsultora: [...porConsultora.values()].sort((a, b) => b.conAtraso - a.conAtraso || b.clientes - a.clientes),
    sinFuente,
  }
}
