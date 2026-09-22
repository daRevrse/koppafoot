"use client";

import { useMemo, useState } from "react";
import { Loader2, Check, Trash2, Users, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { poserCompositionType } from "@/lib/firestore";
import { effectifParPoste, formationsPour, versFormation } from "@/lib/formations";
import { dispositif } from "@/lib/terrain";
import { TEAM_SIZE_OPTIONS } from "@/lib/competition-format";
import { INITIALE_POSTE, LIBELLE_POSTE, POSTES, normaliserPoste, type Poste } from "@/lib/postes";
import type { CompositionType, GhostPlayer, LineupEntry, UserProfile } from "@/types";

// ============================================
// LES COMPOSITIONS TYPES D'UN CLUB, une par format.
//
// POURQUOI CET ÉCRAN EXISTE. Un match ne démarre pas tant que les deux
// feuilles ne sont pas faites. La règle est bonne — on ne raconte pas un match
// sans savoir qui joue — mais elle se paie AU COUP D'ENVOI : le scoreur, qui
// n'est d'aucun des deux clubs, se retrouve à composer deux équipes qu'il ne
// connaît pas, au bord du terrain, pendant que tout le monde attend. Le match
// ne commence pas, et c'est la console qu'on accuse.
//
// Le club répond donc d'avance, au calme : sa formation et son onze pour
// chaque format qu'il joue. La console les retrouve et les propose déjà
// cochées — le scoreur valide, ou corrige, mais il ne part plus de rien.
//
// CE N'EST PAS LA MÊME CHOSE QUE LA FORMATION D'UN MATCH. Celle-ci se choisit
// déjà sur la fiche, match par match, et vaut pour ce dimanche-là. Ici on
// décrit l'équipe EN GÉNÉRAL, ce qui est une autre question et se répond une
// seule fois. Les deux partagent le catalogue de lib/formations, et c'est tout
// ce qu'elles ont en commun.
//
// UNE PAR NvN, parce qu'un 5v5 n'est pas un 11v11 amputé : ni les mêmes
// joueurs, ni les mêmes postes. Un club qui ne joue qu'à sept n'en remplit
// qu'une, et les formats qu'il ne joue pas restent vides — ce qui est la
// vérité sur lui.
//
// LES JOUEURS SANS COMPTE SONT DES JOUEURS. Ils tiennent la même place que les
// autres dans la liste, sans section à part : les séparer aurait fait deux
// moitiés d'équipe, et c'est souvent eux qui jouent.
// ============================================

type Role = "starter" | "substitute" | null;

interface Joueur {
  id: string;
  nom: string;
  numero: string;
  /** Le compte derrière la ligne, ou `null` pour un joueur sans compte. */
  userId: string | null;
  /** Le poste de sa fiche, qui sert de proposition. */
  posteParDefaut: Poste | null;
}

/** Le tour suivant : absent → titulaire → remplaçant → absent. */
const SUIVANT: Record<string, Role> = {
  null: "starter",
  starter: "substitute",
  substitute: null,
};

const PASTILLE: Record<"starter" | "substitute", string> = {
  starter: "border-gray-900 bg-gray-900 text-white",
  substitute: "border-amber-400 bg-amber-400 text-gray-900",
};

export default function CompositionsTypes({
  teamId,
  members,
  ghostPlayers,
  squadNumbers,
  compositions,
  managerId,
  onSaved,
}: {
  teamId: string;
  members: UserProfile[];
  ghostPlayers: GhostPlayer[];
  squadNumbers: { [playerId: string]: string };
  compositions: { [taille: string]: CompositionType };
  /** Le manager joue aussi : il est dans l'effectif comme les autres. */
  managerId: string;
  onSaved: () => void;
}) {
  const [taille, setTaille] = useState(11);
  const [enregistrement, setEnregistrement] = useState(false);

  // L'effectif du club, comptes et joueurs sans compte mêlés.
  const effectif = useMemo<Joueur[]>(
    () => [
      ...members.map((m) => ({
        id: m.uid,
        nom: `${m.firstName} ${m.lastName}`.trim(),
        numero: squadNumbers[m.uid]?.trim() ?? "",
        userId: m.uid,
        posteParDefaut: normaliserPoste(m.position),
      })),
      ...ghostPlayers.map((g) => ({
        id: g.id,
        nom: `${g.firstName} ${g.lastName}`.trim(),
        numero: g.squadNumber?.trim() ?? "",
        userId: null,
        posteParDefaut: g.position,
      })),
    ],
    [members, ghostPlayers, squadNumbers],
  );

  /**
   * Les formations de ce format, et le repli que le terrain applique déjà.
   *
   * `formationsPour` veut ce repli en second argument : hors catalogue — un
   * NvN que personne n'a prévu — il rend le dispositif du terrain plutôt
   * qu'une liste vide, et le menu n'est jamais muet.
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
    Record<string, { formation: string; roles: Record<string, Role>; postes: Record<string, Poste | null> }>
  >({});

  const depuisEnregistree = (c: CompositionType | null) => {
    const roles: Record<string, Role> = {};
    const postes: Record<string, Poste | null> = {};
    for (const e of c?.lineup ?? []) {
      roles[e.playerId] = e.role;
      postes[e.playerId] = e.position ?? null;
    }
    // Une formation enregistrée qui n'est plus au catalogue de ce format
    // retombe sur la première : mieux vaut une forme juste qu'un menu qui
    // n'a plus rien de sélectionné.
    const formation =
      c?.formation && formations.includes(c.formation) ? c.formation : formations[0];
    return { formation, roles, postes };
  };

  const courant = brouillons[String(taille)] ?? depuisEnregistree(enregistree);
  const modifie = brouillons[String(taille)] !== undefined;

  const poser = (patch: Partial<typeof courant>) =>
    setBrouillons((p) => ({ ...p, [String(taille)]: { ...courant, ...patch } }));

  const titulaires = effectif.filter((j) => courant.roles[j.id] === "starter");
  const remplacants = effectif.filter((j) => courant.roles[j.id] === "substitute");

  /** Ce que la formation attend à chaque poste, gardien compris. */
  const attendus = useMemo<Record<Poste, number>>(() => {
    const f = versFormation(courant.formation);
    return f
      ? effectifParPoste(f)
      : { goalkeeper: 1, defender: 0, midfielder: 0, forward: 0 };
  }, [courant.formation]);

  const posesParPoste = (p: Poste) =>
    titulaires.filter((j) => (courant.postes[j.id] ?? j.posteParDefaut) === p).length;

  const basculerRole = (id: string) => {
    const actuel = courant.roles[id] ?? null;
    let suivant = SUIVANT[String(actuel)];

    // LE ONZE NE DÉBORDE PAS. Au-delà du format, le joueur suivant passe
    // remplaçant plutôt que titulaire — c'est ce que fait déjà la console
    // quand le scoreur coche un titulaire de trop, et la console REFUSE de
    // valider une feuille trop longue. Une composition type qui déborde serait
    // donc pré-cochée puis rejetée au coup d'envoi, soit exactement le blocage
    // que cet écran existe pour supprimer.
    if (suivant === "starter" && titulaires.length >= taille) {
      suivant = "substitute";
      toast(`${taille} titulaires maximum, le reste en remplaçants`, { icon: "⚠️" });
    }

    const roles = { ...courant.roles };
    if (suivant === null) delete roles[id];
    else roles[id] = suivant;

    // On entre dans la feuille avec le poste de sa fiche : le manager n'a à
    // toucher qu'à ceux qu'il déplace.
    const postes = { ...courant.postes };
    if (suivant !== null && postes[id] === undefined) {
      postes[id] = effectif.find((j) => j.id === id)?.posteParDefaut ?? null;
    }
    poser({ roles, postes });
  };

  const enregistrer = async () => {
    const lineup: LineupEntry[] = effectif
      .filter((j) => courant.roles[j.id])
      .map((j) => ({
        playerId: j.id,
        name: j.nom,
        number: j.numero,
        role: courant.roles[j.id] as "starter" | "substitute",
        userId: j.userId,
        position: courant.postes[j.id] ?? j.posteParDefaut ?? null,
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

  return (
    <div className="space-y-4">
      <div className="border border-gray-200/70 bg-white p-4 sm:p-5">
        <h3 className="font-display text-base font-black uppercase tracking-tight text-gray-900">
          Compositions types
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          Le onze que ton club aligne pour chaque format, préparé une fois. Le
          scoreur le retrouve déjà coché au moment de la feuille de match : plus
          besoin de composer l&apos;équipe au bord du terrain pour lancer la
          rencontre.
        </p>
      </div>

      {/* LE FORMAT. Une rangée qui défile, et une coche sur ceux qui sont déjà
          préparés : c'est la seule chose qu'on vient vérifier en arrivant —
          « lesquels ai-je faits ? ». */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TEAM_SIZE_OPTIONS.map((t) => {
          const faite = (compositions[String(t)]?.lineup.length ?? 0) > 0;
          const actif = t === taille;
          return (
            <button
              key={t}
              onClick={() => setTaille(t)}
              className={`flex shrink-0 items-center gap-1.5 border px-3 py-2 text-xs font-black transition-colors ${
                actif
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200/70 bg-white text-gray-500 hover:border-gray-900 hover:text-gray-900"
              }`}
            >
              {t}v{t}
              {faite && (
                <Check
                  size={12}
                  className={`shrink-0 ${actif ? "text-emerald-300" : "text-emerald-500"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* LA FORMATION, et ce qu'elle attend à chaque rang. Le compte se lit à
          côté du choix, sinon le manager coche onze joueurs puis découvre
          qu'il a six milieux. */}
      <div className="border border-gray-200/70 bg-white p-4 sm:p-5">
        <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
          Formation
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {formations.map((f) => (
            <button
              key={f}
              onClick={() => poser({ formation: f })}
              className={`border px-3 py-2 text-sm font-black tabular-nums transition-colors ${
                courant.formation === f
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-gray-200/70 bg-white text-gray-500 hover:border-gray-900 hover:text-gray-900"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {POSTES.map((p) => {
            const poses = posesParPoste(p);
            const attendu = attendus[p];
            const juste = poses === attendu;
            return (
              <div
                key={p}
                className={`border px-2 py-2 text-center ${
                  juste ? "border-emerald-200 bg-emerald-50" : "border-gray-200/70 bg-gray-50"
                }`}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                  {LIBELLE_POSTE[p]}
                </p>
                <p
                  className={`mt-0.5 text-sm font-black tabular-nums ${
                    juste ? "text-emerald-700" : "text-gray-900"
                  }`}
                >
                  {poses}/{attendu}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-3 flex items-center justify-between text-xs font-bold">
          <span className={titulaires.length === taille ? "text-emerald-700" : "text-gray-500"}>
            {titulaires.length}/{taille} titulaire{titulaires.length > 1 ? "s" : ""}
          </span>
          <span className="text-gray-400">
            {remplacants.length} remplaçant{remplacants.length > 1 ? "s" : ""}
          </span>
        </p>

        {titulaires.length > 0 && titulaires.length < taille && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-700">
            <AlertTriangle size={13} className="shrink-0 text-amber-500" />
            Onze incomplet : le scoreur devra compléter au coup d&apos;envoi.
          </p>
        )}
      </div>

      {/* L'EFFECTIF. Un clic fait le tour des trois états, ce qui évite trois
          boutons par ligne sur un écran de téléphone. Le poste se change à
          côté, et seulement pour qui est sur la feuille. */}
      <div className="divide-y divide-gray-200/70 border border-gray-200/70 bg-white">
        {effectif.map((j) => {
          const role = courant.roles[j.id] ?? null;
          const poste = courant.postes[j.id] ?? j.posteParDefaut;
          return (
            <div key={j.id} className="flex items-center gap-3 p-3">
              <button
                onClick={() => basculerRole(j.id)}
                aria-label={
                  role === "starter"
                    ? `${j.nom}, titulaire. Passer remplaçant`
                    : role === "substitute"
                      ? `${j.nom}, remplaçant. Retirer de la feuille`
                      : `${j.nom}, hors feuille. Passer titulaire`
                }
                className={`flex h-7 w-7 shrink-0 items-center justify-center border-2 text-[10px] font-black transition-all ${
                  role ? PASTILLE[role] : "border-gray-200/70 text-transparent hover:border-gray-900"
                }`}
              >
                {role === "substitute" ? "R" : "T"}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">
                  {j.numero && <span className="mr-1.5 tabular-nums text-gray-400">{j.numero}</span>}
                  {j.nom}
                  {j.id === managerId && (
                    <span className="ml-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                      Manager
                    </span>
                  )}
                </p>
                {!j.userId && (
                  <p className="text-[11px] font-semibold text-gray-400">Sans compte</p>
                )}
              </div>

              {role && (
                <div className="flex shrink-0 gap-1">
                  {POSTES.map((p) => (
                    <button
                      key={p}
                      onClick={() => poser({ postes: { ...courant.postes, [j.id]: p } })}
                      title={LIBELLE_POSTE[p]}
                      aria-label={`${j.nom} : ${LIBELLE_POSTE[p]}`}
                      className={`flex h-7 w-7 items-center justify-center border text-[11px] font-black transition-colors ${
                        poste === p
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                          : "border-gray-200/70 text-gray-400 hover:border-gray-900 hover:text-gray-900"
                      }`}
                    >
                      {INITIALE_POSTE[p]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-gray-200/70 bg-white/95 px-3 py-3 pb-safe backdrop-blur">
        <p className="text-xs font-semibold text-gray-400">
          {modifie
            ? "Modifications non enregistrées"
            : enregistree
              ? `Enregistrée le ${enregistree.updatedAt}`
              : "Aucune composition pour ce format"}
        </p>
        <div className="flex shrink-0 gap-2">
          {enregistree && (
            <button
              onClick={() => {
                poser({ roles: {}, postes: {} });
                toast("Enregistre pour confirmer le retrait", { icon: "🗑️" });
              }}
              className="flex items-center gap-1.5 border border-gray-200/70 px-3 py-2 text-xs font-black text-gray-500 transition-colors hover:border-red-300 hover:text-red-600"
            >
              <Trash2 size={13} /> Vider
            </button>
          )}
          <button
            onClick={enregistrer}
            disabled={enregistrement || !modifie}
            className="flex items-center gap-1.5 bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enregistrement ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
