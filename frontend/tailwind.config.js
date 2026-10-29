import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{js,ts,jsx,tsx}'),
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './frontend/index.html',
    './frontend/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#060A17",
          900: "#0B132B", // Deep Navy
          800: "#0F172A", // Slate Navy
          700: "#1E293B",
          600: "#334155",
        },
        cirrho: {
          blue: "#3B82F6",
          purple: "#8B5CF6",
          teal: "#14B8A6",
          pink: "#EC4899",
          orange: "#F59E0B",
          green: "#22C55E",
          bg: "#F8FAFC",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Inter", "'Noto Sans Devanagari'", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        heading: ["'Plus Jakarta Sans'", "Inter", "'Noto Sans Devanagari'", "sans-serif"],
        devanagari: ["'Noto Sans Devanagari'", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)",
        glow: "0 0 25px -5px rgba(59, 130, 246, 0.25)",
        "glow-purple": "0 0 25px -5px rgba(139, 92, 246, 0.25)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
