import { fuentesDeLaCartera, listarClientes } from './clientes'
import type { Alcance } from './permisos'
import { dondeSeCorta, etapaQueLeTocaria, evaluarHitos, HITOS, queNecesita, type EstadoHito } from './hitos'
import { semaforoDe, type Semaforo } from './semaforo'
import { semanaEnLaQueVa, semanasDelPrograma } from './programa'
import type { Etapa } from './hitos'

/** Las semanas en las que el método espera algo. Las otras no son columnas. */
export const SEMANAS_CON_HITOS = [...new Set(HITOS.map((h) => h.semana))].sort((a, b) => a - b)

export type ClienteEnGrilla = {
  id: number
  nombre: string
  consultora: string | null
  semana: number | null
  totalSemanas: number | null
  semaforo: Semaforo
  /** Dónde tendría que estar por calendario. Es la columna del tablero. */
  columna: Etapa | 'sin_fecha'
  /** En qué etapa se corta de verdad. null si no se corta en ninguna. */
  seCortaEn: Etapa | null
  necesita: string
  /** Qué pasó con lo que vencía en cada semana. */
  porSemana: Record<number, EstadoHito>
  /** Semanas de atraso de lo primero que se cortó. -1 si no se cortó nada. */
  atraso: number
}

export async function traerGrilla(alcance: Alcance, filtros: { consultoraId?: number | null } = {}): Promise<ClienteEnGrilla[]> {
  const [clientes, conDatos] = await Promise.all([
    listarClientes(alcance, { consultoraId: filtros.consultoraId ?? null }),
    fuentesDeLaCartera(),
  ])

  const armados = clientes.map((c) => {
    const semana = semanaEnLaQueVa(c.fechaInicio)
    const evaluados = evaluarHitos({
      semana,
      valores: c.presencia,
      tiposDeDocumento: new Set(c.tieneOnboarding ? ['onboarding'] : []),
      conDatos,
    })
    const semaforo = semaforoDe(evaluados)

    const porSemana: Record<number, EstadoHito> = {}
    for (const nro of SEMANAS_CON_HITOS) {
      const deEsaSemana = evaluados.filter((e) => e.hito.semana === nro)
      porSemana[nro] = deEsaSemana.some((e) => e.estado === 'falta') ? 'falta'
        : deEsaSemana.some((e) => e.estado === 'hecho') ? 'hecho'
        : deEsaSemana.every((e) => e.estado === 'todavia_no') ? 'todavia_no'
        : 'sin_datos'
    }

    return {
      id: c.id,
      nombre: c.nombre,
      consultora: c.consultora,
      semana,
      totalSemanas: semanasDelPrograma(c.programaMeses),
      semaforo,
      // La columna es dónde TENDRÍA que estar, no dónde se corta. Agrupar por
      // dónde se corta amontonaba 193 de 196 clientes en Definición: una
      // columna que dice lo mismo en todas las filas no es una columna.
      columna: (etapaQueLeTocaria(semana) ?? 'sin_fecha') as Etapa | 'sin_fecha',
      seCortaEn: semaforo.etapa,
      necesita: queNecesita(evaluados, c.faltan),
      porSemana,
      atraso: dondeSeCorta(evaluados)?.atrasoEnSemanas ?? -1,
    }
  })

  // Dentro de cada columna, primero el que más necesita que lo miren: el color
  // más grave, y a igual color el que hace más semanas que está cortado.
  const ORDEN: Record<string, number> = { rojo: 0, amarillo: 1, verde: 2, gris: 3 }
  armados.sort((a, b) =>
    ORDEN[a.semaforo.color] - ORDEN[b.semaforo.color] ||
    b.atraso - a.atraso ||
    a.nombre.localeCompare(b.nombre))

  return armados
}

/** Cuántos hay de cada color, para el tablero. */
export function contarPorColor(clientes: readonly ClienteEnGrilla[]) {
  return {
    rojo: clientes.filter((c) => c.semaforo.color === 'rojo').length,
    amarillo: clientes.filter((c) => c.semaforo.color === 'amarillo').length,
    verde: clientes.filter((c) => c.semaforo.color === 'verde').length,
    gris: clientes.filter((c) => c.semaforo.color === 'gris').length,
  }
}
