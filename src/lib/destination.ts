// ============================================
// La destination d'un parcours de connexion : `?next=`.
//
// ELLE DOIT SURVIVRE À L'INSCRIPTION. Quelqu'un qui arrive d'une candidature
// et crée son compte par Google ou par SMS passe par /get-started : la
// destination tombait en route, et il atterrissait sur le Direct, sa
// candidature oubliée. Le public même que les vitrines cherchent à
// convaincre. Chaque étape la transporte maintenant, avec ces deux outils.
//
// Seul un chemin interne est suivi : une adresse absolue (ou `//hôte`) ferait
// de la connexion un tremplin vers l'extérieur.
// ============================================

/** Le chemin si c'est une destination interne sûre, sinon null. */
export function destinationSure(brut: string | null | undefined): string | null {
  if (!brut) return null;
  return brut.startsWith("/") && !brut.startsWith("//") ? brut : null;
}

/** La destination de l'adresse courante (`?next=`), lue côté navigateur. */
export function destinationDeLURL(): string | null {
  if (typeof window === "undefined") return null;
  return destinationSure(new URLSearchParams(window.location.search).get("next"));
}

/** `/get-started`, en emportant la destination et le rôle choisi s'il y en a. */
export function versGetStarted({ next, role }: { next?: string | null; role?: string | null } = {}): string {
  const q = new URLSearchParams();
  if (role) q.set("role", role);
  const sure = destinationSure(next);
  if (sure) q.set("next", sure);
  const s = q.toString();
  return s ? `/get-started?${s}` : "/get-started";
}
