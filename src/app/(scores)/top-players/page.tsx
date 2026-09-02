import type { Metadata } from "next";
import ClassementComplet from "@/components/classement/ClassementComplet";
import { lireClassements } from "@/lib/classement-admin";

// Le classement complet des joueurs, public. Il ne change qu'à la fin d'un
// match : la page se contente de lire le document déjà calculé (voir
// lib/classement-admin), et l'ISR absorbe le reste.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Classement des joueurs",
  description:
    "Les cent meilleurs joueurs de KoppaFoot sur leurs cinq derniers matchs, "
    + "toutes compétitions locales et matchs amicaux confondus.",
};

export default async function TopPlayersPage() {
  const { performances, gardiens } = await lireClassements();
  return <ClassementComplet performances={performances} gardiens={gardiens} />;
}
