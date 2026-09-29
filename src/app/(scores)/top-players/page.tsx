import type { Metadata } from "next";
import ClassementComplet from "@/components/classement/ClassementComplet";
import { lireClassements } from "@/lib/classement-admin";
import { textes } from "@/i18n/textes";
import { textesServeur } from "@/i18n/serveur";

// Le classement complet des joueurs, public. Il ne change qu'à la fin d'un
// match : la page se contente de lire le document déjà calculé (voir
// lib/classement-admin), et l'ISR absorbe le reste.
export const revalidate = 60;

const T = textes(
  {
    titre: "Classement des joueurs",
    description:
      "Les meilleurs joueurs et gardiens de KoppaFoot, classés sur leur note des "
      + "cinq derniers matchs, toutes compétitions locales et matchs amicaux confondus.",
  },
  {
    titre: "Player rankings",
    description:
      "The best players and goalkeepers on KoppaFoot, ranked on their rating over "
      + "their last five matches, across local competitions and friendlies.",
  },
);

export async function generateMetadata(): Promise<Metadata> {
  const t = await textesServeur(T);
  return { title: t.titre, description: t.description };
}

export default async function TopPlayersPage() {
  const { joueurs } = await lireClassements();
  return <ClassementComplet joueurs={joueurs} />;
}
