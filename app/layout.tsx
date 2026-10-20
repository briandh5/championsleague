import type { Metadata, Viewport } from "next";
import { Manrope, Saira_Condensed } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const cuerpo = Manrope({ subsets: ["latin"], variable: "--font-cuerpo", display: "swap" });
const titulo = Saira_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-titulo", display: "swap" });

export const metadata: Metadata = {
  title: "La Previa · Champions con tus amigos",
  description: "Coordina dónde ver cada partido de la Champions: mapa con pines y hashtags, calendario por fases, recordatorios y chat por plan.",
};

export const viewport: Viewport = {
  themeColor: "#0b0e28",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${cuerpo.variable} ${titulo.variable}`}>
      <body className="bg-noche font-sans text-white antialiased">{children}</body>
    </html>
  );
}
