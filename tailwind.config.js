module.exports = {
  content: [
    "./src/**/*.{html,js,ejs}",
    "./views/**/*.{html,js,ejs}",
    "./dist/**/*.{html,js}"
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
        },
        sidebar: {
          background: '#ffffff',
          foreground: '#1f2937',
          border: '#e5e7eb',
          hover: '#f3f4f6',
          active: '#eff6ff',
          'active-text': '#1d4ed8',
          'active-border': '#dbeafe'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Monaco', 'Courier New', 'monospace']
      },
      spacing: {
        '16': '4rem',
        '64': '16rem'
      },
      width: {
        'sidebar-collapsed': '4rem',
        'sidebar-expanded': '16rem'
      },
      transitionProperty: {
        'width': 'width',
        'transform': 'transform'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in-left': 'slideInLeft 0.3s ease-in-out',
        'slide-out-left': 'slideOutLeft 0.3s ease-in-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' }
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ],
  darkMode: 'class'
}