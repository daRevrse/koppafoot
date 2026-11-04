"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { PiloteConsole } from "@/lib/console-pilote";
import { normaliserPoste } from "@/lib/postes";
import { gardienDeDepart, gardienExige, gardienPropose } from "@/lib/gardiens";
import { estLigneDossard, lignesDeSecours } from "@/lib/dossards";
import { lireNumero, numeroModifiable, numerosDeLaFeuille } from "@/lib/numeros-du-jour";
import type { CompMatch, CompPlayer, LineupEntry } from "@/types";
import type { Side, SheetRole } from "./types";

// Une pièce de la console live (LiveMatchConsole) : l'atelier des feuilles,
// avant le coup d'envoi.

/**
 *  * L'effectif du match, complété par la composition type du club.
 *
 * Les joueurs que la console propose viennent du match : les inscrits d'une
 * équipe de compétition, les présents confirmés d'un amical. Les seconds
 * manquent souvent — personne n'a répondu à la convocation —, et la feuille
 * n'a alors littéralement personne à cocher : pas de feuille, pas de coup
 * d'envoi, un match paralysé pour une raison administrative.
 *
 * Ceux de la composition type entrent donc dans la liste, à la suite : le
 * manager a déjà déclaré que ce sont ses joueurs. L'EFFECTIF DU MATCH RESTE
 * PRIORITAIRE, y compris sur son propre poste et son numéro — il dit qui est
 * là aujourd'hui, la composition type dit comment on joue en général.
 *
 * Personne n'est retiré : un joueur présent mais absent de la composition type
 * reste cochable. Le scoreur voit tout le monde, et tranche.
 */
function fusionnerCompoAuRoster(
  duMatch: CompPlayer[],
  compo: LineupEntry[] | null,
): CompPlayer[] {
  if (!compo || compo.length === 0) return duMatch;
  const connus = new Set(duMatch.map((j) => j.id));
  const ajouts = compo
    .filter((e) => !connus.has(e.playerId))
    .map<CompPlayer>((e) => ({
      id: e.playerId,
      name: e.name,
      number: e.number,
      user_id: e.userId ?? null,
      position: e.position ?? undefined,
    }));
  return [...duMatch, ...ajouts];
}

/** Seed a per-side match-sheet draft (playerId -> role) from a saved lineup. */
function seedSheet(lineup: LineupEntry[]): Record<string, SheetRole> {
  const out: Record<string, SheetRole> = {};
  for (const e of lineup) out[e.playerId] = e.role;
  return out;
}

export function useFeuilles({ pilote, match, startersMax, sansGardien }: {
  pilote: PiloteConsole;
  match: CompMatch | null;
  /** Le NvN du format : le plafond de titulaires. */
  startersMax: number;
  /** La case « sans gardien » : celle du match une fois lancé, celle de l'écran avant. */
  sansGardien: boolean;
}) {
  // Rosters (loaded once before kickoff for the match-sheet builder).
  const [homeRoster, setHomeRoster] = useState<CompPlayer[] | null>(null);
  const [awayRoster, setAwayRoster] = useState<CompPlayer[] | null>(null);
  const [rostersLoading, setRostersLoading] = useState(false);
  // Les lignes que l'effectif de chaque équipe porte vraiment. Un dossard tiré
  // dans la console (voir lib/dossards) n'y est pas encore : la validation de
  // la feuille l'y fait entrer, et seulement s'il y figure.
  const [enBase, setEnBase] = useState<{ home: Set<string>; away: Set<string> }>(
    () => ({ home: new Set(), away: new Set() }),
  );

  // Per-side match-sheet drafts (playerId -> role). Seeded from any saved lineup.
  const [homeSheet, setHomeSheet] = useState<Record<string, SheetRole>>({});
  const [awaySheet, setAwaySheet] = useState<Record<string, SheetRole>>({});
  // LES DOSSARDS DU JOUR (lib/numeros-du-jour) : le numéro que chaque joueur
  // porte sur la feuille de CE match, quand il diffère de l'effectif. Semés
  // depuis la feuille enregistrée, comme les rôles : une feuille déjà validée
  // garde les numéros qu'elle a constatés.
  const [numerosDuJour, setNumerosDuJour] = useState<{ home: Record<string, string>; away: Record<string, string> }>(
    () => ({ home: {}, away: {} }),
  );
  const [savingSide, setSavingSide] = useState<Side | null>(null);
  /**
   * Le gardien désigné sur chaque feuille en préparation. `undefined` tant
   * que le scoreur n'a rien touché : on propose alors le titulaire que
   * l'effectif met au poste (voir `gardienPropose`).
   */
  const [gardiensChoisis, setGardiensChoisis] = useState<Record<Side, string | null | undefined>>(
    { home: undefined, away: undefined },
  );

  // Load both rosters once, before kickoff, for the match-sheet builder. Drafts
  // are seeded from any previously-saved lineup so re-validation overwrites cleanly.
  const isPreKickoff = !!match && match.status !== "live" && match.status !== "completed";
  const homeTeamId = match?.homeTeamId ?? null;
  const awayTeamId = match?.awayTeamId ?? null;

  /**
   * LA COMPOSITION TYPE DE CHAQUE CLUB, quand il en a préparé une.
   *
   * Elle sert à deux choses ici, et c'est la même idée des deux côtés : que le
   * scoreur n'arrive jamais devant une feuille vide.
   *
   *  — Elle COMPLÈTE L'EFFECTIF. Sur un amical, la console ne propose que les
   *    joueurs qui ont confirmé leur venue : un dimanche où personne n'a
   *    répondu, la liste est vide et il n'y a littéralement rien à cocher,
   *    donc rien à valider, donc pas de coup d'envoi. Les joueurs de la
   *    composition type y entrent, parce que le manager a déjà dit que ce sont
   *    les siens.
   *
   *  — Elle PRÉ-COCHE LA FEUILLE, titulaires et remplaçants, quand le camp n'a
   *    aucune feuille enregistrée. Le scoreur valide en un geste, ou corrige —
   *    il ne part plus de rien.
   *
   * Elle ne touche JAMAIS à une feuille déjà faite : celle qu'un manager a
   * validée depuis la fiche du match est la vraie, et elle décrit ce
   * dimanche-là, ce que la composition type ne fait pas.
   */
  const [compoTypes, setCompoTypes] = useState<{
    home: LineupEntry[] | null;
    away: LineupEntry[] | null;
  }>({ home: null, away: null });

  useEffect(() => {
    if (!isPreKickoff || !match) return;
    let cancelled = false;
    setRostersLoading(true);
    (async () => {
      try {
        const [{ home, away }, compos] = await Promise.all([
          pilote.effectifs(match),
          // Jamais bloquant : le pilote avale ses propres erreurs et rend deux
          // `null`, la console se comporte alors comme avant.
          pilote.compositionsTypes(match, startersMax),
        ]);
        if (cancelled) return;
        setCompoTypes(compos);
        setEnBase({ home: new Set(home.map((p) => p.id)), away: new Set(away.map((p) => p.id)) });
        setHomeRoster(fusionnerCompoAuRoster(home, compos.home));
        setAwayRoster(fusionnerCompoAuRoster(away, compos.away));
      } catch {
        if (!cancelled) {
          setHomeRoster([]);
          setAwayRoster([]);
          toast.error("Erreur de chargement des effectifs");
        }
      } finally {
        if (!cancelled) setRostersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `match` est lu mais volontairement hors dependances : il change a chaque
    // but, et les effectifs, eux, ne bougent pas d'un evenement a l'autre.
  }, [isPreKickoff, pilote, homeTeamId, awayTeamId, startersMax]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed each draft from the saved lineup whenever the match's lineup changes.
  // À DÉFAUT DE FEUILLE ENREGISTRÉE, la composition type du club prend le
  // relais : c'est la seule différence avec avant, et elle ne joue que sur un
  // camp qui n'a rien.
  // Le gardien désigné suit la feuille enregistrée ; une feuille qui n'en a
  // pas laisse la proposition venir de l'effectif.
  //
  // CHAQUE FEUILLE SUR SON PROPRE CONTENU, et non sur le tableau du match :
  // celui-ci est un nouveau tableau à chaque instantané du match, même quand
  // rien n'y a changé. Valider la feuille de domicile réécrivait donc aussi
  // le brouillon de l'extérieur, et le scoreur qui avait rempli les deux
  // feuilles côte à côte perdait la seconde — rôles et dossards du jour.
  const contenuHome = JSON.stringify(match?.homeLineup ?? []);
  const contenuAway = JSON.stringify(match?.awayLineup ?? []);
  useEffect(() => {
    if (!match) return;
    setHomeSheet(seedSheet(match.homeLineup.length > 0 ? match.homeLineup : compoTypes.home ?? []));
    setNumerosDuJour((n) => ({ ...n, home: numerosDeLaFeuille(match.homeLineup) }));
    setGardiensChoisis((g) => ({ ...g, home: gardienDeDepart(match.homeLineup)?.playerId ?? undefined }));
  }, [contenuHome, compoTypes.home]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!match) return;
    setAwaySheet(seedSheet(match.awayLineup.length > 0 ? match.awayLineup : compoTypes.away ?? []));
    setNumerosDuJour((n) => ({ ...n, away: numerosDeLaFeuille(match.awayLineup) }));
    setGardiensChoisis((g) => ({ ...g, away: gardienDeDepart(match.awayLineup)?.playerId ?? undefined }));
  }, [contenuAway, compoTypes.away]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Le numéro que ce joueur porte sur la feuille de ce match. */
  const numeroDuJour = (side: Side, p: CompPlayer): string =>
    numeroModifiable(p.id) ? numerosDuJour[side][p.id] ?? p.number ?? "" : p.number ?? "";

  /** Changer le numéro d'un joueur sur la feuille en préparation. Rien ne s'écrit avant la validation. */
  const changerNumero = (side: Side, playerId: string, brut: string): boolean => {
    const numero = lireNumero(brut);
    if (numero === null) {
      toast.error("Un dossard, c'est un nombre de 0 à 99");
      return false;
    }
    setNumerosDuJour((n) => ({ ...n, [side]: { ...n[side], [playerId]: numero } }));
    return true;
  };

  const toggleSheetRole = (side: Side, playerId: string) => {
    const sheet = side === "home" ? homeSheet : awaySheet;
    const setter = side === "home" ? setHomeSheet : setAwaySheet;
    const current = sheet[playerId] ?? "out";
    let next: SheetRole =
      current === "out" ? "starter" : current === "starter" ? "substitute" : "out";
    // Hard cap: at most `startersMax` titulaires per side (le NvN du format).
    // Un titulaire de trop bascule en remplaçant.
    // Compute + toast OUTSIDE the state updater (no side effects during render).
    if (next === "starter") {
      const starters = Object.entries(sheet).filter(
        ([id, role]) => role === "starter" && id !== playerId,
      ).length;
      if (starters >= startersMax) {
        next = "substitute";
        toast(`${startersMax} titulaires maximum, le reste = remplaçants`, { icon: "⚠️" });
      }
    }
    setter((prev) => ({ ...prev, [playerId]: next }));
  };

  /**
   * Le gardien d'une feuille en préparation : celui que le scoreur a désigné,
   * ou, tant qu'il n'a rien touché, le titulaire que l'effectif met au poste.
   * Un joueur qui n'est plus titulaire perd la désignation.
   */
  const gardienDeLaFeuille = (side: Side): string | null => {
    const roster = (side === "home" ? homeRoster : awayRoster) ?? [];
    const sheet = side === "home" ? homeSheet : awaySheet;
    const titulaires = roster
      .filter((p) => sheet[p.id] === "starter")
      .map((p) => ({ id: p.id, position: p.position }));
    return gardienPropose(titulaires, gardiensChoisis[side]);
  };
  /** Le 🧤 d'une ligne : désigne ce titulaire, ou retire la désignation. */
  const designerGardien = (side: Side, playerId: string) =>
    setGardiensChoisis((g) => ({ ...g, [side]: gardienDeLaFeuille(side) === playerId ? null : playerId }));

  /**
   * LA FEUILLE DE SECOURS : « N°1 » à « N°25 », sauf les numéros
   * que l'effectif porte déjà. Rien ne s'écrit ici — le scoreur coche ceux
   * qu'il voit sur le terrain, et seuls ceux-là entrent dans l'effectif, à la
   * validation. L'équipe les nommera après le match (voir lib/dossards).
   */
  const tirerDossards = (side: Side) => {
    const teamId = side === "home" ? match?.homeTeamId : match?.awayTeamId;
    const roster = side === "home" ? homeRoster : awayRoster;
    if (!teamId || !roster) return;
    const lignes = lignesDeSecours(teamId, roster);
    if (lignes.length === 0) return;
    (side === "home" ? setHomeRoster : setAwayRoster)([...roster, ...lignes]);
  };
  const dossardsRestants = (side: Side) => {
    const teamId = side === "home" ? match?.homeTeamId : match?.awayTeamId;
    const roster = side === "home" ? homeRoster : awayRoster;
    return !!teamId && !!roster && lignesDeSecours(teamId, roster).length > 0;
  };

  const handleValidateSheet = async (side: Side) => {
    if (!match) return;
    const roster = side === "home" ? homeRoster : awayRoster;
    const sheet = side === "home" ? homeSheet : awaySheet;
    if (!roster) return;
    // La case que le manager avait choisie sur son terrain (voir
    // lib/terrain) : la revalidation par le scoreur ne doit pas la defaire
    // pour un joueur qui reste titulaire.
    const dejaSurLaFeuille = side === "home" ? match.homeLineup : match.awayLineup;
    const caseDe = (id: string) =>
      dejaSurLaFeuille.find((e) => e.playerId === id && e.role === "starter")?.emplacement ?? null;

    // LE GARDIEN DÉSIGNÉ PORTE LE POSTE, et lui seul parmi les titulaires : sur
    // une feuille, le poste est le rôle du jour. Un titulaire que l'effectif
    // dit gardien mais qui joue dans le champ ce jour-là le perd ; les
    // remplaçants gardent le leur. Sans gardien, la feuille garde les postes
    // de l'effectif : c'est la case qui décide, partout où l'on compte.
    const teamIdDuCamp = side === "home" ? match.homeTeamId : match.awayTeamId;
    const gardien = sansGardien ? null : gardienDeLaFeuille(side);
    if (gardienExige(teamIdDuCamp, sansGardien) && !gardien) {
      toast.error("Désigne le gardien 🧤 parmi les titulaires");
      return;
    }
    const posteSurLaFeuille = (p: CompPlayer) => {
      const poste = normaliserPoste(p.position);
      if (sansGardien || sheet[p.id] !== "starter") return poste;
      if (p.id === gardien) return "goalkeeper";
      return poste === "goalkeeper" ? null : poste;
    };

    const entries: LineupEntry[] = roster
      .filter((p) => (sheet[p.id] ?? "out") !== "out")
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        // Le numéro du jour, quand le scoreur l'a changé (lib/numeros-du-jour).
        number: numeroDuJour(side, p),
        role: (sheet[p.id] as "starter" | "substitute"),
        // Le compte, quand la ligne a ete revendiquee : c'est lui qui permet
        // de reconnaitre le joueur d'une equipe a l'autre (voir lib/types).
        userId: p.user_id ?? null,
        // Le poste suit le joueur sur la feuille, sous sa forme canonique. La
        // console en a besoin pour savoir qui est le gardien, et le terrain
        // pour placer les maillots. La ligne d'effectif l'ecrit en trois
        // orthographes, d'ou le normaliseur. Le gardien designe, voir plus haut.
        position: posteSurLaFeuille(p),
        emplacement: sheet[p.id] === "starter" ? caseDe(p.id) : null,
      }));

    const starters = entries.filter((e) => e.role === "starter").length;
    if (starters === 0) {
      toast.error("Ajoute au moins un titulaire à la feuille");
      return;
    }
    if (starters > startersMax) {
      toast.error(`${startersMax} titulaires maximum`);
      return;
    }

    setSavingSide(side);
    try {
      // Les dossards cochés entrent d'abord dans l'effectif : une feuille qui
      // désignerait une ligne absente de l'équipe ne pourrait plus être
      // nommée après coup.
      const nouveaux = entries.filter((e) => estLigneDossard(e.playerId) && !enBase[side].has(e.playerId));
      if (nouveaux.length > 0 && pilote.ajouterDossards) {
        let lignes: CompPlayer[];
        try {
          lignes = await pilote.ajouterDossards(side, nouveaux.map((e) => Number(e.number)));
        } catch (err) {
          // Le message vient de la route, en français, et dit quoi faire.
          toast.error(err instanceof Error && err.message ? err.message : "Les dossards n'ont pas pu être enregistrés");
          return;
        }
        const recus = new Set(lignes.map((l) => l.id));
        const manquant = nouveaux.find((e) => !recus.has(e.playerId));
        if (manquant) {
          toast.error(`Le n°${manquant.number} vient d'être donné à un joueur de l'effectif. Recharge la console.`);
          return;
        }
        setEnBase((prev) => ({ ...prev, [side]: new Set([...prev[side], ...recus]) }));
      }
      await pilote.poserFeuille(side, entries, true);
      toast.success("Feuille validée");
    } catch {
      toast.error("Erreur lors de la validation");
    } finally {
      setSavingSide(null);
    }
  };

  /**
   * Le camp n'a pas le gardien qu'il lui faut pour lancer le match : la case
   * est décochée, et sa feuille enregistrée ne met aucun titulaire au but.
   */
  const gardienManquant = (side: Side): boolean => {
    if (!match) return false;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    const lineup = side === "home" ? match.homeLineup : match.awayLineup;
    return gardienExige(teamId, sansGardien) && !gardienDeDepart(lineup);
  };

  const handleLaunch = async () => {
    if (!match?.homeLineupReady || !match?.awayLineupReady) return;
    if (gardienManquant("home") || gardienManquant("away")) return;
    const homeOnPitch = match.homeLineup.filter((e) => e.role === "starter").map((e) => e.playerId);
    const awayOnPitch = match.awayLineup.filter((e) => e.role === "starter").map((e) => e.playerId);
    try {
      // Le direct s'ouvre ; le coup d'envoi, et son push, sont un geste à part
      // dans la console. Voir `remettreEnJeu`. La case « Sans gardien » part
      // avec lui.
      await pilote.lancer({ home: homeOnPitch, away: awayOnPitch }, sansGardien);
    } catch {
      toast.error("Erreur technique");
    }
  };

  return {
    homeRoster, awayRoster, rostersLoading, homeSheet, awaySheet, savingSide, compoTypes,
    numeroDuJour, changerNumero, toggleSheetRole, gardienDeLaFeuille, designerGardien,
    tirerDossards, dossardsRestants, handleValidateSheet, gardienManquant, handleLaunch,
  };
}
