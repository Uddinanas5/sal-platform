import type { Metadata, Viewport } from "next";
import { DM_Sans, Sora, Archivo, Space_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

// Brutalist landing-page type system: heavy grotesque display + technical mono.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SAL — The Operating System for Barbershops",
  description: "Run the chair, not the front desk. SAL is the booking + management software built for barbershops — with an AI crew on the way. Free during beta.",
  keywords: ["barbershop software", "barber booking app", "barbershop management", "barber POS", "appointment scheduling", "AI barbershop"],
  authors: [{ name: "SAL" }],
  creator: "SAL",
  publisher: "SAL",
  metadataBase: new URL("https://www.meetsal.ai"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.meetsal.ai",
    siteName: "SAL",
    title: "SAL — The Operating System for Barbershops",
    description: "Run the chair, not the front desk. Booking + management built for barbershops, with an AI crew on the way. Free during beta.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SAL — The Operating System for Barbershops",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SAL — The Operating System for Barbershops",
    description: "Run the chair, not the front desk. Built for barbershops, with an AI crew on the way.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/logos/sal-icon.svg",
    apple: "/logos/sal-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${sora.variable} ${archivo.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("sal-theme");if(t==="dark")document.documentElement.classList.add("dark");else if(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased font-sans">
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
