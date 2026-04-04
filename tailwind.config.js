/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // --- LA NUEVA PALETA REGACITOS ---
        
        // 1. Verde Regacito (de la ropa esmeralda) -> Tu color principal
        brand: {
          50: '#f1f8f6',
          100: '#ddeee8',
          200: '#bdddd0',
          300: '#94c6b2',
          400: '#64a78c',
          500: '#2d8465', // El tono exacto
          600: '#1e6a51',
          700: '#175542',
          800: '#124436',
          900: '#0c352a', // Para fondos oscuros (ej: barra lateral)
          950: '#071f19',
        },
        
        // 2. Naranja Acento (del vestido) -> Para botones principales
        accent: {
          50: '#fff9ed',
          100: '#fff0d3',
          200: '#ffdfa6',
          300: '#ffc76f',
          400: '#ffa73c',
          500: '#ff8c1a', // El tono exacto del logo
          600: '#f07412',
          700: '#c85910',
          800: '#9f4713',
          900: '#803c13',
        },

        // 3. Azul Luna (del fondo) -> Para "Pendiente", fondos claros
        luna: {
          50: '#f2f8fc',
          100: '#e1f0f8',
          200: '#cae3f1',
          300: '#a7d0e8',
          400: '#7eb6dc',
          500: '#60a2d2', // El tono de la luna
          600: '#4c87b9',
          700: '#3f6d97',
          800: '#385d7d',
          900: '#324e68',
        },

        // 4. Morado Secundario (de las mangas) -> Para el Tesorero
        manga: {
          50: '#f6f3f9',
          100: '#ece7f2',
          200: '#dbd1e8',
          300: '#c2afda',
          400: '#a286c9',
          500: '#7e57b1', // El tono de las mangas
          600: '#6d459c',
          700: '#5c3883',
          800: '#4d2f6e',
          900: '#41295b',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
