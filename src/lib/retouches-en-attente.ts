import type { IssuePenalty } from "@/lib/evenements";
import type { Evenement } from "@/lib/retrait-evenement";

// ============================================
// Les retouches qui attendent le réseau.
//
// UNE RETOUCHE COMPLÈTE UN ÉVÉNEMENT DÉJÀ ÉCRIT : le passeur d'un but, la
// victime d'une faute, ce qu'un penalty est devenu. Elles s'écrivent par
// transaction — l'événement vit dans un tableau, et on ne modifie un élément
// de tableau qu'en réécrivant le tableau entier, sous peine d'effacer ce
// qu'un autre appareil vient d'y ajouter.
//
// OR UNE TRANSACTION NE PART PAS HORS LIGNE : elle lit le serveur avant
// d'écrire. Le but, lui, part dans la file de Firestore et survit à la
// coupure ; son passeur se perdait. On garde donc ici l'intention, sur
// l'appareil, et la console la rejoue quand le réseau revient.
//
// PURE, pour être testée : la console lit et écrit le stockage, rejoue par
// le pilote, et affiche les événements RETOUCHÉS en attendant — le scoreur
// voit son passeur tout de suite, pas après la coupure.
// ============================================

export type Joueur = { playerId: string; playerName: string };

export type Retouche =
  | { genre: "passeur"; eventId: string; valeur: Joueur | null }
  | { genre: "victime"; eventId: string; valeur: Joueur | null }
  | {
      genre: "penalty";
      eventId: string;
      valeur: { issue: IssuePenalty; tireur: { playerId: string | null; playerName: string | null } | null };
    };

const GENRES = new Set(["passeur", "victime", "penalty"]);

/** La même retouche remplace la précédente : seule la dernière réponse compte. */
export function ajouterRetouche(file: Retouche[], r: Retouche): Retouche[] {
  return [...file.filter((x) => !(x.genre === r.genre && x.eventId === r.eventId)), r];
}

export function retirerRetouche(file: Retouche[], r: Pick<Retouche, "genre" | "eventId">): Retouche[] {
  return file.filter((x) => !(x.genre === r.genre && x.eventId === r.eventId));
}

/** Un événement retiré emporte ses retouches : il n'y a plus rien à compléter. */
export function sansLesEvenements(file: Retouche[], ids: string[]): Retouche[] {
  return file.filter((x) => !ids.includes(x.eventId));
}

/** Les événements tels qu'ils seront une fois les retouches écrites. */
export function appliquerRetouches(events: Evenement[], file: Retouche[]): Evenement[] {
  if (file.length === 0) return events;
  return events.map((e) => {
    let out = e;
    for (const r of file) {
      if (r.eventId !== e.id) continue;
      if (r.genre === "passeur") {
        out = { ...out, assistPlayerId: r.valeur?.playerId ?? null, assistPlayerName: r.valeur?.playerName ?? null };
      } else if (r.genre === "victime") {
        out = { ...out, victimPlayerId: r.valeur?.playerId ?? null, victimPlayerName: r.valeur?.playerName ?? null };
      } else {
        out = {
          ...out,
          detail: r.valeur.issue,
          ...(r.valeur.tireur?.playerId && r.valeur.tireur.playerName
            ? { playerId: r.valeur.tireur.playerId, playerName: r.valeur.tireur.playerName }
            : {}),
        };
      }
    }
    return out;
  });
}

/**
 * La file relue depuis le stockage de l'appareil.
 *
 * Tolérante : un stockage abîmé, ou écrit par une version précédente, rend
 * une file vide plutôt qu'une console qui refuse de s'ouvrir.
 */
export function lireFile(texte: string | null): Retouche[] {
  if (!texte) return [];
  try {
    const brut: unknown = JSON.parse(texte);
    if (!Array.isArray(brut)) return [];
    return brut.filter(
      (x): x is Retouche =>
        !!x && typeof x === "object"
        && GENRES.has((x as Retouche).genre)
        && typeof (x as Retouche).eventId === "string",
    );
  } catch {
    return [];
  }
}

/** L'erreur d'une écriture qui n'a pas pu joindre le serveur. */
export function estHorsLigne(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  const message = String((err as { message?: unknown } | null)?.message ?? "");
  return code === "unavailable" || /offline|hors ligne|network/i.test(message);
}
