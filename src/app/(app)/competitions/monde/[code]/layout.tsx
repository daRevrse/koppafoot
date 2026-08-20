// Pages publiques d'une competition du football mondial.
//
// Ce layout ne fait plus que centrer. Le hero, les onglets et le contenu
// vivent dans la page : les onglets ne changent plus de route, ils changent
// ce que la carte affiche (?tab=), exactement comme sur une competition
// Koppafoot.
export default function WorldCompetitionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
