import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/recruitment", destination: "/mercato", permanent: true },
      // /matches/<id>/live etait la TROISIEME fiche du meme match : elle
      // redessinait son propre tableau d'affichage et sa propre timeline, a
      // cote de ceux de /matches/<id> et de ceux d'une fiche de competition.
      // Trois copies qui divergeaient — un correctif porte sur l'une ne l'etait
      // sur aucune autre. Elle ne montrait rien que l'onglet « Resume » de la
      // fiche ne montre, et depuis la liste des matchs une meme carte menait
      // aux deux : la carte vers /matches/<id> au clic, son bouton « Suivre en
      // direct » vers ici.
      //
      // La redirection vit dans la config et non dans une page qui appellerait
      // `redirect()` : celle-ci sert bien la bonne page, mais laisse l'adresse
      // /live dans la barre du navigateur. Ici c'est un 308 avant tout rendu,
      // l'adresse suit.
      { source: "/matches/:id/live", destination: "/matches/:id", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "koppafoot.firebasestorage.app",
      },
      // Competition team logos / flags + competition logo/banner are organizer-entered
      // free-text URLs from arbitrary hosts, so next/image would otherwise hard-crash the
      // public pages on an unconfigured hostname. Allow any HTTPS host for these.
      // TRADEOFF: this opens the Next image optimizer to fetch arbitrary https URLs
      // (open-proxy/SSRF surface). Acceptable short-term since logos are organizer-entered
      // (a promoted role), but should be hardened — see follow-up (switch these crests to
      // plain <img>, or require Firebase Storage uploads).
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
