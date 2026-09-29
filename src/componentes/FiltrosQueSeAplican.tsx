'use client'

import { useRef } from 'react'

/**
 * Los filtros se aplican al elegir, no al apretar un botón.
 *
 * Elegir una consultora en un desplegable y que no pase nada se lee como que el
 * filtro está roto. No lo estaba: faltaba apretar «Filtrar», que estaba tres
 * campos más a la derecha. Es el mismo problema que tenían los desplegables de
 * la ficha, que guardaban al perder el foco y nunca al elegir.
 *
 * El botón queda igual, para quien lo apriete y para cuando no hay JavaScript.
 */
export function FiltrosQueSeAplican({ children }: { children: React.ReactNode }) {
  const formulario = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formulario} className="filtros" method="get"
      onChange={(e) => {
        // El texto no: se filtra al terminar de escribir, con Enter o con el
        // botón. Recargar la lista en cada tecla es pelear con quien escribe.
        if ((e.target as HTMLElement).tagName === 'SELECT') formulario.current?.requestSubmit()
      }}
    >
      {children}
    </form>
  )
}
