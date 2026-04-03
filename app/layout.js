import './globals.css'

export const metadata = {
  title: 'Gestor Regacitos',
  description: 'Sistema de gestión financiera para el jardín Regacitos',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
