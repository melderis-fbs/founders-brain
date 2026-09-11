'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AsignarClientes } from './AsignarClientes'
import { Etapas } from './Comparacion'
import { Semaforo } from './Semaforo'
import { TOTAL_CAMPOS } from '@/lib/campos'
import type { EstadoHito } from '@/lib/hitos'
import { seLePasoElPrograma, textoDeSemana } from '@/lib/programa'
import type { Semaforo as Estado } from '@/lib/semaforo'

export type FilaDeCliente = {
  id: number
  nombre: string
  consultora: string | null
  estado: string | null
  fechaInicio: string | null
  programaMeses: number | null
  faltan: number
  queFalta: string
  etapas: Record<string, EstadoHito>
  semaforo: Estado
  atraso: number
  necesita: string
}

/**
 * La lista de clientes, con casillas para moverlos de consultora en tanda.
 *
 * Las casillas sólo las ve quien administra: una consultora no reparte la
 * cartera de las otras seis.
 */
export function TablaDeClientes({
  filas, consultoras, puedeAsignar,
}: {
  filas: FilaDeCliente[]
  consultoras: { id: number; nombre: string }[]
  puedeAsignar: boolean
}) {
  const [marcados, setMarcados] = useState<number[]>([])

  const marcar = (id: number) =>
    setMarcados((antes) => (antes.includes(id) ? antes.filter((x) => x !== id) : [...antes, id]))

  const todosMarcados = filas.length > 0 && marcados.length === filas.length

  return (
    <>
      <div className="tabla-marco">
        <table>
          <thead>
            <tr>
              {puedeAsignar ? (
                <th className="marca-fila">
                  <input
                    type="checkbox" checked={todosMarcados}
                    aria-label="Marcar todos los que estás viendo"
                    title="Marcar todos los que estás viendo"
                    onChange={() => setMarcados(todosMarcados ? [] : filas.map((f) => f.id))}
                  />
                </th>
              ) : null}
              <th>Cliente</th>
              <th>Cómo va</th>
              <th>Consultora</th>
              <th>Va en</th>
              <th>Etapas</th>
              <th>Estado</th>
              <th>Qué necesita</th>
              <th className="num">Datos</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className={marcados.includes(f.id) ? 'marcada' : undefined}>
                {puedeAsignar ? (
                  <td className="marca-fila">
                    <input
                      type="checkbox" checked={marcados.includes(f.id)}
                      aria-label={`Marcar a ${f.nombre}`}
                      onChange={() => marcar(f.id)}
                    />
                  </td>
                ) : null}
                <td><Link className="nombre-cliente" href={`/clientes/${f.id}`}>{f.nombre}</Link></td>
                <td><Semaforo estado={f.semaforo} /></td>
                <td className={f.consultora ? undefined : 'apagado'}>{f.consultora ?? 'sin asignar'}</td>
                <td className={`semana ${seLePasoElPrograma(f.fechaInicio, f.programaMeses) ? 'rojo' : f.fechaInicio ? '' : 'apagado'}`}>
                  {textoDeSemana(f.fechaInicio, f.programaMeses)}
                </td>
                <td><Etapas estados={f.etapas} /></td>
                <td>{f.estado ? <span className={`chip ${f.estado}`}>{f.estado}</span> : <span className="apagado">sin estado</span>}</td>
                <td className={f.atraso >= 0 ? 'rojo' : undefined}>{f.necesita}</td>
                <td className="num mini" title={f.queFalta}>
                  {f.faltan === 0 ? <span className="verde">completa</span> : `faltan ${f.faltan} de ${TOTAL_CAMPOS}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {puedeAsignar ? (
        <AsignarClientes consultoras={consultoras} marcados={marcados} alLimpiar={() => setMarcados([])} />
      ) : null}
    </>
  )
}
