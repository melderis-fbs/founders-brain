import { marcadasDeLaCartera } from './hitos-clave'
import { banderasDeLaCartera } from './banderas'
import { listarClientes, fuentesDeLaCartera } from './clientes'
import { banderasLevantadas, contarBanderas, type BanderaEnLaLista } from './banderas'
import type { Alcance } from './permisos'
import { evaluarHitos, faltaCargar, FUENTES_ETIQUETA, HITOS, type Fuente } from './hitos'
import { CAMPOS_BASE, TOTAL_BASE } from './campos'
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
  /**
   * A quién llamar hoy. Salen de señales que puso o dijo una persona: una red
   * flag, una queja del cliente, etapas marcadas que muestran atraso real.
   *
   * Antes acá había otro número —«clientes con algo vencido»— que daba 109 de
   * 122, el 89% de la cartera. No era verdad: la mayoría de esos «vencidos» eran
   * datos que no habíamos cargado nosotros. Un tablero que manda a llamar a
   * nueve de cada diez clientes no se usa, y con razón.
   */
  graves: number
  /** De cuántos no se puede decir nada todavía porque falta cargarlos. */
  sinPoderMirar: number
  sePasaron: number
  /** Cuántos tienen completos los datos con los que la aplicación saca cuentas. */
  conBaseCompleta: number
  /** Cuántos de esos datos base faltan en total. */
  faltanBase: number
  /** Qué es lo que más falta cargar, con cuántos clientes lo esperan. */
  loQueFaltaCargar: { etiqueta: string; clientes: number }[]
  /** Cuántos hay de cada color. Gris es su propia categoría, nunca verde. */
  porColor: Record<Color, number>
  porConsultora: { nombre: string; clientes: number; graves: number; sinPoderMirar: number }[]
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

  let graves = 0
  let sinPoderMirar = 0
  let sePasaron = 0
  let conBaseCompleta = 0
  let faltanBase = 0
  const porColor: Record<Color, number> = { rojo: 0, naranja: 0, amarillo: 0, verde: 0, azul: 0, gris: 0 }
  const porCargar = new Map<string, { etiqueta: string; clientes: number }>()
  const porConsultora = new Map<string, { nombre: string; clientes: number; graves: number; sinPoderMirar: number }>()
  const clavesBase = new Set(CAMPOS_BASE.map((campo) => campo.clave))

  for (const c of clientes) {
    const semana = semanaEnLaQueVa(c.fechaInicio)
    const evaluados = evaluarHitos({
      semana,
      valores: c.presencia,
      tiposDeDocumento: new Set(c.tieneOnboarding ? ['onboarding'] : []),
      conDatos,
    })
    const semaforo = semaforoDe(evaluados, {
      seLePaso: seLePasoElPrograma(c.fechaInicio, c.programaMeses),
      semana, marcadas: marcadas.get(c.id) ?? new Set<string>(),
      bandera: lasBanderas.get(c.id)?.color ?? null,
      banderaDesdeHaceSemanas: lasBanderas.get(c.id)?.semanas ?? null,
      loQueDijo: dichos.get(c.id),
    })
    porColor[semaforo.color]++

    const esGrave = semaforo.palabra === 'grave'
    const noSePuedeMirar = semaforo.color === 'gris'
    if (esGrave) graves++
    if (noSePuedeMirar) sinPoderMirar++
    if (seLePasoElPrograma(c.fechaInicio, c.programaMeses)) sePasaron++

    // Sólo los datos con los que la aplicación saca cuentas. Contar los 95
    // decía «les faltan 9.450 datos» y eso no es una tarea: es una pared.
    const leFaltanBase = c.faltan.filter((campo) => clavesBase.has(campo.clave)).length
    faltanBase += leFaltanBase
    if (leFaltanBase === 0) conBaseCompleta++

    // Qué falta cargar, contado por cliente que lo está esperando. Esto sí es
    // una lista de trabajo: cada línea se puede hacer hoy.
    //
    // Sólo de los que siguen en el programa. Si se contaran también los que ya
    // terminaron, el número de una línea podía salir más alto que el total de
    // clientes de los que no se puede decir nada, y dos números que no cierran
    // en la misma tarjeta hacen que no se le crea a ninguno.
    for (const e of seLePasoElPrograma(c.fechaInicio, c.programaMeses) ? [] : faltaCargar(evaluados)) {
      const previo = porCargar.get(e.hito.clave)
      porCargar.set(e.hito.clave, { etiqueta: e.hito.etiqueta, clientes: (previo?.clientes ?? 0) + 1 })
    }

    const nombre = c.consultora ?? 'Sin asignar'
    const suyo = porConsultora.get(nombre) ?? { nombre, clientes: 0, graves: 0, sinPoderMirar: 0 }
    suyo.clientes++
    if (esGrave) suyo.graves++
    if (noSePuedeMirar) suyo.sinPoderMirar++
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
    graves,
    sinPoderMirar,
    sePasaron,
    conBaseCompleta,
    faltanBase,
    loQueFaltaCargar: [...porCargar.values()].sort((a, b) => b.clientes - a.clientes).slice(0, 5),
    porColor,
    porConsultora: [...porConsultora.values()].sort((a, b) => b.graves - a.graves || b.sinPoderMirar - a.sinPoderMirar),
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
