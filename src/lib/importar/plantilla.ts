import Papa from 'papaparse'
import { CAMPOS, DOCUMENTOS_DE_PLANILLA } from '../campos'
import { encabezadosDePlantilla } from './mapeo'

/**
 * La plantilla que se baja desde la pantalla de importar: los encabezados que
 * la aplicación entiende y una fila de ejemplo, para que la planilla madre y la
 * aplicación hablen el mismo idioma sin que nadie tenga que adivinarlo.
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
  return [
    { clave: 'id_cliente', etiqueta: 'Id del cliente (opcional)', sinonimos: ['id', 'identificador', 'ref', 'referencia', 'codigo'] },
    ...CAMPOS.map((c) => ({ clave: c.clave, etiqueta: c.etiqueta, sinonimos: [...c.sinonimos] })),
    ...DOCUMENTOS_DE_PLANILLA.map((d) => ({ clave: `texto_${d.tipo}`, etiqueta: d.etiqueta, sinonimos: [...d.sinonimos] })),
  ]
}
