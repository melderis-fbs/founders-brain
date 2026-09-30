/**
 * Lo que se lleva puesto borrar un cliente, sin base de datos al lado.
 *
 * La pantalla que lo muestra es un componente de cliente: si importara el módulo
 * que habla con Postgres, `pg` se iría al navegador y el build se cae.
 */
export type QueSeVa = {
  nombre: string
  documentos: number
  sesiones: number
  meses: number
  notas: number
  banderas: number
  diagnosticos: number
  propuestas: number
  datosCargados: number
}
