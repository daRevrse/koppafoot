import { BarreOnglets } from "~/components/BarreOnglets";
import type { Onglet } from "~/lib/fiche-match";

/** Les libellés courts du site : la rangée doit tenir sur un téléphone. */
const LIBELLES: Record<Onglet, string> = {
  feed: "Fil", tchat: "Tchat", infos: "Infos", lineups: "Compo", stats: "Stats", standings: "Classement", h2h: "H2H",
};

/** Les onglets de la fiche (components/match/MatchTabs). */
export function OngletsFiche({ onglets, actif, onChange }: {
  onglets: Onglet[];
  actif: Onglet;
  onChange: (o: Onglet) => void;
}) {
  return <BarreOnglets onglets={onglets} libelles={LIBELLES} actif={actif} onChange={onChange} />;
}
