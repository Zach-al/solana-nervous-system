/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0F',
        surface: '#13131A',
        surfaceHover: '#1C1C26',
        border: '#2A2A3A',
        primary: '#00FF88',
        primaryDim: '#00CC6A',
        accent: '#9945FF',
        accentDim: '#7B33CC',
        text: '#FFFFFF',
        textSecondary: '#9999AA',
        textTertiary: '#55556A',
        danger: '#FF4444',
        warning: '#FFAA00',
      }
    },
  },
  plugins: [],
}
