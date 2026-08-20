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
    // Chrome paints its generated splash on this colour, so it matches the
    // iOS launch artwork's background rather than fighting it.
    background_color: "#f8f8f8",
    theme_color: "#059669",
    categories: ["sports", "football"],
    // Each entry serves a file that really is the size it declares, the old
    // ones pointed at the 2000x2000 source for every slot.
    //
    // The artwork doubles as the maskable icon by explicit choice. Launchers
    // crop maskable icons to a circle covering the middle 80%, and this
    // drawing reaches 16% past that, so the top of the ball and the foot of
    // the stem are clipped on the home screen. Accepted: the alternative was
    // recomposing the motif behind a shrunken symbol, and the artwork wins.
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
      // Same file, declared twice: the spec allows "any maskable" in one
      // entry but Next's Manifest type only takes a single purpose.
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
