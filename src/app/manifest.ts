import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AmilcarGit Stickers",
    short_name: "Stickers",
    description: "Crea stickers 3D y animados para WhatsApp.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0818",
    theme_color: "#8b5cf6",
    lang: "es",
  };
}
