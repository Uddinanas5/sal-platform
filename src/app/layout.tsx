import type { Metadata, Viewport } from "next";
import { DM_Sans, Sora } from "next/font/google";
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

export const metadata: Metadata = {
  title: "SAL - The All-in-One Platform for Salons & Spas",
  description: "The all-in-one platform for salons & spas. Manage appointments, clients, staff, and payments — all in one beautiful dashboard. Free to get started.",
  keywords: ["salon software", "spa management", "booking system", "appointment scheduling", "salon POS", "beauty business"],
  authors: [{ name: "SAL Platform" }],
  creator: "SAL Platform",
  publisher: "SAL Platform",
  metadataBase: new URL("https://www.meetsal.ai"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.meetsal.ai",
    siteName: "SAL Platform",
    title: "SAL - The All-in-One Platform for Salons & Spas",
    description: "Manage appointments, clients, staff, and payments — all in one beautiful dashboard. Free to get started.",
    images: [
      {
        url: "/logos/sal-full.svg",
        width: 1200,
        height: 630,
        alt: "SAL Platform - Salon & Spa Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SAL - The All-in-One Platform for Salons & Spas",
    description: "Manage appointments, clients, staff, and payments — all in one beautiful dashboard.",
    images: ["/logos/sal-full.svg"],
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
  // Favicons are handled by Next.js file conventions:
  // src/app/favicon.ico, src/app/icon.svg, src/app/apple-icon.png
};

export const viewport: Viewport = {
  themeColor: "#062318",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${sora.variable}`} suppressHydrationWarning>
      <body className="antialiased font-sans">
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
