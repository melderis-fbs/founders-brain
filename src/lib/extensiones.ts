/**
 * QUÉ ARCHIVOS SABE LEER LA APLICACIÓN
 *
 * Vive solo, sin `mammoth` ni `unpdf` al lado, porque esta lista la necesita
 * también la pantalla: cuando alguien arrastra quince archivos, los que no se
 * pueden leer tienen que decirlo ANTES de subir nada, no después. Si la lista
 * viviera en `extraer-archivo.ts`, importarla desde el navegador se traería las
 * dos librerías de extracción al bundle.
 */

/** Los que entran tal cual, sin extraer nada. */
export const PLANOS = ['.txt', '.md', '.csv', '.vtt', '.srt', '.json', '.log'] as const

/** Los que hay que abrir para sacarles el texto. */
export const EXTRAIBLES = ['.pdf', '.docx'] as const

export const ACEPTADAS: readonly string[] = [...PLANOS, ...EXTRAIBLES]

/** Para el atributo `accept` de un input de archivo. */
export const EXTENSIONES_ACEPTADAS = ACEPTADAS.join(',')

export function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf('.')
  return i < 0 ? '' : nombre.slice(i).toLowerCase()
}

/**
 * Por qué no se va a poder leer este archivo, o null si sí se puede.
 *
 * Contesta con el motivo y no con un `false`, porque regla 10: lo que se saltea
 * se informa con su razón. «No entró» a secas obliga a adivinar.
 */
export function porQueNoSeLee(nombre: string): string | null {
  const ext = extensionDe(nombre)
  if (ACEPTADAS.includes(ext)) return null
  if (ext === '.doc') return '.doc es el formato viejo de Word. Abrilo y guardalo como .docx.'
  if (ext === '.pages') return '.pages es de Apple. Exportalo a .docx o a PDF.'
  if (['.jpg', '.jpeg', '.png', '.heic', '.gif', '.webp'].includes(ext)) {
    return 'Es una imagen: no tiene texto adentro. Hay que pasarla por un OCR.'
  }
  if (['.mp3', '.mp4', '.m4a', '.mov', '.wav'].includes(ext)) {
    return 'Es audio o video. Subí la transcripción, no la grabación.'
  }
  if (['.xlsx', '.xls'].includes(ext)) return 'Es una planilla. Exportala a .csv.'
  return `No sé leer «${ext || 'un archivo sin extensión'}». Entran ${EXTENSIONES_ACEPTADAS}.`
}
