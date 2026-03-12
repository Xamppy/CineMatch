import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CineMatch — Elige películas en pareja",
  description:
    "Una plataforma tipo Tinder para que parejas elijan películas mediante matches en tiempo real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans`}>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
