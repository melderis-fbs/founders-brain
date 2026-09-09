/**
 * Normalización de texto.
 *
 * Ojo con la diferencia entre las dos funciones de acá, porque es la regla 3:
 * - `clave()` sirve para comparar NOMBRES DE CLIENTE y es estricta: sólo limpia
 *   espacios. «Maria» y «María» siguen siendo distintos.
 * - `plegado()` es laxa (saca acentos y mayúsculas) y NO se usa nunca para
 *   decidir a qué cliente pertenece una fila: se usa para leer encabezados de
 *   la planilla y para detectar parecidos que hay que informar.
 */

/** Espacios colapsados y recortados. Nada más. */
export function clave(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim()
}

/** Minúsculas, sin acentos, sin puntuación, espacios colapsados. */
export function plegado(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** true si el texto no aporta ningún dato. Cuidado: "0" SÍ aporta (regla 1). */
export function vacio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true
  if (typeof valor === 'string') return valor.trim() === ''
  return false
}
