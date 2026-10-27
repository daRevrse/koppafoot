import { useCallback, useEffect, useMemo, useState } from "react";
import { cleDuJour } from "@/lib/dates";
import { isOrganizer, isScorer, isVenueOwner } from "@/lib/hats";
import type { Booking, CompMatch, Competition, Match } from "@/types";
import { usePremierPlan } from "~/hooks/usePremierPlan";
import { useAuth } from "~/lib/auth";
import {
  ecouterAmicauxAVenir, ecouterMatchsConfies, ecouterMatchsDuJour, ecouterReservationsDuProprietaire,
  lireCompetitionsDuCompte, type CompetitionsDuCompte,
} from "~/lib/casquette-firestore";
import {
  amicauxSansScoreur, competitionsSansDoublon, matchsConfiesATenir, matchsDuJour, reservationsATraiter,
  sectionsDeLEspace, type Sections,
} from "~/lib/espace-casquette";

export interface JourneeTenue {
  competition: Competition;
  matchs: CompMatch[];
}

export interface EspaceCasquette {
  /** Faux sans compte : l'onglet présente les casquettes et propose d'en créer un. */
  connecte: boolean;
  /** Vrai tant que les compétitions et les matchs confiés du compte ne sont pas lus. */
  chargement: boolean;
  sections: Sections;
  scoreur: boolean;
  organisateur: boolean;
  confies: Match[];
  journees: JourneeTenue[];
  /** Les amicaux que personne ne couvre ; `null` sans casquette de scoreur ou avant lecture. */
  amicaux: number | null;
  competitions: Competition[];
  reservations: { aRepondre: Booking[]; duJour: Booking[] } | null;
  rafraichir: () => Promise<void>;
}

/**
 * Ce que l'Espace casquette montre, selon les casquettes du profil
 * (lib/hats) : en direct pour les matchs et les réservations, comme sur le
 * site ; les écouteurs se coupent en arrière-plan, comme le Direct.
 */
export function useEspaceCasquette(): EspaceCasquette {
  const { utilisateur, profil } = useAuth();
  const uid = utilisateur?.uid ?? null;
  const actif = usePremierPlan();
  const scoreur = isScorer(profil);
  const organisateur = isOrganizer(profil);
  const proprietaire = isVenueOwner(profil);
  const [jour] = useState(() => cleDuJour(new Date()));

  // Chaque lecture garde le compte qui l'a faite : déconnecté, elle ne vaut plus.
  const [comps, setComps] = useState<{ uid: string; lu: CompetitionsDuCompte } | null>(null);
  const [confies, setConfies] = useState<{ uid: string; matchs: Match[] } | null>(null);
  const [amicaux, setAmicaux] = useState<Match[] | null>(null);
  const [duJour, setDuJour] = useState<Record<string, CompMatch[]>>({});
  const [resas, setResas] = useState<{ uid: string; liste: Booking[] } | null>(null);

  const lireComps = useCallback(async (pour: string) => {
    const lu = await lireCompetitionsDuCompte(pour).catch(() => ({ organisees: [], coOrganisees: [], parCode: [] }));
    setComps({ uid: pour, lu });
  }, []);

  useEffect(() => {
    if (!uid) return;
    let vivant = true;
    void lireCompetitionsDuCompte(uid)
      .catch(() => ({ organisees: [], coOrganisees: [], parCode: [] }))
      .then((lu) => {
        if (vivant) setComps({ uid, lu });
      });
    return () => {
      vivant = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid || !actif) return;
    return ecouterMatchsConfies(uid, (matchs) => setConfies({ uid, matchs }));
  }, [uid, actif]);

  useEffect(() => {
    if (!uid || !scoreur || !actif) return;
    return ecouterAmicauxAVenir(setAmicaux);
  }, [uid, scoreur, actif]);

  useEffect(() => {
    if (!uid || !proprietaire || !actif) return;
    return ecouterReservationsDuProprietaire(uid, (liste) => setResas({ uid, liste }));
  }, [uid, proprietaire, actif]);

  const lu = comps?.uid === uid ? comps.lu : null;
  // Les compétitions tenues (modérées, organisées, par code) et celles du compte (organisées, puis modérées).
  const tenues = useMemo(() => (lu ? competitionsSansDoublon([lu.coOrganisees, lu.organisees, lu.parCode]) : []), [lu]);
  const competitions = useMemo(() => (lu ? competitionsSansDoublon([lu.organisees, lu.coOrganisees]) : []), [lu]);

  // Chaîne stable : une liste relue à l'identique ne rebranche pas les écouteurs.
  const idsTenues = tenues.map((c) => c.id).join(",");
  useEffect(() => {
    if (!actif || !idsTenues) return;
    const arrets = idsTenues.split(",").map((cid) =>
      ecouterMatchsDuJour(cid, jour, (matchs) => setDuJour((avant) => ({ ...avant, [cid]: matchs }))),
    );
    return () => arrets.forEach((arret) => arret());
  }, [actif, idsTenues, jour]);

  const aTenirConfies = useMemo(
    () => (uid && confies?.uid === uid ? matchsConfiesATenir(confies.matchs) : []),
    [uid, confies],
  );
  const journees = useMemo(
    () =>
      tenues
        .map((competition) => ({ competition, matchs: matchsDuJour(duJour[competition.id] ?? [], jour) }))
        .filter((j) => j.matchs.length > 0),
    [tenues, duJour, jour],
  );
  const reservations = useMemo(
    () => (uid && proprietaire && resas?.uid === uid ? reservationsATraiter(resas.liste, jour) : null),
    [uid, proprietaire, resas, jour],
  );

  const sections = sectionsDeLEspace({
    scoreur,
    organisateur,
    proprietaire,
    aTenir: aTenirConfies.length + journees.reduce((n, j) => n + j.matchs.length, 0),
    competitions: competitions.length,
  });

  const rafraichir = useCallback(async () => {
    if (uid) await lireComps(uid);
  }, [uid, lireComps]);

  return {
    connecte: !!uid,
    chargement: !!uid && (!lu || confies?.uid !== uid),
    sections,
    scoreur,
    organisateur,
    confies: aTenirConfies,
    journees,
    amicaux: scoreur && amicaux ? amicauxSansScoreur(amicaux) : null,
    competitions,
    reservations,
    rafraichir,
  };
}
