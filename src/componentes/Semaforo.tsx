import type { Semaforo as Estado } from '@/lib/semaforo'

/**
 * El color, siempre con su palabra al lado.
 *
 * Un color solo obliga a acordarse de qué quería decir; y en gris el color no
 * dice nada, porque justamente lo que informa es que no se sabe.
 */
export function Semaforo({ estado, soloPunto = false }: { estado: Estado; soloPunto?: boolean }) {
  return (
    <span className={`semaforo ${estado.color}`} title={estado.porque}>
      <i />
      {soloPunto ? null : estado.palabra}
    </span>
  )
}
