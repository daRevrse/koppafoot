import { normaliserPoste, POSTES, type Poste } from "@/lib/postes";
import type { GhostPlayer, Invitation, JoinRequest, Team } from "@/types";
import type { ChampsEquipe } from "~/lib/equipe-api";
import type { Brouillon, ChampsFantome } from "~/lib/equipe-firestore";

// La logique de l'écran Mon club, sans écran : l'effectif rangé comme une
// feuille de match (du but vers l'attaque, comme le site), le brouillon de ce
// que le manager change avant d'enregistrer, et ce que les formulaires refusent.

/** Ce qu'on sait d'un compte de l'effectif : la fiche publique du club le dit. */
export type IdentiteMembre = { nom: string; photo: string | null; poste: Poste | null };

export type LigneEffectif = {
  genre: "compte" | "fantome";
  id: string;
  nom: string;
  photo: string | null;
  poste: Poste | null;
  /** Celui du brouillon pour un compte ; celui de sa fiche pour un joueur sans compte. */
  dossard: string;
  titulaire: boolean;
  manager: boolean;
  /** Membre du staff : seul le propriétaire peut le retirer (les règles lui réservent le staff). */
  staff: boolean;
  /** Joueur sans compte dont un compte porte déjà le numéro : le site le cache, le manager doit le savoir. */
  dossardPris: boolean;
};

export type GroupeEffectif = { poste: Poste | null; titre: string; lignes: LigneEffectif[] };

const TITRES: Record<Poste, string> = {
  goalkeeper: "Gardiens",
  defender: "Défenseurs",
  midfielder: "Milieux",
  forward: "Attaquants",
};

const parNom = (a: LigneEffectif, b: LigneEffectif) => a.nom.localeCompare(b.nom, "fr");

/** Un dossard tel qu'on le tape : trois chiffres au plus, rien d'autre. */
export function nettoyerDossard(v: string): string {
  return v.replace(/\D/g, "").slice(0, 3);
}

export function lignesParPoste(
  team: Team,
  identites: Map<string, IdentiteMembre>,
  fantomes: GhostPlayer[],
  b: Brouillon,
  nomsDeSecours: Map<string, string>,
): GroupeEffectif[] {
  const staff = new Set((team.staff ?? []).map((m) => m.uid));
  const numerosDesComptes = new Set(Object.values(b.dossards).map((n) => n?.trim()).filter(Boolean));

  const compte = (uid: string, manager: boolean): LigneEffectif => {
    const id = identites.get(uid);
    return {
      genre: "compte",
      id: uid,
      nom: id?.nom || nomsDeSecours.get(uid) || "Joueur",
      photo: id?.photo ?? null,
      poste: id?.poste ?? null,
      dossard: b.dossards[uid] ?? "",
      titulaire: b.titulaires.includes(uid),
      manager,
      staff: staff.has(uid),
      dossardPris: false,
    };
  };

  const groupes: GroupeEffectif[] = [];
  if (team.managerId) groupes.push({ poste: null, titre: "Manager", lignes: [compte(team.managerId, true)] });

  const lignes: LigneEffectif[] = [
    ...team.memberIds.filter((uid) => uid !== team.managerId).map((uid) => compte(uid, false)),
    ...fantomes.map((g): LigneEffectif => {
      const numero = g.squadNumber?.trim() ?? "";
      return {
        genre: "fantome",
        id: g.id,
        nom: `${g.firstName} ${g.lastName}`.trim() || "Joueur",
        photo: g.photoUrl ?? null,
        poste: normaliserPoste(g.position),
        dossard: numero,
        titulaire: false,
        manager: false,
        staff: false,
        dossardPris: numero !== "" && numerosDesComptes.has(numero),
      };
    }),
  ];

  for (const poste of [...POSTES, null]) {
    const duPoste = lignes.filter((l) => l.poste === poste).sort(parNom);
    if (duPoste.length) groupes.push({ poste, titre: poste ? TITRES[poste] : "Sans poste", lignes: duPoste });
  }
  return groupes;
}

/** Le brouillon part de l'équipe telle qu'elle est enregistrée. */
export function brouillonDe(team: Team): Brouillon {
  return { dossards: { ...(team.squadNumbers ?? {}) }, titulaires: [...(team.lineupIds ?? [])] };
}

export function changerDossard(b: Brouillon, uid: string, v: string): Brouillon {
  return { ...b, dossards: { ...b.dossards, [uid]: nettoyerDossard(v) } };
}

export function basculerTitulaire(b: Brouillon, uid: string): Brouillon {
  return {
    ...b,
    titulaires: b.titulaires.includes(uid) ? b.titulaires.filter((id) => id !== uid) : [...b.titulaires, uid],
  };
}

/** Faut-il montrer « Enregistrer » ? Un dossard vidé qui n'existait pas, ou un titulaire rebasculé, ne comptent pas. */
export function aDesChangements(team: Team, b: Brouillon): boolean {
  const avant = brouillonDe(team);
  const cles = new Set([...Object.keys(avant.dossards), ...Object.keys(b.dossards)]);
  for (const cle of cles) {
    if ((avant.dossards[cle] ?? "").trim() !== (b.dossards[cle] ?? "").trim()) return true;
  }
  const titulaires = new Set(b.titulaires);
  return titulaires.size !== new Set(avant.titulaires).size || avant.titulaires.some((id) => !titulaires.has(id));
}

/**
 * Une date de document en millisecondes : une chaine ISO, ou l'horodatage
 * Firestore que toJoinRequest laisse tel quel. Illisible : 0, en dernier.
 */
export function instant(v: unknown): number {
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  if (v && typeof v === "object") {
    const o = v as { toMillis?: () => number; seconds?: number };
    if (typeof o.toMillis === "function") return o.toMillis();
    if (typeof o.seconds === "number") return o.seconds * 1000;
  }
  return 0;
}

const plusRecentes = <T extends { createdAt: unknown }>(l: T[]) => [...l].sort((a, b) => instant(b.createdAt) - instant(a.createdAt));

export function candidaturesParEtat(d: JoinRequest[]): { enAttente: JoinRequest[]; passees: JoinRequest[] } {
  return {
    enAttente: plusRecentes(d.filter((x) => x.status === "pending")),
    passees: plusRecentes(d.filter((x) => x.status !== "pending")),
  };
}

export function invitationsEnAttente(i: Invitation[], teamId: string): Invitation[] {
  return plusRecentes(i.filter((x) => x.teamId === teamId && x.status === "pending"));
}

function requis(v: string, max: number, manque: string): string | undefined {
  const t = v.trim();
  if (!t) return manque;
  if (t.length > max) return `${max} caractères au plus.`;
  return undefined;
}

/** Sans clé, sans erreur : l'objet vide veut dire qu'on peut enregistrer. */
function sansVides<T extends object>(o: Partial<Record<keyof T, string | undefined>>): Partial<Record<keyof T, string>> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v)) as Partial<Record<keyof T, string>>;
}

export function erreursFantome(f: ChampsFantome): Partial<Record<keyof ChampsFantome, string>> {
  return sansVides<ChampsFantome>({
    prenom: requis(f.prenom, 40, "Le prénom est requis."),
    nom: requis(f.nom, 40, "Le nom est requis."),
  });
}

export function erreursEquipe(c: ChampsEquipe): Partial<Record<keyof ChampsEquipe, string>> {
  return sansVides<ChampsEquipe>({
    name: requis(c.name, 80, "Le nom est requis."),
    city: requis(c.city, 80, "La ville est requise."),
    maxMembers: Number.isInteger(c.maxMembers) && c.maxMembers >= 5 && c.maxMembers <= 25 ? undefined : "Entre 5 et 25 joueurs.",
  });
}
