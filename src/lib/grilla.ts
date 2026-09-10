import { fuentesDeLaCartera, listarClientes } from './clientes'
import { dondeSeCorta, evaluarHitos, HITOS, queNecesita, type EstadoHito } from './hitos'
import { semaforoDe, columnaDe, type Semaforo } from './semaforo'
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
  columna: Etapa | 'al_dia' | 'sin_datos'
  necesita: string
  /** Qué pasó con lo que vencía en cada semana. */
  porSemana: Record<number, EstadoHito>
  /** Semanas de atraso de lo primero que se cortó. -1 si no se cortó nada. */
  atraso: number
}

export async function traerGrilla(filtros: { consultoraId?: number | null } = {}): Promise<ClienteEnGrilla[]> {
  const [clientes, conDatos] = await Promise.all([
    listarClientes({ consultoraId: filtros.consultoraId ?? null }),
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
      columna: columnaDe(semaforo),
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
