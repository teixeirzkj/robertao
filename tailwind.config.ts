import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#050505",
          900: "#0a0a0b",
          800: "#111113",
          700: "#18181b",
          600: "#212124",
          500: "#2a2a2e",
        },
        gold: {
          DEFAULT: "#d4af37",
          light: "#f4e2a8",
          bright: "#ffd875",
          dim: "#a3812a",
        },
        crimson: {
          DEFAULT: "#e8384f",
          dim: "#b32c3f",
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
          "linear-gradient(135deg, #a3812a 0%, #f4e2a8 25%, #d4af37 50%, #ffd875 65%, #a3812a 100%)",
        "ink-radial":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(212,175,55,0.15), transparent), radial-gradient(ellipse 60% 50% at 90% 10%, rgba(232,56,79,0.08), transparent)",
        noise: "url('/noise.png')",
      },
      boxShadow: {
        gold: "0 0 0 1px rgba(212,175,55,0.4), 0 8px 30px -8px rgba(212,175,55,0.35)",
        "gold-lg": "0 0 0 1px rgba(212,175,55,0.5), 0 20px 60px -12px rgba(212,175,55,0.45)",
        card: "0 4px 24px -6px rgba(0,0,0,0.5)",
        "card-hover": "0 20px 50px -12px rgba(0,0,0,0.7)",
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
