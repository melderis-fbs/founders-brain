import type { Metadata } from 'next'
import './globales.css'

export const metadata: Metadata = {
  title: 'Founders Brain',
  description: 'Dónde está cada cliente, y dónde tendría que estar.',
}

export default function Raiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
