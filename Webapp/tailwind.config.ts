import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        'triangles': "url('/background.svg')"
      },
      backgroundColor: {
        'background': '#312D2C',
        'auxiliary1': '#f7412a'
      },
      colors: {
        'background': '#312D2C',
        'auxiliary1': '#f7412a',
        'auxillary2': '#f1bb2e',
        'backgroundTransparent': "rgba(51,51,51,0.7)"
      }
    }
  },
  plugins: [],
} satisfies Config;
