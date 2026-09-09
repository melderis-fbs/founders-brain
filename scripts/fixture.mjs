// Genera una planilla de prueba parecida a la real: 194 clientes, 7 consultoras
// y un puñado de filas rotas a propósito, para ver el reporte de importación.
import { writeFileSync } from 'node:fs'

const consultoras = ['Lucía Fernández', 'Mariana Rossi', 'Paula Giménez', 'Sofía Álvarez', 'Camila Duarte', 'Valentina Ruiz', 'Julieta Ponce']
const nombres = ['Norma', 'Juan', 'Carla', 'Diego', 'Marta', 'Pablo', 'Silvia', 'Ramiro', 'Andrea', 'Gustavo', 'Verónica', 'Hernán', 'Lorena', 'Matías', 'Cecilia', 'Rodrigo', 'Patricia', 'Nicolás', 'Gabriela', 'Fernando']
const apellidos = ['Márquez', 'Pérez', 'Gómez', 'Suárez', 'Torres', 'Ledesma', 'Ibáñez', 'Molina', 'Ferreyra', 'Quiroga', 'Sosa', 'Núñez', 'Ramírez', 'Aguirre', 'Villalba', 'Cabrera', 'Benítez', 'Escobar', 'Ojeda', 'Bravo']
const rubros = ['Diseño de interiores', 'Nutrición', 'Contabilidad', 'Fotografía', 'Marketing', 'Arquitectura', 'Coaching', 'Estética', 'Indumentaria', 'Software a medida']
const estados = ['activo', 'activo', 'activo', 'activo', 'pausado', 'finalizado', 'baja']

let semilla = 7
const azar = () => ((semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648)
const uno = (a) => a[Math.floor(azar() * a.length)]
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1))

const encabezados = ['id_cliente','nombre','consultora','email','telefono','programa','fecha inicio','estado','rubro','que vende','cliente ideal','problema','oferta','promesa','mensaje','canal','diferencial','modelo','antiguedad','equipo','moneda','ticket','meta mensual','facturacion actual','precio','ventas ultimo mes','tracker','cuenta inversa','valor programa','forma de pago','cuotas','garantia','texto_onboarding','notas','color favorito']

const escapar = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const filas = [encabezados.join(',')]

const usados = new Set()
let primerNombre = ''
for (let i = 1; i <= 194; i++) {
  let nombre
  do { nombre = `${uno(nombres)} ${uno(apellidos)}` } while (usados.has(nombre))
  usados.add(nombre)
  if (i === 1) primerNombre = nombre

  const meses = azar() < 0.6 ? 4 : 6
  // Arranques repartidos en las últimas 30 semanas, contadas desde hoy.
  const hoy = new Date()
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - entre(0, 210))) 
  const ticket = entre(3, 30) * 100000
  const completo = azar() < 0.35   // la mayoría tiene la ficha a medias, como en la vida real

  const f = {
    id_cliente: `FB-${String(i).padStart(3, '0')}`,
    nombre,
    consultora: uno(consultoras),
    email: azar() < 0.8 ? `${nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ /g, '.')}@ejemplo.com` : '',
    telefono: azar() < 0.6 ? `+54 9 11 ${entre(4000, 6999)} ${entre(1000, 9999)}` : '',
    programa: meses,
    'fecha inicio': `${String(inicio.getUTCDate()).padStart(2, '0')}/${String(inicio.getUTCMonth() + 1).padStart(2, '0')}/${inicio.getUTCFullYear()}`,
    estado: uno(estados),
    rubro: uno(rubros),
    'que vende': completo ? 'Servicio profesional a medida' : '',
    'cliente ideal': completo ? 'Dueños de negocios chicos que ya facturan' : '',
    problema: completo ? 'No tiene un proceso de venta que se repita' : '',
    oferta: completo ? 'Programa de 8 semanas con seguimiento' : '',
    promesa: completo ? 'Duplicar las conversaciones en 60 días' : '',
    mensaje: azar() < 0.4 ? 'Dejá de vender por referidos' : '',
    canal: azar() < 0.5 ? uno(['Instagram', 'LinkedIn', 'WhatsApp', 'Referidos']) : '',
    diferencial: completo ? 'Acompaña la ejecución, no sólo la estrategia' : '',
    modelo: azar() < 0.7 ? uno(['servicio', 'producto', 'infoproducto']) : '',
    antiguedad: azar() < 0.6 ? entre(1, 15) : '',
    equipo: azar() < 0.5 ? entre(0, 8) : '',
    moneda: 'ARS',
    ticket: azar() < 0.75 ? ticket.toLocaleString('es-AR') : '',
    'meta mensual': azar() < 0.6 ? (ticket * entre(2, 6)).toLocaleString('es-AR') : '',
    'facturacion actual': azar() < 0.5 ? (ticket * entre(1, 3)).toLocaleString('es-AR') : '',
    precio: azar() < 0.5 ? ticket.toLocaleString('es-AR') : '',
    'ventas ultimo mes': azar() < 0.55 ? entre(0, 4) : '',
    tracker: azar() < 0.5 ? uno(['sí', 'no']) : '',
    'cuenta inversa': azar() < 0.4 ? `${String(inicio.getUTCDate()).padStart(2, '0')}/${String(inicio.getUTCMonth() + 1).padStart(2, '0')}/${inicio.getUTCFullYear()}` : '',
    'valor programa': azar() < 0.6 ? (meses === 4 ? '2.400.000' : '3.600.000') : '',
    'forma de pago': azar() < 0.6 ? uno(['contado', 'cuotas']) : '',
    cuotas: azar() < 0.4 ? meses : '',
    garantia: azar() < 0.3 ? 'sí' : '',
    texto_onboarding: azar() < 0.45 ? `Onboarding de ${nombre}. Vende ${uno(rubros).toLowerCase()} y quiere ordenar su venta.` : '',
    notas: azar() < 0.2 ? 'Viene de una consultora anterior.' : '',
    'color favorito': uno(['verde', 'azul', 'ninguno']),
  }
  filas.push(encabezados.map((h) => escapar(f[h])).join(','))
}

// Filas rotas a propósito, para que el reporte tenga qué contar.
const vacia = Object.fromEntries(encabezados.map((h) => [h, '']))
const rota = (cambios) => filas.push(encabezados.map((h) => escapar({ ...vacia, ...cambios }[h])).join(','))

rota({ id_cliente: 'FB-195', nombre: '', consultora: 'Mariana Rossi', estado: 'activo' })
// El mismo nombre sin acentos y en minúscula: regla 3, no entra y se informa.
rota({ id_cliente: 'FB-196', nombre: primerNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), consultora: 'Mariana Rossi', estado: 'activo' })
rota({ id_cliente: 'FB-197', nombre: 'Tomás Iriarte', consultora: 'Paula Giménez', programa: '4', 'fecha inicio': 'cuando pueda', 'meta mensual': 'lo que salga', estado: 'activo' })
rota({ id_cliente: 'FB-198', nombre: 'Elena Suárez', consultora: 'Paula Giménez', programa: '4', 'fecha inicio': '10/03/2026', estado: 'congelado' })
rota({ id_cliente: 'FB-199', nombre: 'Elena Suárez', consultora: 'Paula Giménez', programa: '6', 'fecha inicio': '11/03/2026', estado: 'activo' })

writeFileSync('fixtures/planilla-madre-ejemplo.csv', '﻿' + filas.join('\n') + '\n')
console.log(`fixtures/planilla-madre-ejemplo.csv · ${filas.length - 1} filas`)
