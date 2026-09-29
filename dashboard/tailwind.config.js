/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0B2545",
          50: "#EAF0F7",
          100: "#D3DEEB",
          200: "#A9BED6",
          300: "#7A97B5",
          400: "#4E7396",
          500: "#2B5878",
          600: "#1B4965",
          700: "#143A52",
          800: "#0B2545",
          900: "#071A30",
          950: "#04101E",
          dark: "#071A30",
          light: "#EAF0F7",
        },
        hazard: {
          DEFAULT: "#C97B5A",
          50: "#FBF3EC",
          100: "#F5E0D2",
          200: "#E9C2A8",
          300: "#D89F7D",
          400: "#CF8A63",
          500: "#C97B5A",
          600: "#A96647",
          700: "#7F4F38",
          800: "#5C3828",
          900: "#3E2519",
        },
        caution: {
          DEFAULT: "#D9A566",
          dark: "#A67C3B",
          light: "#F5E8CF",
        },
        success: {
          DEFAULT: "#7A9B76",
          dark: "#5A7557",
          light: "#E7EFE7",
        },
        alert: {
          DEFAULT: "#C17B72",
          dark: "#96564E",
          light: "#F5E7E4",
        },
        ink: "#2D3436",
        paper: "#F5F6F8",
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Ol Chiki", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};