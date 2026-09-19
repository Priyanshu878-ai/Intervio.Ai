/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#07090E',
          900: '#0B0F17',
          850: '#101623',
          800: '#161F30',
          750: '#1C273C',
          700: '#23314B',
        },
        brand: {
          500: '#6366F1',
          400: '#818CF8',
          cyan: '#06B6D4',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E',
        }
      },
      boxShadow: {
        '3d-subtle': '0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.08) inset',
        '3d-card': '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 1px 2px 0 rgba(255, 255, 255, 0.1) inset, 0 -1px 2px 0 rgba(0, 0, 0, 0.4) inset',
        '3d-button': '0 6px 0 0 #4338CA, 0 12px 20px -6px rgba(99, 102, 241, 0.5)',
        '3d-button-active': '0 2px 0 0 #4338CA, 0 6px 10px -4px rgba(99, 102, 241, 0.5)',
        '3d-glow': '0 0 25px -5px rgba(99, 102, 241, 0.25)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
