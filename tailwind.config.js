module.exports = {
  content: [
    "./src/**/*.{html,js,ejs}",
    "./views/**/*.{html,js,ejs}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#10a37f',
          hover: '#0d8f6f',
          light: '#d1f4e8'
        },
        surface: {
          DEFAULT: '#f7f7f8',
          hover: '#f0f0f0',
          dark: '#202123'
        },
        text: {
          primary: '#202123',
          secondary: '#6e6e80',
          tertiary: '#acacbe',
          inverse: '#ffffff'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Monaco', 'Courier New', 'monospace']
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ]
}