import type { MetadataRoute } from "next";

// Permite instalar la app en el cel (en iPhone, los avisos solo llegan si se agrega a la pantalla de inicio).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Previa · Champions",
    short_name: "La Previa",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0e28",
    theme_color: "#0b0e28",
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
