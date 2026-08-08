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
    // Each entry serves a file that really is the size it declares — the old
    // ones pointed at the 2000x2000 source for every slot.
    //
    // The `any` icons are the artwork untouched. The maskable one cannot be:
    // launchers crop it to a circle covering the middle 80%, and the drawing
    // reaches 924px from centre on 2000 — 16% past the safe zone — so the top
    // of the ball and the foot of the stem would be clipped. It is rebuilt
    // instead from the artwork's own motif, tiled from its symbol-free
    // margins, with the symbol brought inside the circle.
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
