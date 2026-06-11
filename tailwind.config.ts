import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SAL Brand Colors — Emerald Green (meetsal.ai)
        // 50–200 are alpha-mint tints so legacy `bg-sal-50` chips read as
        // frosted mint on the dark environment; 300–950 stay solid brand.
        sal: {
          50: 'rgba(79,230,166,0.08)',
          100: 'rgba(79,230,166,0.15)',
          200: 'rgba(79,230,166,0.28)',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#059669', // Primary emerald
          600: '#047857',
          700: '#065f46',
          800: '#064e3b',
          900: '#022c22',
          950: '#012517',
        },
        // The frost ramp: legacy cream-* borders/fills become white-alpha
        // hairlines and glass tints with zero TSX edits.
        cream: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          50: 'rgba(255,255,255,0.04)',
          100: 'rgba(255,255,255,0.07)',
          200: 'rgba(255,255,255,0.14)', // THE hairline
          300: 'rgba(255,255,255,0.20)',
          400: 'rgba(255,255,255,0.28)',
          800: 'rgba(255,255,255,0.10)',
          900: 'rgba(255,255,255,0.06)',
        },
        // The sparing accent
        mint: {
          DEFAULT: '#4fe6a6',
          soft: '#8aeec6',
          strong: '#2dd790',
        },
        // Foreground alpha scale (readability contract)
        ink: {
          DEFAULT: '#ffffff',
          soft: 'rgba(255,255,255,0.74)',
          faint: 'rgba(255,255,255,0.48)',
        },
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "#059669",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        // border/input embed alpha in the var itself — no <alpha-value>
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "#4fe6a6",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "calc(var(--radius) + 6px)",
        "3xl": "calc(var(--radius) + 14px)",
        panel: "var(--r-panel)",
        tile: "var(--r-tile)",
      },
      boxShadow: {
        // Deep-environment elevation — same token names, retuned for frost.
        soft: "0 1px 2px rgba(0, 9, 5, 0.25), 0 1px 3px rgba(0, 9, 5, 0.25)",
        card: "0 8px 18px -12px rgba(0, 9, 5, 0.45)",
        float: "0 24px 48px -24px rgba(0, 9, 5, 0.55)",
        // Glow tokens fold in a top inner highlight so a single class gives
        // colored surfaces both lift and a glassy sheen.
        glow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.30), 0 10px 30px -8px rgba(79, 230, 166, 0.40)",
        "glow-sm": "inset 0 1px 0 0 rgba(255, 255, 255, 0.26), 0 4px 14px -4px rgba(79, 230, 166, 0.35)",
        "inset-hi": "inset 0 1px 0 0 rgba(255, 255, 255, 0.30)",
        "led-mint": "0 0 0 2.5px rgba(79, 230, 166, 0.16), 0 0 9px 1px rgba(79, 230, 166, 0.75)",
        panel: "inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 24px 48px -24px rgba(0, 9, 5, 0.55)",
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-sora)', 'var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-12px) scale(1.03)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "float-slow": "float-slow 9s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
