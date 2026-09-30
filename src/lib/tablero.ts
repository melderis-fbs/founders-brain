import { marcadasDeLaCartera } from './hitos-clave'
import { banderasDeLaCartera } from './banderas'
import { listarClientes, fuentesDeLaCartera } from './clientes'
import { banderasLevantadas, contarBanderas, type BanderaEnLaLista } from './banderas'
import type { Alcance } from './permisos'
import { dondeSeCorta, evaluarHitos, FUENTES_ETIQUETA, HITOS, type Fuente } from './hitos'
import { seLePasoElPrograma, semanaEnLaQueVa } from './programa'
import { semaforoDe, type Color } from './semaforo'
import { contarTemperaturas, loQueDijoLaCartera } from './temperatura'

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
  /** Cuántos hay de cada color. Gris es su propia categoría, nunca verde. */
  porColor: Record<Color, number>
  porConsultora: { nombre: string; clientes: number; conAtraso: number; fichasAMedias: number }[]
  /** Qué fuentes todavía no se cargan, y cuántos hitos no se pueden medir por eso. */
  sinFuente: { fuente: Fuente; etiqueta: string; hitos: number }[]
  /** Las banderas levantadas: lo que sabe una persona y no sale de ningún dato. */
  banderas: { roja: number; naranja: number; amarilla: number }
  /** Las rojas y naranjas, con nombre y motivo: son a quién llamar hoy. */
  losQueLevantaron: BanderaEnLaLista[]
  /** Cuántos clientes dijeron algo de nosotros: quejas (grave) y tibios (no). */
  dijeron: { tibios: number; quejas: number }
}

export async function traerTablero(alcance: Alcance): Promise<Tablero> {
  // Las banderas se cuentan dentro del alcance de quien mira: una consultora
  // ve las de sus clientes, no las de la cartera entera.
  const deQuien = alcance.todo ? null : alcance.consultoraId
  const [clientes, conDatos, banderas, losQueLevantaron, marcadas, lasBanderas, dichos] = await Promise.all([
    listarClientes(alcance), fuentesDeLaCartera(),
    contarBanderas(deQuien), banderasLevantadas(deQuien),
    marcadasDeLaCartera(), banderasDeLaCartera(), loQueDijoLaCartera(),
  ])
  const dijeron = await contarTemperaturas()

  let conAtraso = 0
  let sePasaron = 0
  let fichasAMedias = 0
  let datosQueFaltan = 0
  const porColor: Record<Color, number> = { rojo: 0, naranja: 0, amarillo: 0, verde: 0, azul: 0, gris: 0 }
  const cortes = new Map<string, { etiqueta: string; semana: number; cuantos: number }>()
  const porConsultora = new Map<string, { nombre: string; clientes: number; conAtraso: number; fichasAMedias: number }>()

  for (const c of clientes) {
    const semana = semanaEnLaQueVa(c.fechaInicio)
    const evaluados = evaluarHitos({
      semana,
      valores: c.presencia,
      tiposDeDocumento: new Set(c.tieneOnboarding ? ['onboarding'] : []),
      conDatos,
    })
    const corte = dondeSeCorta(evaluados)
    const atrasado = corte !== null
    porColor[semaforoDe(evaluados, {
      seLePaso: seLePasoElPrograma(c.fechaInicio, c.programaMeses),
      semana, marcadas: marcadas.get(c.id) ?? new Set<string>(),
      bandera: lasBanderas.get(c.id)?.color ?? null,
      banderaDesdeHaceSemanas: lasBanderas.get(c.id)?.semanas ?? null,
      loQueDijo: dichos.get(c.id),
    }).color]++
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
    porColor,
    corteMasComun: [...cortes.values()].sort((a, b) => b.cuantos - a.cuantos)[0] ?? null,
    porConsultora: [...porConsultora.values()].sort((a, b) => b.conAtraso - a.conAtraso || b.clientes - a.clientes),
    sinFuente,
    banderas,
    losQueLevantaron: losQueLevantaron.filter((b) => b.color !== 'amarilla'),
    // Lo que dijeron los clientes de nosotros. Va al lado de las banderas y no
    // mezclado con ellas: una bandera la levanta una persona, esto lo dijo el
    // cliente, y no es lo mismo saber que alguien se preocupó que saber que el
    // cliente se quejó.
    dijeron,
  }
}
