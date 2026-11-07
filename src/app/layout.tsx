import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "YuiApi — API de búsqueda, stickers y herramientas",
    template: "%s · YuiApi",
  },
  description:
    "API pública con clave gratuita: busca stickers, música, anime, Wikipedia, libros e imágenes libres, y usa herramientas como QR, hashes y convertidor de stickers para WhatsApp.",
  applicationName: "YuiApi",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "YuiApi", statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    siteName: "YuiApi",
    title: "YuiApi 🌸",
    description: "API pública de búsqueda, stickers y herramientas.",
    locale: "es_ES",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#140c1e" },
    { media: "(prefers-color-scheme: light)", color: "#fff7fb" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Aplica el tema guardado antes de pintar para evitar el parpadeo claro/oscuro.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <a
            href="#contenido"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand"
          >
            Saltar al contenido
          </a>
          <Header />
          <main id="contenido" className="mx-auto w-full max-w-6xl px-4 py-8">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
