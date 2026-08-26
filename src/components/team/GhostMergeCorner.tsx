"use client";

import { useState } from "react";
import { GitMerge, Loader2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { mergeGhostPlayer } from "@/lib/firestore";
import type { GhostPlayer, UserProfile } from "@/types";

// ============================================
// Le coin fusion.
//
// Un club amateur inscrit ses joueurs sans smartphone comme joueurs sans
// compte : ils figurent sur les feuilles de match et accumulent une carrière.
// Le jour où l'un d'eux crée un compte et rejoint l'équipe, il repart de zéro
// pendant que son double continue d'exister à côté de lui — deux lignes pour
// un seul homme, dont une qui porte tout son passé.
//
// Ce bloc n'apparaît que s'il y a matière à fusionner : des joueurs sans compte
// ET des comptes dans l'effectif. Sans les deux, il ne dit rien et ne
// s'affiche pas.
// ============================================

interface Props {
  teamId: string;
  ghostPlayers: GhostPlayer[];
  members: UserProfile[];
  /** Rechargement de l'effectif après une fusion réussie. */
  onMerged: () => void;
}

export default function GhostMergeCorner({ teamId, ghostPlayers, members, onMerged }: Props) {
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);

  if (ghostPlayers.length === 0 || members.length === 0) return null;

  const fusionner = async (ghost: GhostPlayer) => {
    const playerId = choix[ghost.id];
    if (!playerId) return;
    const compte = members.find((m) => m.uid === playerId);
    const nomCompte = compte ? `${compte.firstName} ${compte.lastName}`.trim() : "ce compte";
    const nomFantome = `${ghost.firstName} ${ghost.lastName}`.trim();

    if (!window.confirm(
      `Fusionner ${nomFantome} avec ${nomCompte} ?\n\n` +
      `${ghost.matchesPlayed} match(s), ${ghost.goals} but(s) et ${ghost.assists} passe(s) ` +
      `seront ajoutés au compte, les feuilles de match passées porteront son vrai nom, ` +
      `et la fiche sans compte disparaîtra.\n\nC'est définitif.`
    )) return;

    setEnCours(ghost.id);
    try {
      const r = await mergeGhostPlayer({ teamId, ghostId: ghost.id, playerId });
      toast.success(`${r.nom} récupère ${r.matchs} match(s) et ${r.buts} but(s)`);
      setChoix((prev) => {
        const next = { ...prev };
        delete next[ghost.id];
        return next;
      });
      onMerged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La fusion a échoué");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="border border-gray-200/70 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3 border-b border-gray-200/70 pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-violet-50 text-violet-600">
          <GitMerge size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Fusionner un joueur</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            Un de tes joueurs sans compte vient d&apos;en créer un ? Rattache-le à son compte :
            ses matchs, buts et passes le suivent, et les feuilles de match passées prennent
            son vrai nom.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {ghostPlayers.map((g) => (
          <li
            key={g.id}
            className="flex flex-col gap-2 border border-gray-200/70 bg-gray-50/60 p-3 sm:flex-row sm:items-center"
          >
            <div className="min-w-0 sm:flex-1">
              <p className="truncate text-sm font-bold text-gray-900">
                {g.firstName} {g.lastName}
              </p>
              <p className="text-[11px] font-medium text-gray-500">
                {g.matchesPlayed} match{g.matchesPlayed > 1 ? "s" : ""} · {g.goals} but{g.goals > 1 ? "s" : ""} · {g.assists} passe{g.assists > 1 ? "s" : ""}
              </p>
            </div>

            <ArrowRight size={14} className="hidden shrink-0 text-gray-300 sm:block" />

            <div className="flex gap-2 sm:shrink-0">
              <select
                value={choix[g.id] ?? ""}
                onChange={(e) => setChoix((prev) => ({ ...prev, [g.id]: e.target.value }))}
                className="min-w-0 flex-1 border border-gray-200/70 bg-white px-2 py-2 text-sm outline-none focus:border-violet-500 sm:w-48 sm:flex-none"
              >
                <option value="">Choisir le compte…</option>
                {members.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {`${m.firstName} ${m.lastName}`.trim() || m.email}
                  </option>
                ))}
              </select>
              <button
                onClick={() => fusionner(g)}
                disabled={!choix[g.id] || enCours === g.id}
                className="inline-flex shrink-0 items-center gap-1.5 bg-violet-600 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white transition-colors hover:bg-violet-700 disabled:opacity-40"
              >
                {enCours === g.id ? <Loader2 size={13} className="animate-spin" /> : <GitMerge size={13} />}
                Fusionner
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
