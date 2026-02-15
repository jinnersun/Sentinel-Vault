/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#1a1b26',
        surface: '#24283b',
        surface2: '#414868',
        text: '#c0caf5',
        text2: '#9aa5ce',
        accent: '#7aa2f7',
        accent2: '#89b4fa',
        success: '#9ece6a',
        warning: '#e0af68',
        error: '#f7768e',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Cascadia Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-border': 'pulseBorder 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseBorder: {
          '0%': { borderColor: '#9ece6a' },
          '100%': { borderColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
}