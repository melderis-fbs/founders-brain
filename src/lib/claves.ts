import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (clave: string, sal: Buffer, largo: number) => Promise<Buffer>

export async function hashearClave(clave: string): Promise<string> {
  const sal = randomBytes(16)
  const derivada = await scrypt(clave, sal, 64)
  return `scrypt:${sal.toString('hex')}:${derivada.toString('hex')}`
}

export async function claveCoincide(clave: string, hash: string): Promise<boolean> {
  const [algoritmo, salHex, esperadoHex] = hash.split(':')
  if (algoritmo !== 'scrypt' || !salHex || !esperadoHex) return false
  const derivada = await scrypt(clave, Buffer.from(salHex, 'hex'), 64)
  const esperado = Buffer.from(esperadoHex, 'hex')
  if (derivada.length !== esperado.length) return false
  return timingSafeEqual(derivada, esperado)
}
