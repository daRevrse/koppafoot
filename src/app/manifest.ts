import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KoppaFoot",
    short_name: "KoppaFoot",
    description:
      "La plateforme qui connecte les passionnés de football amateur",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#022c22",
    theme_color: "#059669",
    categories: ["sports", "football"],
    // Each entry now serves a file that really is the size it declares. The
    // maskable one is a separate render: launchers crop maskable icons to a
    // safe circle, and this symbol's stem was being sliced off.
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
