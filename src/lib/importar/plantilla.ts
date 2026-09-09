import Papa from 'papaparse'
import { CAMPOS, DOCUMENTOS_DE_PLANILLA, type Campo } from '../campos'
import { plegado } from '../texto'
import { encabezadosDePlantilla } from './mapeo'

/**
 * La planilla sale de acá, no al revés.
 *
 * Los campos de la aplicación mandan: de `campos.ts` salen los encabezados, y
 * la planilla madre se arma con ellos. Los sinónimos que acepta la importación
 * existen sólo para que lo que ya está escrito hoy entre sin retocarlo.
 *
 * Dos formas de bajarla:
 *  - vacía, con una fila de ejemplo, para empezar la planilla;
 *  - con la cartera cargada, para rehacer la planilla desde lo que hay.
 */
const EJEMPLO: Record<string, string> = {
  id_cliente: 'FB-001',
  nombre: 'Norma Márquez',
  consultora: 'Lucía Fernández',
  email: 'norma@ejemplo.com',
  telefono: '+54 9 11 5555 5555',
  programa_meses: '4',
  fecha_inicio: '03/02/2025',
  fecha_fin_prevista: '',
  estado: 'activo',
  rubro: 'Diseño de interiores',
  que_vende: 'Proyectos de interiorismo llave en mano',
  cliente_ideal: 'Dueños de departamentos a estrenar en CABA',
  problema: 'No saben por dónde empezar y pierden meses',
  oferta: 'Proyecto completo en 6 semanas, con obra coordinada',
  promesa: 'Te entrego la casa lista para vivir en 6 semanas',
  mensaje: 'De departamento vacío a casa terminada, sin que muevas un dedo',
  canal: 'Instagram + referidos',
  diferencial: 'Coordina la obra, no sólo el diseño',
  modelo_negocio: 'servicio',
  antiguedad_negocio: '6',
  equipo: '2',
  moneda: 'ARS',
  ticket: '1.800.000',
  meta_mensual: '5.400.000',
  facturacion_actual: '1.800.000',
  precio_actual: '1.800.000',
  ventas_ultimo_mes: '1',
  tiene_tracker: 'sí',
  fecha_cuenta_inversa: '10/02/2025',
  valor_programa: '3.000.000',
  forma_pago: 'cuotas',
  cuotas_totales: '4',
  garantia: 'no',
}

export function csvDePlantilla(): string {
  const encabezados = encabezadosDePlantilla()
  const fila: Record<string, string> = {}
  for (const h of encabezados) fila[h] = EJEMPLO[h] ?? ''
  for (const doc of DOCUMENTOS_DE_PLANILLA) {
    fila[`texto_${doc.tipo}`] = doc.tipo === 'onboarding' ? 'Acá va el texto del onboarding tal como está.' : ''
  }
  return Papa.unparse({ fields: encabezados, data: [fila] })
}

/** Para la pantalla: qué encabezado alternativo se acepta para cada campo. */
export function columnasQueSeEntienden() {
  // Los sinónimos se muestran sin repetir el nombre de la columna: el nombre de
  // la columna ya está a la izquierda, y repetirlo es ruido.
  const otros = (clave: string, sinonimos: readonly string[]) =>
    sinonimos.filter((s) => plegado(s) !== plegado(clave))

  return [
    { clave: 'id_cliente', etiqueta: 'Id del cliente (opcional)', sinonimos: ['id', 'identificador', 'ref', 'referencia', 'codigo'] },
    ...CAMPOS.map((c) => ({ clave: c.clave, etiqueta: c.etiqueta, sinonimos: otros(c.clave, c.sinonimos) })),
    ...DOCUMENTOS_DE_PLANILLA.map((d) => ({
      clave: `texto_${d.tipo}`, etiqueta: d.etiqueta, sinonimos: otros(`texto_${d.tipo}`, d.sinonimos),
    })),
  ]
}


// ── La cartera, exportada con los mismos encabezados ────────────────────────

/** Cómo se escribe cada valor para que vuelva a entrar tal cual salió. */
function escribirValor(campo: Campo, valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  switch (campo.tipo) {
    case 'booleano':
      return valor ? 'sí' : 'no'
    case 'fecha':
      return String(valor).slice(0, 10).split('-').reverse().join('/')
    case 'numero':
    case 'entero':
      // Sin separador de miles: así no depende de cómo esté configurada la planilla.
      return String(valor)
    default:
      return String(valor)
  }
}

export type ClienteExportable = { ref_externa: string | null; consultora: string | null } & Record<string, unknown>

export function csvDeCartera(clientes: readonly ClienteExportable[]): string {
  const encabezados = encabezadosDePlantilla().filter((h) => !h.startsWith('texto_'))
  const data = clientes.map((cliente) => {
    const fila: Record<string, string> = { id_cliente: cliente.ref_externa ?? '' }
    for (const campo of CAMPOS) {
      fila[campo.clave] = campo.clave === 'consultora'
        ? (cliente.consultora ?? '')
        : escribirValor(campo, cliente[campo.clave])
    }
    return fila
  })
  return Papa.unparse({ fields: encabezados, data })
}
