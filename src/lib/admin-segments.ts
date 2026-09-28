// ============================================
// À qui parle l'administration : les segments d'un envoi.
//
// Messages et campagnes visaient `user_type == "player"`, `"manager"`,
// `"venue_owner"`. Depuis la bascule des rôles, `user_type` vaut « user »
// pour la plupart des comptes : le rôle vit dans `evolution_role`, les
// casquettes dans des drapeaux. Les segments ne trouvaient donc presque
// personne — « Propriétaires de terrain » ne trouvait strictement personne —
// et l'écran annonçait « Message envoyé à 0 utilisateur(s) » sans qu'on sache
// pourquoi.
//
// UNE RÈGLE, LA MÊME QUE L'ÉCRAN DES UTILISATEURS : le rôle effectif (activé
// dans Évolution, ou à défaut déclaré à l'inscription, voir
// lib/espaces-acces), et les casquettes par leur drapeau.
//
// Module pur : la route le lit sur des documents bruts, les tests aussi.
// ============================================

export type Segment =
  | "tous"
  | "joueurs"
  | "managers"
  | "arbitres"
  | "sans_role"
  | "organisateurs"
  | "proprietaires"
  | "scoreurs";

export const SEGMENTS: { valeur: Segment; label: string }[] = [
  { valeur: "tous", label: "Tous les comptes actifs" },
  { valeur: "joueurs", label: "Joueurs" },
  { valeur: "managers", label: "Managers" },
  { valeur: "arbitres", label: "Arbitres" },
  { valeur: "sans_role", label: "Comptes sans rôle" },
  { valeur: "organisateurs", label: "Organisateurs" },
  { valeur: "proprietaires", label: "Propriétaires de terrain" },
  { valeur: "scoreurs", label: "Scoreurs" },
];

export function estUnSegment(x: unknown): x is Segment {
  return typeof x === "string" && SEGMENTS.some((s) => s.valeur === x);
}

type Brut = Record<string, unknown>;

/** Le rôle effectif d'un document brut : voir `roleEffectif` (lib/espaces-acces). */
export function roleEffectifBrut(d: Brut): "player" | "manager" | "referee" | null {
  const evolution = d.evolution_role;
  if (evolution === "player" || evolution === "manager" || evolution === "referee") return evolution;
  const type = d.user_type;
  return type === "player" || type === "manager" || type === "referee" ? type : null;
}

/**
 * Ce compte est-il dans le segment ?
 *
 * Un compte suspendu n'est dans AUCUN segment : un envoi groupé n'a pas à
 * notifier quelqu'un qu'on a écarté de la plateforme.
 */
export function dansLeSegment(d: Brut, segment: Segment): boolean {
  if (d.is_active === false) return false;
  switch (segment) {
    case "tous": return true;
    case "joueurs": return roleEffectifBrut(d) === "player";
    case "managers": return roleEffectifBrut(d) === "manager";
    case "arbitres": return roleEffectifBrut(d) === "referee";
    case "sans_role": return roleEffectifBrut(d) === null;
    case "organisateurs": return d.is_organizer === true;
    case "proprietaires": return d.is_venue_owner === true;
    case "scoreurs": return d.is_scorer === true;
  }
}

// ============================================
// Les campagnes de relance
// ============================================

export type Campagne = "sans_espace" | "manager_no_team" | "player_no_team" | "manager_welcome";

/**
 * Qui reçoit une campagne de relance.
 *
 * Elles ciblaient `user_type == "manager"` et `"player"` : depuis la bascule
 * des rôles, deux sur quatre comptaient toujours zéro destinataire. Le rôle
 * est ici le rôle effectif, comme partout ailleurs dans l'administration.
 *
 *  - manager_no_team : managers qui ne dirigent aucun club ;
 *  - player_no_team  : joueurs qui ne sont dans aucun effectif et n'ont
 *    aucune candidature en cours (un joueur déjà ajouté par son manager
 *    n'a rien à chercher) ;
 *  - manager_welcome : managers inscrits depuis moins de 48 heures ;
 *  - sans_espace     : ni rôle, ni casquette — ils ne voient que les scores.
 */
export function ciblesDeCampagne(
  campagne: Campagne,
  comptes: { uid: string; data: Brut }[],
  equipes: Brut[],
  candidaturesEnCours: Set<string>,
  maintenant: Date,
): string[] {
  const reelles = equipes.filter((e) => e.is_ghost !== true);
  const dirigeants = new Set(reelles.map((e) => e.manager_id).filter((x): x is string => typeof x === "string"));
  const membres = new Set(reelles.flatMap((e) => (Array.isArray(e.member_ids) ? e.member_ids : [])).map(String));
  const ilYA48h = maintenant.getTime() - 48 * 60 * 60 * 1000;

  return comptes
    .filter(({ uid, data }) => {
      if (data.is_active === false) return false;
      const role = roleEffectifBrut(data);
      switch (campagne) {
        case "manager_no_team":
          return role === "manager" && !dirigeants.has(uid);
        case "player_no_team":
          return role === "player" && !membres.has(uid) && !candidaturesEnCours.has(uid);
        case "manager_welcome": {
          if (role !== "manager") return false;
          const ca = data.created_at as { toDate?: () => Date } | string | undefined;
          const cree = typeof ca === "string" ? new Date(ca) : ca?.toDate?.();
          return !!cree && cree.getTime() >= ilYA48h;
        }
        case "sans_espace":
          return role === null
            && data.is_organizer !== true && data.is_venue_owner !== true && data.is_scorer !== true
            && data.is_superadmin !== true && data.user_type !== "superadmin";
      }
    })
    .map(({ uid }) => uid);
}
