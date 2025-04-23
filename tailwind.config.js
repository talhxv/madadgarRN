/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        mdgreen: '#53F3AE',
      },
      fontFamily: {
        pthin: ["Poppins-Thin", "sans-serif"],
        pextralight: ["Poppins-ExtraLight", "sans-serif"],
        plight: ["Poppins-Light", "sans-serif"],
        pregular: ["Poppins-Regular", "sans-serif"],
        pmedium: ["Poppins-Medium", "sans-serif"],
        psemibold: ["Poppins-SemiBold", "sans-serif"],
        pbold: ["Poppins-Bold", "sans-serif"],
        pextrabold: ["Poppins-ExtraBold", "sans-serif"],
        pblack: ["Poppins-Black", "sans-serif"],
        pitalic: ["Poppins-Italic", "sans-serif"],
        pextralightitalic: ["Poppins-ExtraLightItalic", "sans-serif"],
        plightitalic: ["Poppins-LightItalic", "sans-serif"],
        pextrabolditalic: ["Poppins-ExtraBoldItalic", "sans-serif"],
        pblackitalic: ["Poppins-BlackItalic", "sans-serif"],
        pmediumitalic: ["Poppins-MediumItalic", "sans-serif"],
        pthinitalic: ["Poppins-ThinItalic", "sans-serif"],
        psemibolditalic: ["Poppins-SemiBoldItalic", "sans-serif"],

      },
    },
  },
  plugins: [],
}