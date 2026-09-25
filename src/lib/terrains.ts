// ============================================
// Le vocabulaire d'un terrain, en un seul endroit.
//
// Ces listes existaient en CINQ exemplaires : la candidature, l'espace du
// propriétaire, la fiche publique, les deux écrans d'administration. Elles
// avaient déjà divergé — « Pelouse » ici, « Pelouse naturelle » là, « Gazon »
// dans l'administration — si bien que le même terrain se décrivait de trois
// façons selon la page qui l'affichait.
//
// Un terrain qui change de nom en changeant d'écran n'inspire pas confiance,
// et cette partie du produit doit en inspirer : c'est celle qu'on facturera.
// ============================================

import type {
  FirestoreReservationDuMatch, HorairesOuverture, PlageOuverture, ReservationDuMatch,
} from "@/types";

export const FORMATS = [
  { value: "5v5", label: "5 contre 5", court: "5v5" },
  { value: "7v7", label: "7 contre 7", court: "7v7" },
  { value: "11v11", label: "11 contre 11", court: "11v11" },
  { value: "futsal", label: "Futsal", court: "Futsal" },
] as const;

export const SURFACES = [
  { value: "natural_grass", label: "Pelouse naturelle", court: "Pelouse" },
  { value: "synthetic", label: "Synthétique", court: "Synthétique" },
  { value: "hybrid", label: "Hybride", court: "Hybride" },
  { value: "indoor", label: "Intérieur", court: "Intérieur" },
] as const;

/**
 * Ce qu'on trouve autour du terrain.
 *
 * La liste est FERMÉE, et c'est délibéré : en texte libre, « vestiaire »,
 * « vestiaires » et « Vestiaire H/F » deviennent trois équipements
 * différents, et plus rien ne se filtre. Une équipe qui cherche un terrain
 * avec des douches doit pouvoir cocher « douches », pas deviner l'orthographe
 * du propriétaire.
 */
export const EQUIPEMENTS = [
  { value: "vestiaires", label: "Vestiaires" },
  { value: "douches", label: "Douches" },
  { value: "eclairage", label: "Éclairage" },
  { value: "parking", label: "Parking" },
  { value: "buvette", label: "Buvette" },
  { value: "gradins", label: "Gradins" },
  { value: "filets", label: "Buts avec filets" },
  { value: "eau", label: "Point d'eau" },
  { value: "gardiennage", label: "Gardiennage" },
  { value: "secours", label: "Trousse de secours" },
] as const;

export type CleEquipement = (typeof EQUIPEMENTS)[number]["value"];

const LIBELLES_EQUIPEMENT = new Map<string, string>(
  EQUIPEMENTS.map((e) => [e.value, e.label]),
);

/** Un équipement inconnu — écrit avant que la liste soit fermée — se tait. */
export function libelleEquipement(value: string): string | null {
  return LIBELLES_EQUIPEMENT.get(value) ?? null;
}

type Liste = readonly { value: string; label: string; court: string }[];

const trouve = (liste: Liste, v: string | null | undefined) =>
  liste.find((x) => x.value === v) ?? null;

/** « 11 contre 11 ». Un format inconnu se rend tel quel plutôt que vide. */
export const libelleFormat = (v: string | null | undefined) =>
  trouve(FORMATS, v)?.label ?? v ?? "Format non précisé";

/** « 11v11 », pour les lignes de faits où la place manque. */
export const formatCourt = (v: string | null | undefined) =>
  trouve(FORMATS, v)?.court ?? v ?? "—";

export const libelleSurface = (v: string | null | undefined) =>
  trouve(SURFACES, v)?.label ?? v ?? "Surface non précisée";

export const surfaceCourte = (v: string | null | undefined) =>
  trouve(SURFACES, v)?.court ?? v ?? "—";

/**
 * Le prix d'une heure, tel qu'on le dit.
 *
 * Zéro n'est pas « 0 FCFA » mais « Prix à convenir » : la plateforme
 * n'encaisse rien, un terrain sans tarif saisi n'est pas gratuit, il n'a
 * simplement pas annoncé son prix. Écrire « 0 FCFA » aurait fabriqué des
 * équipes qui arrivent en pensant ne rien payer.
 */
export function prixHeure(montant: number | null | undefined): string {
  if (!montant || montant <= 0) return "Prix à convenir";
  return `${montant.toLocaleString("fr-FR")} FCFA / h`;
}

export const aUnPrix = (montant: number | null | undefined): boolean =>
  typeof montant === "number" && montant > 0;

/** « samedi 23 août », la date d'un créneau, telle qu'on la dit. */
export function dateLongue(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** « sam. 23 août », quand la ligne est courte. */
export function dateCourte(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * La date du jour au format ISO, LUE DANS LE FUSEAU DU NAVIGATEUR.
 *
 * `new Date().toISOString().slice(0, 10)` donne la date UTC : à Lomé, un
 * créneau du soir bascule au lendemain dès 23 h locales, et le filtre
 * « à venir » faisait alors disparaître des demandes encore valables.
 */
export function aujourdhui(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** « 1 h 30 » plutôt que « 1.5 h ». */
export function duree(h: number): string {
  const heures = Math.floor(h);
  const minutes = Math.round((h - heures) * 60);
  if (!minutes) return `${heures} h`;
  return `${heures} h ${String(minutes).padStart(2, "0")}`;
}

/** L'heure de fin d'un créneau, pour dire « 18:00 → 19:30 ». */
export function finCreneau(debut: string, h: number): string {
  const [hh, mm] = debut.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return debut;
  const total = hh * 60 + mm + Math.round(h * 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(total / 60) % 24)}:${p(total % 60)}`;
}

/**
 * Deux créneaux se chevauchent-ils ?
 *
 * Le propriétaire en a besoin au moment de confirmer : accepter deux équipes
 * sur le même samedi 18 h est l'erreur qui coûte un client, et elle ne se
 * voit pas dans une liste triée par date d'arrivée.
 */
export function seChevauchent(
  a: { date: string; time: string; duration: number },
  b: { date: string; time: string; duration: number },
): boolean {
  if (a.date !== b.date) return false;
  const min = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return Number.isNaN(h) ? 0 : h * 60 + (Number.isNaN(m) ? 0 : m);
  };
  const debutA = min(a.time);
  const debutB = min(b.time);
  return debutA < debutB + b.duration * 60 && debutB < debutA + a.duration * 60;
}

// ─── Horaires d'ouverture ───────────────────────────────────

/** Les jours dans l'ordre d'une semaine qu'on lit : du lundi au dimanche. */
export const JOURS: { cle: keyof HorairesOuverture; nom: string; court: string }[] = [
  { cle: "1", nom: "Lundi", court: "Lun." },
  { cle: "2", nom: "Mardi", court: "Mar." },
  { cle: "3", nom: "Mercredi", court: "Mer." },
  { cle: "4", nom: "Jeudi", court: "Jeu." },
  { cle: "5", nom: "Vendredi", court: "Ven." },
  { cle: "6", nom: "Samedi", court: "Sam." },
  { cle: "0", nom: "Dimanche", court: "Dim." },
];

/** Des horaires de départ quand on commence à les renseigner : tous les jours, 8 h → 22 h. */
export function horairesParDefaut(): HorairesOuverture {
  const h = {} as HorairesOuverture;
  for (const j of JOURS) h[j.cle] = { ouvre: "08:00", ferme: "22:00" };
  return h;
}

const HEURE = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;

/**
 * Les horaires tels qu'ils sortent de Firestore, ou `null`.
 *
 * Vérifiés champ par champ plutôt que crus : un document mal formé ne doit
 * pas bloquer toutes les demandes d'un terrain, il doit compter comme « non
 * renseigné ».
 */
export function horairesLus(brut: unknown): HorairesOuverture | null {
  if (!brut || typeof brut !== "object") return null;
  const b = brut as Record<string, unknown>;
  const h = {} as HorairesOuverture;
  for (const j of JOURS) {
    const plage = b[j.cle];
    if (plage === null || plage === undefined) { h[j.cle] = null; continue; }
    const p = plage as { ouvre?: unknown; ferme?: unknown };
    if (typeof p.ouvre !== "string" || typeof p.ferme !== "string"
      || !HEURE.test(p.ouvre) || !HEURE.test(p.ferme)) return null;
    h[j.cle] = { ouvre: p.ouvre, ferme: p.ferme };
  }
  return h;
}

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** La plage du jour d'une date, `undefined` si les horaires ne sont pas renseignés. */
export function plageDuJour(
  horaires: HorairesOuverture | null,
  dateIso: string,
): PlageOuverture | undefined {
  if (!horaires) return undefined;
  const d = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return horaires[String(d.getDay()) as keyof HorairesOuverture];
}

/**
 * Pourquoi un créneau tombe hors des horaires, ou `null` s'il y tient.
 *
 * Sans horaires renseignés, tout créneau passe : on ne refuse pas une demande
 * au nom d'une règle que le propriétaire n'a jamais posée.
 */
export function horsHoraires(
  horaires: HorairesOuverture | null,
  creneau: { date: string; time: string; duration: number },
): string | null {
  const plage = plageDuJour(horaires, creneau.date);
  if (plage === undefined) return null;
  if (plage === null) return `Le terrain est fermé le ${dateLongue(creneau.date).split(" ")[0]}.`;
  const debut = minutes(creneau.time);
  const fin = debut + Math.round(creneau.duration * 60);
  if (debut < minutes(plage.ouvre) || fin > minutes(plage.ferme)) {
    return `Le terrain ouvre de ${plage.ouvre} à ${plage.ferme} ce jour-là.`;
  }
  return null;
}

/** « 08:00 → 22:00 », ou « Fermé ». */
export const libellePlage = (p: PlageOuverture) => (p ? `${p.ouvre} → ${p.ferme}` : "Fermé");

// ─── Réservations des matchs ────────────────────────────────

/**
 * Combien de temps réserver pour un match, selon son format.
 *
 * Le match plus l'échauffement et le temps de libérer le terrain : un 11
 * contre 11 dure 90 minutes de jeu, on en demande deux heures.
 */
export function dureeDuMatch(format: string | null | undefined): number {
  const joueurs = Number(String(format ?? "").split("v")[0]);
  if (!Number.isFinite(joueurs) || joueurs >= 11) return 2;
  if (joueurs >= 8) return 1.5;
  return 1;
}

/** La réservation recopiée sur un match, telle que Firestore la porte. */
export function reservationDuMatch(
  brut: FirestoreReservationDuMatch | null | undefined,
): ReservationDuMatch | null {
  if (!brut || typeof brut.booking_id !== "string") return null;
  return {
    bookingId: brut.booking_id,
    venueId: brut.venue_id,
    venueName: brut.venue_name ?? "",
    status: brut.status,
    proposition: brut.proposition ?? null,
  };
}

// ─── L'annuaire : un terrain pour un créneau ────────────────

/** Un créneau déjà pris, tel que l'annuaire le reçoit : ni nom ni motif. */
export interface Occupation {
  date: string;
  time: string;
  duration: number;
}

/**
 * Un terrain peut-il accueillir ce créneau ?
 *
 * DEUX RÉPONSES, pas une : « ouvert » dit les horaires du propriétaire,
 * « libre » dit ses réservations. La liste les confond en « disponible »,
 * mais la carte doit pouvoir dire POURQUOI un terrain n'apparaît pas — un
 * terrain fermé le dimanche n'est pas un terrain complet.
 *
 * Sans horaires renseignés, le terrain est ouvert : on n'exclut personne au
 * nom d'une règle que le propriétaire n'a jamais posée.
 */
export function libreA(
  horaires: HorairesOuverture | null,
  occupations: Occupation[],
  creneau: Occupation,
): { ouvert: boolean; libre: boolean } {
  return {
    ouvert: horsHoraires(horaires, creneau) === null,
    libre: !occupations.some((o) => seChevauchent(o, creneau)),
  };
}
