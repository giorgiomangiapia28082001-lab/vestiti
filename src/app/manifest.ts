import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Wardrobe — il tuo guardaroba intelligente",
    short_name: "Wardrobe",
    description: "Organizza il guardaroba e crea outfit con il tuo stylist AI personale.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f2eb",
    theme_color: "#f6f2eb",
    lang: "it",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
