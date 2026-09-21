import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /** Superfícies claras: página, cartões, campos e trilhas. */
        paper: {
          DEFAULT: "#f7f5f0",
          50: "#fdfcfa",
          100: "#f2efe7",
          200: "#e8e3d6",
          300: "#dcd5c4",
        },
        /** Texto e traços escuros. Usado com opacidade: text-ink/60 etc. */
        ink: {
          DEFAULT: "#1c1813",
          900: "#1c1813",
          800: "#2a251d",
          700: "#3c352b",
          600: "#5a5245",
          500: "#736a5b",
        },
        /**
         * Dourado calibrado para fundo claro: o DEFAULT passa contraste AA
         * como texto; `light`/`bright` servem para preenchimentos e brilhos.
         */
        gold: {
          DEFAULT: "#8a6b1c",
          dim: "#6d5416",
          light: "#c9a227",
          bright: "#e8c55a",
          pale: "#f4e8c4",
        },
        crimson: {
          DEFAULT: "#a8202f",
          dim: "#7d1622",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      fontWeight: {
        "700": "700",
        "800": "800",
      },
      backgroundImage: {
        "gold-metal":
          "linear-gradient(135deg, #a3812a 0%, #f0d97a 25%, #d4af37 50%, #f6e6a8 65%, #a3812a 100%)",
        "paper-radial":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(201,162,39,0.18), transparent), radial-gradient(ellipse 60% 50% at 90% 10%, rgba(168,32,47,0.05), transparent)",
        noise: "url('/noise.png')",
      },
      boxShadow: {
        gold: "0 0 0 1px rgba(138,107,28,0.35), 0 8px 24px -10px rgba(138,107,28,0.35)",
        "gold-lg":
          "0 0 0 1px rgba(138,107,28,0.45), 0 18px 45px -14px rgba(138,107,28,0.45)",
        card: "0 1px 2px rgba(28,24,19,0.05), 0 8px 24px -14px rgba(28,24,19,0.18)",
        "card-hover": "0 2px 4px rgba(28,24,19,0.06), 0 22px 50px -18px rgba(28,24,19,0.28)",
      },
      keyframes: {
        shine: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        shine: "shine 2.5s linear infinite",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
        marquee: "marquee 22s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
