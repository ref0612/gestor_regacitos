import './globals.css'

export const metadata = {
  title: 'Medio Menor B - Regacito',
  description: 'Sistema de gestión financiera para el jardín Regacito',
  icons: {
    icon: '/favicon.ico', // Esto fuerza la ruta del favicon
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
