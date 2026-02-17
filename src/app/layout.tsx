import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAL - AI Operations Partner",
  description: "Smart salon and wellness management platform powered by AI",
  icons: {
    icon: "/logos/sal-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
