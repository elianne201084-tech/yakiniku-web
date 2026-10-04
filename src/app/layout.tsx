import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Chasqui Market: compra en línea en Ecuador", template: "%s | Chasqui Market" },
  description: "Miles de productos con envío a todo el Ecuador y pago contra entrega.",
  openGraph: { locale: "es_EC", type: "website", siteName: "Chasqui Market" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#c8341e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-EC">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
