"use client";

import { useMemo, useState } from "react";
import { Loader2, Check, ChevronLeft, ChevronRight, Users, X, UserMinus } from "lucide-react";
import toast from "react-hot-toast";
import { poserCompositionType } from "@/lib/firestore";
import { formationsPour, versFormation } from "@/lib/formations";
import { dispositif, disposerSurTerrain, placerSurTerrain, type Emplacement } from "@/lib/terrain";
import { TEAM_SIZE_OPTIONS } from "@/lib/competition-format";
import { INITIALE_POSTE, LIBELLE_POSTE, POSTES, normaliserPoste, type Poste } from "@/lib/postes";
import TerrainCompo from "@/components/match/TerrainCompo";
import type { CompositionType, GhostPlayer, LineupEntry, UserProfile } from "@/types";

// ============================================
// LES COMPOSITIONS TYPES D'UN CLUB : UN TERRAIN, ET RIEN D'AUTRE.
//
// POURQUOI CET ÉCRAN EXISTE. Un match ne démarre pas tant que les deux
// feuilles ne sont pas faites. La règle est bonne — on ne raconte pas un match
// sans savoir qui joue — mais elle se paie AU COUP D'ENVOI : le scoreur, qui
// n'est d'aucun des deux clubs, se retrouve à composer deux équipes qu'il ne
// connaît pas, au bord du terrain, pendant que tout le monde attend. Le club
// répond donc d'avance, au calme.
//
// ---------------------------------------------------------------------------
// ON COMPOSE SUR LE TERRAIN, PAS DANS UNE LISTE.
//
// La première version était un formulaire : une liste de l'effectif, trois
// boutons par ligne, et un terrain à côté qui montrait le résultat. Elle
// demandait au manager de traduire lui-même « je veux quatre défenseurs » en
// une suite de cases à cocher, puis de vérifier sur le dessin d'à côté qu'il
// ne s'était pas trompé. C'est exactement le travail que l'écran devrait
// faire à sa place.
//
// Le terrain EST donc l'éditeur : la formation choisie y ouvre ses
// emplacements, vides et pointillés, et on remplit chacun en le touchant. Il
// n'y a plus de liste d'effectif à demeure — elle apparaît quand on désigne un
// poste, refermée aussitôt le joueur choisi. Plus d'intro non plus : un
// terrain vide avec des trous à combler dit ce qu'il attend mieux qu'un
// paragraphe.
//
// LE FORMAT ET LA FORMATION SONT DES PAS, pas des rangées de boutons. Huit
// formats et huit formations faisaient seize cibles à l'écran pour deux
// réglages qu'on change rarement et jamais au hasard — on passe du 11v11 au
// 7v7, on essaie le 4-3-3 puis le 4-4-2. Une flèche de chaque côté suffit, et
// rend la valeur courante lisible d'un coup d'œil.
//
// LE MÊME DESSIN QUE PARTOUT. Le terrain vient de TerrainCompo, celui de la
// fiche publique et de la console : `onPlaceClick` est la seule chose qui
// change ici. Deux terrains auraient dérivé au premier ajustement.
//
// LES JOUEURS SANS COMPTE SONT DES JOUEURS. Ils entrent dans le sélecteur
// comme les autres, sans section à part : c'est souvent eux qui jouent.
//
// LA CASE TOUCHÉE EST CELLE OÙ LE JOUEUR VA. On ne retenait que le poste de
// l'emplacement : le terrain rangeait ensuite la ligne dans l'ordre de
// l'effectif, et l'arrière droit qu'on venait de choisir partait tout à
// gauche. Chaque titulaire garde maintenant sa case (voir lib/terrain), et un
// joueur se déplace en le faisant glisser. Choisir pour une case un joueur
// déjà placé ailleurs ÉCHANGE les deux ; choisir un remplaçant envoie
// l'occupant sur le banc.
// ============================================

type Role = "starter" | "substitute";

interface Joueur {
  id: string;
  nom: string;
  numero: string;
  /** Le compte derrière la ligne, ou `null` pour un joueur sans compte. */
  userId: string | null;
  /** Le poste de sa fiche, qui sert de proposition. */
  posteParDefaut: Poste | null;
  photo: string | null;
}

/** « D » → `defender`. L'inverse de INITIALE_POSTE, que le terrain nous rend. */
const POSTE_PAR_INITIALE: Record<string, Poste> = Object.fromEntries(
  POSTES.map((p) => [INITIALE_POSTE[p], p]),
) as Record<string, Poste>;

/** Ce que le sélecteur vient faire : remplir un poste, ou garnir le banc. */
type Demande =
  | { quoi: "terrain"; poste: Poste; occupant: string | null; emplacement: Emplacement | null }
  | { quoi: "banc" };

export default function CompositionsTypes({
  teamId,
  members,
  ghostPlayers,
  squadNumbers,
  compositions,
  onSaved,
}: {
  teamId: string;
  members: UserProfile[];
  ghostPlayers: GhostPlayer[];
  squadNumbers: { [playerId: string]: string };
  compositions: { [taille: string]: CompositionType };
  onSaved: () => void;
}) {
  const [taille, setTaille] = useState(11);
  const [enregistrement, setEnregistrement] = useState(false);
  const [demande, setDemande] = useState<Demande | null>(null);

  // L'effectif du club, comptes et joueurs sans compte mêlés.
  const effectif = useMemo<Joueur[]>(
    () => [
      ...members.map((m) => ({
        id: m.uid,
        nom: `${m.firstName} ${m.lastName}`.trim(),
        numero: squadNumbers[m.uid]?.trim() ?? "",
        userId: m.uid,
        posteParDefaut: normaliserPoste(m.position),
        photo: m.profilePictureUrl ?? null,
      })),
      ...ghostPlayers.map((g) => ({
        id: g.id,
        nom: `${g.firstName} ${g.lastName}`.trim(),
        numero: g.squadNumber?.trim() ?? "",
        userId: null,
        posteParDefaut: g.position,
        photo: null,
      })),
    ],
    [members, ghostPlayers, squadNumbers],
  );

  const parId = useMemo(() => new Map(effectif.map((j) => [j.id, j])), [effectif]);
  const photos = useMemo(
    () => Object.fromEntries(effectif.map((j) => [j.id, j.photo])),
    [effectif],
  );

  /**
   * Les formations de ce format, et le repli que le terrain applique déjà.
   *
   * `formationsPour` veut ce repli en second argument : hors catalogue — un
   * NvN que personne n'a prévu — il rend le dispositif du terrain plutôt
   * qu'une liste vide, et le pas ne tourne jamais dans le vide.
   */
  const formations = useMemo(
    () => formationsPour(taille, dispositif(taille)),
    [taille],
  );

  const enregistree = compositions[String(taille)] ?? null;

  /**
   * LE BROUILLON, PAR FORMAT.
   *
   * Un état par taille et non un seul : passer du 11v11 au 7v7 pour y jeter un
   * œil ne doit pas effacer le travail en cours sur le premier. `undefined`
   * veut dire « jamais touché ici », et c'est alors la version enregistrée qui
   * s'affiche — d'où la distinction avec un brouillon vide, qui est un
   * effacement volontaire.
   */
  const [brouillons, setBrouillons] = useState<
    Record<string, {
      formation: string;
      roles: Record<string, Role>;
      postes: Record<string, Poste | null>;
      /** La case de chaque titulaire placé à la main. Voir lib/terrain. */
      emplacements: Record<string, Emplacement>;
    }>
  >({});

  const depuisEnregistree = (c: CompositionType | null) => {
    const roles: Record<string, Role> = {};
    const postes: Record<string, Poste | null> = {};
    const emplacements: Record<string, Emplacement> = {};
    for (const e of c?.lineup ?? []) {
      roles[e.playerId] = e.role;
      postes[e.playerId] = e.position ?? null;
      if (e.role === "starter" && e.emplacement) emplacements[e.playerId] = e.emplacement;
    }
    // Une formation enregistrée qui n'est plus au catalogue de ce format
    // retombe sur la première : mieux vaut une forme juste qu'un pas bloqué
    // sur une valeur qui n'existe plus.
    const formation =
      c?.formation && formations.includes(c.formation) ? c.formation : formations[0];
    // Des cases posées pour une AUTRE formation ne veulent plus rien dire.
    return { formation, roles, postes, emplacements: formation === c?.formation ? emplacements : {} };
  };

  const courant = brouillons[String(taille)] ?? depuisEnregistree(enregistree);
  const modifie = brouillons[String(taille)] !== undefined;

  const poser = (patch: Partial<typeof courant>) =>
    setBrouillons((p) => ({ ...p, [String(taille)]: { ...courant, ...patch } }));

  const titulaires = effectif.filter((j) => courant.roles[j.id] === "starter");
  const remplacants = effectif.filter((j) => courant.roles[j.id] === "substitute");

  /** Ce que le terrain dessine : les titulaires, avec le poste qu'on leur a donné. */
  const surLeTerrain = useMemo<LineupEntry[]>(
    () =>
      titulaires.map((j) => ({
        playerId: j.id,
        name: j.nom,
        number: j.numero,
        role: "starter" as const,
        userId: j.userId,
        position: courant.postes[j.id] ?? j.posteParDefaut ?? null,
        emplacement: courant.emplacements[j.id] ?? null,
      })),
    [titulaires, courant.postes, courant.emplacements],
  );

  /** Où le terrain dessine chacun, en ce moment : c'est de là qu'on déplace. */
  const formationCourante = useMemo(() => versFormation(courant.formation), [courant.formation]);
  const disposition = useMemo(
    () => disposerSurTerrain(surLeTerrain, taille, "haut", formationCourante),
    [surLeTerrain, taille, formationCourante],
  );

  // ---- Les deux pas : le format, la formation -------------------------------

  const pasFormat = (sens: 1 | -1) => {
    const i = TEAM_SIZE_OPTIONS.indexOf(taille);
    const suivant = TEAM_SIZE_OPTIONS[i + sens];
    if (suivant !== undefined) setTaille(suivant);
  };

  const pasFormation = (sens: 1 | -1) => {
    const i = formations.indexOf(courant.formation);
    const suivante = formations[i + sens];
    // Les cases choisies ne survivent pas à la formation : on repart des
    // postes, que la nouvelle forme range à sa façon.
    if (suivante !== undefined) poser({ formation: suivante, emplacements: {} });
  };

  // ---- Remplir un emplacement ----------------------------------------------

  /**
   * Mettre `joueurId` dans cette case. Voir `placerSurTerrain` : tout le monde
   * se fige où il est, la case prise s'échange, et le poste suit la case.
   */
  const placer = (joueurId: string, vers: Emplacement) => {
    if (!formationCourante) return;
    const { placements, deloge } = placerSurTerrain(disposition.places, formationCourante, joueurId, vers);
    const roles = { ...courant.roles };
    const postes = { ...courant.postes };
    const emplacements: Record<string, Emplacement> = {};
    for (const [id, p] of Object.entries(placements)) {
      emplacements[id] = p.emplacement;
      postes[id] = p.poste;
    }
    const venaitDuBanc = roles[joueurId] === "substitute";
    roles[joueurId] = "starter";
    if (deloge) {
      // Il prend la place de celui qu'il remplace : le remplaçant qui entre
      // envoie l'occupant sur le banc, un joueur hors de la feuille le sort.
      if (venaitDuBanc) roles[deloge] = "substitute";
      else delete roles[deloge];
      delete postes[deloge];
    }
    poser({ roles, postes, emplacements });
  };

  const choisir = (joueurId: string) => {
    if (!demande) return;
    const roles = { ...courant.roles };
    const postes = { ...courant.postes };
    const emplacements = { ...courant.emplacements };

    if (demande.quoi === "banc") {
      roles[joueurId] = "substitute";
      delete emplacements[joueurId];
    } else if (demande.emplacement && formationCourante) {
      placer(joueurId, demande.emplacement);
      setDemande(null);
      return;
    } else {
      // L'ancien occupant sort : un emplacement ne tient qu'une personne.
      if (demande.occupant && demande.occupant !== joueurId) {
        delete roles[demande.occupant];
        delete postes[demande.occupant];
        delete emplacements[demande.occupant];
      }
      roles[joueurId] = "starter";
      postes[joueurId] = demande.poste;
    }

    poser({ roles, postes, emplacements });
    setDemande(null);
  };

  const retirer = (joueurId: string) => {
    const roles = { ...courant.roles };
    const postes = { ...courant.postes };
    const emplacements = { ...courant.emplacements };
    delete roles[joueurId];
    delete postes[joueurId];
    delete emplacements[joueurId];
    poser({ roles, postes, emplacements });
    setDemande(null);
  };

  // ---- Enregistrer ----------------------------------------------------------

  const enregistrer = async () => {
    const lineup: LineupEntry[] = effectif
      .filter((j) => courant.roles[j.id])
      .map((j) => ({
        playerId: j.id,
        name: j.nom,
        number: j.numero,
        role: courant.roles[j.id],
        userId: j.userId,
        position: courant.postes[j.id] ?? j.posteParDefaut ?? null,
        emplacement: courant.roles[j.id] === "starter" ? courant.emplacements[j.id] ?? null : null,
      }));

    setEnregistrement(true);
    try {
      await poserCompositionType(teamId, taille, { formation: courant.formation, lineup });
      setBrouillons((p) => {
        const suivant = { ...p };
        delete suivant[String(taille)];
        return suivant;
      });
      toast.success(
        lineup.length === 0
          ? `Composition ${taille}v${taille} retirée`
          : `Composition ${taille}v${taille} enregistrée`,
      );
      onSaved();
    } catch (err) {
      console.error("poserCompositionType:", err);
      toast.error("Enregistrement impossible");
    } finally {
      setEnregistrement(false);
    }
  };

  if (effectif.length === 0) {
    return (
      <div className="flex flex-col items-center border border-gray-200/70 bg-white py-12 text-center">
        <Users size={32} className="text-gray-300" />
        <p className="mt-3 text-sm font-semibold text-gray-500">
          Ajoute des joueurs à l&apos;effectif avant de préparer une composition.
        </p>
      </div>
    );
  }

  const iFormat = TEAM_SIZE_OPTIONS.indexOf(taille);
  const iFormation = formations.indexOf(courant.formation);

  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      {/* LES DEUX PAS, côte à côte. Le format commande la formation : changer
          de NvN change la liste des formes disponibles, et c'est pour ça qu'ils
          se lisent dans cet ordre. */}
      <div className="grid grid-cols-2 gap-3">
        <Pas
          libelle="Format"
          valeur={`${taille}v${taille}`}
          surPrecedent={iFormat > 0 ? () => pasFormat(-1) : null}
          surSuivant={iFormat < TEAM_SIZE_OPTIONS.length - 1 ? () => pasFormat(1) : null}
          marque={(compositions[String(taille)]?.lineup.length ?? 0) > 0}
        />
        <Pas
          libelle="Formation"
          valeur={courant.formation}
          surPrecedent={iFormation > 0 ? () => pasFormation(-1) : null}
          surSuivant={iFormation < formations.length - 1 ? () => pasFormation(1) : null}
        />
      </div>

      {/* LE TERRAIN. Même composant que la fiche publique et la console : ici
          seulement, ses emplacements répondent au clic. */}
      <div className="overflow-hidden border border-gray-200/70">
        <TerrainCompo
          titulaires={surLeTerrain}
          taille={taille}
          formation={courant.formation}
          photos={photos}
          onPlaceClick={(_, place) =>
            setDemande({
              quoi: "terrain",
              poste: POSTE_PAR_INITIALE[place.etiquette] ?? "midfielder",
              occupant: place.entry?.playerId ?? null,
              emplacement: place.emplacement,
            })
          }
          onDeplacer={placer}
        />
      </div>
      {titulaires.length > 1 && (
        <p className="-mt-1 text-center text-[11px] font-semibold text-gray-400">
          Fais glisser un joueur pour le changer de place, ou sur un autre pour les échanger.
        </p>
      )}

      {/* LE BANC, en une ligne de pastilles. Il n'a pas besoin du terrain : un
          remplaçant n'a pas de place dessus, c'est même sa définition. */}
      <div className="border border-gray-200/70 bg-white p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
          Banc
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remplacants.map((j) => (
            <button
              key={j.id}
              onClick={() => retirer(j.id)}
              title={`Retirer ${j.nom} du banc`}
              className="flex items-center gap-1.5 border border-gray-200/70 bg-gray-50 py-1.5 pl-2 pr-2.5 text-xs font-bold text-gray-700 transition-colors hover:border-red-300 hover:text-red-600"
            >
              {j.numero && <span className="tabular-nums text-gray-400">{j.numero}</span>}
              {j.nom}
              <X size={11} className="shrink-0 opacity-50" />
            </button>
          ))}
          <button
            onClick={() => setDemande({ quoi: "banc" })}
            className="border border-dashed border-gray-300 px-3 py-1.5 text-xs font-black text-gray-400 transition-colors hover:border-gray-900 hover:text-gray-900"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {/* LA BARRE, collée en bas : le compte des titulaires et l'enregistrement.
          C'est le seul endroit où un chiffre est utile — le reste, le terrain
          le montre. */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-gray-200/70 bg-white/95 px-3 py-3 pb-safe backdrop-blur">
        <p className="text-xs font-bold">
          <span className={titulaires.length === taille ? "text-emerald-700" : "text-gray-500"}>
            {titulaires.length}/{taille}
          </span>
          <span className="ml-1.5 font-semibold text-gray-400">
            {modifie ? "· non enregistré" : enregistree ? "· enregistrée" : ""}
          </span>
        </p>
        <button
          onClick={enregistrer}
          disabled={enregistrement || !modifie}
          className="flex items-center gap-1.5 bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enregistrement ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Enregistrer
        </button>
      </div>

      {demande && (
        <SelecteurDeJoueur
          demande={demande}
          effectif={effectif}
          roles={courant.roles}
          occupantNom={
            demande.quoi === "terrain" && demande.occupant
              ? parId.get(demande.occupant)?.nom ?? null
              : null
          }
          onChoisir={choisir}
          onRetirer={
            demande.quoi === "terrain" && demande.occupant
              ? () => retirer(demande.occupant as string)
              : null
          }
          onFermer={() => setDemande(null)}
        />
      )}
    </div>
  );
}

/** Un réglage qu'on parcourt : une valeur, une flèche de chaque côté. */
function Pas({
  libelle,
  valeur,
  surPrecedent,
  surSuivant,
  marque = false,
}: {
  libelle: string;
  valeur: string;
  /** `null` en bout de course : le bouton reste, éteint, pour que rien ne bouge. */
  surPrecedent: (() => void) | null;
  surSuivant: (() => void) | null;
  /** Une coche discrète : ce format a déjà une composition enregistrée. */
  marque?: boolean;
}) {
  const fleche =
    "flex h-8 w-8 shrink-0 items-center justify-center text-gray-400 transition-colors enabled:hover:text-gray-900 disabled:opacity-25";
  return (
    <div className="border border-gray-200/70 bg-white px-1.5 py-2">
      <p className="px-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
        {libelle}
      </p>
      <div className="flex items-center justify-between">
        <button type="button" onClick={surPrecedent ?? undefined} disabled={!surPrecedent} aria-label={`${libelle} précédent`} className={fleche}>
          <ChevronLeft size={16} />
        </button>
        <span className="flex min-w-0 items-center gap-1.5 truncate font-display text-base font-black tabular-nums text-gray-900">
          {valeur}
          {marque && <Check size={13} className="shrink-0 text-emerald-500" />}
        </span>
        <button type="button" onClick={surSuivant ?? undefined} disabled={!surSuivant} aria-label={`${libelle} suivant`} className={fleche}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * Qui met-on là ?
 *
 * Il s'ouvre sur un geste et se referme au choix : c'est ce qui permet de ne
 * pas garder l'effectif entier à l'écran en permanence. LES JOUEURS DU POSTE
 * DEMANDÉ SONT EN TÊTE — on cherche un défenseur, on ne veut pas faire défiler
 * les attaquants —, mais aucun n'est caché : un manager met qui il veut où il
 * veut, et c'est son affaire.
 */
function SelecteurDeJoueur({
  demande,
  effectif,
  roles,
  occupantNom,
  onChoisir,
  onRetirer,
  onFermer,
}: {
  demande: Demande;
  effectif: Joueur[];
  roles: Record<string, Role>;
  occupantNom: string | null;
  onChoisir: (id: string) => void;
  onRetirer: (() => void) | null;
  onFermer: () => void;
}) {
  const posteVise = demande.quoi === "terrain" ? demande.poste : null;

  const listeTriee = useMemo(() => {
    const libres = effectif.filter((j) => !roles[j.id]);
    const ailleurs = effectif.filter((j) => roles[j.id]);
    const prioritaire = (j: Joueur) => (posteVise && j.posteParDefaut === posteVise ? 0 : 1);
    return [
      ...libres.sort((a, b) => prioritaire(a) - prioritaire(b)),
      ...ailleurs,
    ];
  }, [effectif, roles, posteVise]);

  return (
    <div className="modal-layer fixed inset-0 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200/70 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
              {demande.quoi === "banc" ? "Ajouter au banc" : LIBELLE_POSTE[demande.poste]}
            </p>
            {occupantNom && (
              <p className="truncate text-sm font-black text-gray-900">{occupantNom}</p>
            )}
          </div>
          <button onClick={onFermer} aria-label="Fermer" className="flex h-8 w-8 shrink-0 items-center justify-center text-gray-400 hover:text-gray-900">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 divide-y divide-gray-200/70 overflow-y-auto">
          {listeTriee.map((j) => {
            const role = roles[j.id];
            return (
              <button
                key={j.id}
                onClick={() => onChoisir(j.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-black text-gray-500">
                  {j.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={j.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    j.numero || j.nom[0]?.toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-gray-900">{j.nom}</span>
                  <span className="block text-[11px] font-semibold text-gray-400">
                    {j.posteParDefaut ? LIBELLE_POSTE[j.posteParDefaut] : "Poste non déclaré"}
                    {!j.userId && " · sans compte"}
                  </span>
                </span>
                {role && (
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600">
                    {/* Choisir un titulaire pour une case l'y fait venir, et
                        l'occupant prend sa place : autant le dire. */}
                    {role === "starter" ? (posteVise ? "Échanger" : "Titulaire") : "Banc"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {onRetirer && (
          <button
            onClick={onRetirer}
            className="flex shrink-0 items-center justify-center gap-2 border-t border-gray-200/70 px-4 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-red-600 transition-colors hover:bg-red-50"
          >
            <UserMinus size={14} /> Libérer l&apos;emplacement
          </button>
        )}
      </div>
    </div>
  );
}
