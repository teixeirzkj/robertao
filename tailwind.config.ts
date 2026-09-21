import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /**
         * Superfícies, do fundo da página para cima. As cores vêm do print de
         * referência: página #141c24, cartão #212b36, traços #44505c.
         */
        paper: {
          DEFAULT: "#141c24",
          50: "#1a2230",
          100: "#212b36",
          200: "#2b3644",
          300: "#3a4655",
        },
        /**
         * Texto e traços claros. Usado com opacidade (text-ink/60).
         * `ink-900` é o oposto — texto escuro sobre o dourado.
         */
        ink: {
          DEFAULT: "#f2f5f8",
          900: "#141c24",
          800: "#1a2230",
          700: "#2b3644",
          600: "#5a6675",
          500: "#909ca8",
        },
        /** Dourado calibrado para fundo escuro. */
        gold: {
          DEFAULT: "#e2b83c",
          dim: "#b8901f",
          light: "#f0d97a",
          bright: "#ffe9a8",
          pale: "#4a3d18",
        },
        crimson: {
          DEFAULT: "#ff5a68",
          dim: "#c22c3a",
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
          "linear-gradient(135deg, #b8901f 0%, #f0d97a 25%, #e2b83c 50%, #ffe9a8 65%, #b8901f 100%)",
        "paper-radial":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(226,184,60,0.16), transparent), radial-gradient(ellipse 60% 50% at 90% 10%, rgba(255,90,104,0.06), transparent)",
        noise: "url('/noise.png')",
      },
      boxShadow: {
        gold: "0 0 0 1px rgba(226,184,60,0.35), 0 8px 26px -10px rgba(226,184,60,0.30)",
        "gold-lg":
          "0 0 0 1px rgba(226,184,60,0.45), 0 18px 46px -14px rgba(226,184,60,0.40)",
        card: "0 1px 2px rgba(0,0,0,0.30), 0 10px 26px -14px rgba(0,0,0,0.55)",
        "card-hover": "0 2px 4px rgba(0,0,0,0.35), 0 24px 54px -18px rgba(0,0,0,0.70)",
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
