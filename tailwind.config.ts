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
        sal: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#059669', // Primary emerald
          600: '#047857',
          700: '#065f46',
          800: '#064e3b',
          900: '#022c22',
          950: '#012517',
        },
        cream: {
          DEFAULT: '#f5f5f0',
          50: '#fafaf7',
          100: '#f5f5f0',
          200: '#eeeee6',
          300: '#e2e0d5',
          400: '#ccc9b8',
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "#059669",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "#059669",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "calc(var(--radius) + 6px)",
        "3xl": "calc(var(--radius) + 14px)",
      },
      boxShadow: {
        // Warm, emerald-tinted elevation — surfaces read as one cohesive
        // material instead of boxes floating on flat black shadows.
        soft: "0 1px 2px rgba(16, 64, 48, 0.04), 0 1px 3px rgba(16, 64, 48, 0.05)",
        card: "0 1px 2px rgba(16, 64, 48, 0.04), 0 6px 16px -6px rgba(16, 64, 48, 0.10)",
        float:
          "0 2px 4px rgba(16, 64, 48, 0.04), 0 16px 40px -12px rgba(16, 64, 48, 0.20)",
        // Glow tokens fold in a top inner highlight so a single class gives
        // colored surfaces both lift and a glassy sheen.
        glow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.18), 0 10px 30px -8px rgba(5, 150, 105, 0.45)",
        "glow-sm": "inset 0 1px 0 0 rgba(255, 255, 255, 0.16), 0 4px 14px -4px rgba(5, 150, 105, 0.40)",
        "inset-hi": "inset 0 1px 0 0 rgba(255, 255, 255, 0.14)",
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
