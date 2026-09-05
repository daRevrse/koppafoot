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
      // LE JOKER `hostname: "**"` A ÉTÉ RETIRÉ, et avec lui un proxy ouvert.
      //
      // Il était là parce que logos et bannières pouvaient être des URL libres,
      // saisies par un organisateur : sans lui, next/image plantait sur un hôte
      // non déclaré. Le prix était d'ouvrir l'optimiseur d'images à n'importe
      // quelle adresse https — une surface SSRF que le commentaire d'origine
      // signalait déjà comme à durcir.
      //
      // Le champ « coller une URL » a disparu de ImageUploadField, donc toute
      // image passe désormais par Firebase Storage. Vérifié avant de couper :
      // sur les 36 URL d'images de la base, ZÉRO pointait ailleurs, et le
      // `photoURL` renvoyé par Google n'est jamais stocké (AuthContext écrit
      // `profile_picture_url: null` à la création).
      //
      // Conséquence heureuse : les médias peuvent repasser par next/image, ce
      // que 71 `<img>` avec `eslint-disable` évitaient jusqu'ici.
    ],
  },
};

export default nextConfig;
