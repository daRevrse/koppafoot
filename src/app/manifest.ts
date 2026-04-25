import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KoppaFoot",
    short_name: "KoppaFoot",
    description:
      "La plateforme qui connecte les passionnés de football amateur",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#022c22",
    theme_color: "#059669",
    categories: ["sports", "football"],
    icons: [
      {
        src: "/branding/logo_symbol.png",
        sizes: "any",
        type: "image/png",
      },
      {
        src: "/branding/logo_symbol.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/branding/logo_symbol.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
