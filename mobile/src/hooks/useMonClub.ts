import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { estProprietaireEquipe, peutGererEquipe } from "@/lib/team-access";
import type { GhostPlayer, Invitation, JoinRequest, Team } from "@/types";
import { useFicheDuClub } from "~/hooks/useFicheDuClub";
import {
  ecouterCandidatures, ecouterEquipe, ecouterFantomes, ecouterInvitationsEnvoyees, equipesQueJeGere,
} from "~/lib/equipe-firestore";
import { effectifPret, identitesDeLaFiche, nomsDeSecoursDe, type IdentiteMembre } from "~/lib/mon-club";

export type MonClub = {
  /** Les clubs qu'on gère ; null pendant la première lecture. */
  equipes: Team[] | null;
  /** Le club affiché, à jour en direct. */
  equipe: Team | null;
  choisir(id: string): void;
  fantomes: GhostPlayer[];
  candidatures: JoinRequest[];
  /** Toutes celles qu'on a envoyées : l'écran garde celles du club (invitationsEnAttente). */
  invitations: Invitation[];
  identites: Map<string, IdentiteMembre>;
  nomsDeSecours: Map<string, string>;
  peutGerer: boolean;
  proprietaire: boolean;
  /** Faux tant que les noms (fiche publique) et les joueurs sans compte ne sont pas arrivés. */
  pret: boolean;
  /** Relit la liste des clubs : après en avoir créé un, au retour sur l'onglet. */
  recharger(): void;
};

// Des listes vides stables : une nouvelle à chaque rendu relancerait les calculs qui en dépendent.
const AUCUN_FANTOME: GhostPlayer[] = [];
const AUCUNE_CANDIDATURE: JoinRequest[] = [];

/** Une valeur lue pour un club donné : celle d'un autre club, le temps d'en changer, ne s'affiche pas. */
type Lue<T> = { id: string; valeur: T } | null;
const pour = <T,>(lue: Lue<T>, id: string | null): T | undefined => (lue && lue.id === id ? lue.valeur : undefined);

/** Les siens d'abord, puis ceux qu'on vous a délégués ; par nom dans chaque groupe. */
function ranger(equipes: Team[], uid: string): Team[] {
  return [...equipes].sort(
    (a, b) => Number(b.managerId === uid) - Number(a.managerId === uid) || a.name.localeCompare(b.name, "fr"),
  );
}

export function useMonClub(uid: string): MonClub {
  const [equipes, setEquipes] = useState<Team[] | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [vivante, setVivante] = useState<Lue<Team | null>>(null);
  const [fantomes, setFantomes] = useState<Lue<GhostPlayer[]>>(null);
  const [candidatures, setCandidatures] = useState<Lue<JoinRequest[]>>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // Au retour sur l'onglet (un club créé, une délégation reçue) et à la demande.
  const lireLesClubs = useCallback(() => {
    let vivant = true;
    equipesQueJeGere(uid)
      .then((l) => {
        if (vivant) setEquipes(ranger(l, uid));
      })
      .catch(() => {
        if (vivant) setEquipes((e) => e ?? []);
      });
    return () => {
      vivant = false;
    };
  }, [uid]);
  useFocusEffect(lireLesClubs);

  const id = equipes?.some((t) => t.id === choisi) ? choisi : equipes?.[0]?.id ?? null;
  const duListe = equipes?.find((t) => t.id === id) ?? null;
  const enDirect = pour(vivante, id);
  // Le club de la liste, le temps que l'écouteur réponde ; null s'il a été supprimé entre-temps.
  const equipe = enDirect === undefined ? duListe : enDirect;
  const managerId = equipe?.managerId ?? null;

  useEffect(() => {
    if (!id) return;
    return ecouterEquipe(id, (t) => setVivante({ id, valeur: t }));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return ecouterFantomes(id, (g) => setFantomes({ id, valeur: g }));
  }, [id]);

  useEffect(() => {
    if (!id || !managerId) return;
    return ecouterCandidatures(id, managerId, (d) => setCandidatures({ id, valeur: d }));
  }, [id, managerId]);

  useEffect(() => ecouterInvitationsEnvoyees(uid, setInvitations), [uid]);

  const fiche = useFicheDuClub(id);
  const identites = useMemo(() => identitesDeLaFiche(fiche), [fiche]);
  const listeCandidatures = pour(candidatures, id) ?? AUCUNE_CANDIDATURE;
  const nomsDeSecours = useMemo(
    () => (equipe ? nomsDeSecoursDe(equipe, listeCandidatures, invitations) : new Map<string, string>()),
    [equipe, listeCandidatures, invitations],
  );

  return {
    equipes,
    equipe,
    choisir: setChoisi,
    fantomes: pour(fantomes, id) ?? AUCUN_FANTOME,
    candidatures: listeCandidatures,
    invitations,
    identites,
    nomsDeSecours,
    peutGerer: peutGererEquipe(equipe, uid),
    proprietaire: estProprietaireEquipe(equipe, uid),
    pret: effectifPret(fiche, pour(fantomes, id) !== undefined),
    recharger: () => {
      lireLesClubs();
    },
  };
}
