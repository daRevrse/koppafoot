import type { MetadataRoute } from "next";
import { SPLASH_FOND } from "@/config/ios-launch";

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
    // iOS launch artwork's background rather than fighting it. Elle valait
    // « #f8f8f8 », un blanc casse, quand l'illustration etait claire : devant
    // la nouvelle, vert nuit, Android aurait fait clignoter du blanc avant
    // d'afficher l'icone. Voir SPLASH_FOND, la meme couleur que le generateur
    // pose derriere l'image.
    background_color: SPLASH_FOND,
    theme_color: "#059669",
    categories: ["sports", "football"],
    // Each entry serves a file that really is the size it declares, the old
    // ones pointed at the 2000x2000 source for every slot.
    //
    // LA VARIANTE MASKABLE EST UN FICHIER À PART, et ce n'est plus la même
    // image. Les lanceurs recadrent une icône maskable dans une forme qui ne
    // couvre que les 80% du milieu : l'affiche pleine y perdait le haut du
    // ballon et le pied de la hampe. C'était un compromis assumé tant que la
    // seule issue était de recomposer le motif à la main ; `generer-icones`
    // le fait maintenant tout seul — il rentre le dessin dans la zone sûre et
    // comble le reste avec le vert des bords, si bien que l'icône est entière
    // sur un écran d'accueil Android comme ailleurs.
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
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
