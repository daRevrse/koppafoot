// Pages publiques d'une competition (/c/[slug]/**), dans le shell general.
//
// Ce layout ne fait plus que centrer : la barre d'onglets qu'il portait a
// rejoint la page principale, ou les onglets changent le contenu d'une carte
// au lieu de changer de page. Les routes filles qui restent — un match, une
// equipe, la page d'inscription — portent leur propre fil d'ariane.
export default function PublicCompetitionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="mx-auto max-w-6xl">{children}</div>;
}
