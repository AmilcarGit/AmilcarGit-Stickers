import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YuiApi",
    short_name: "YuiApi",
    description: "API pública de búsqueda, stickers y herramientas.",
    start_url: "/",
    display: "standalone",
    background_color: "#140c1e",
    theme_color: "#f472b6",
    lang: "es",
    scope: "/",
    orientation: "portrait",
    categories: ["developer", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Endpoints", url: "/endpoints" },
      { name: "Mi panel", url: "/dashboard" },
    ],
  };
}
