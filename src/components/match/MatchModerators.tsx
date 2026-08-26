"use client";

import { useEffect, useState } from "react";
import { Radio, Loader2, Plus, X, Mail } from "lucide-react";
import toast from "react-hot-toast";
import { addMatchModerator, removeMatchModerator, getUsersByIds } from "@/lib/firestore";
import type { UserProfile } from "@/types";

// ============================================
// Qui couvre ce match.
//
// « Couvrir », ici, c'est tenir la console live : saisir les buts, les cartons
// et les remplacements minute par minute pendant la rencontre. Rien à voir
// avec une retransmission vidéo.
//
// POURQUOI CE BLOC EXISTE. La modération vivait uniquement à l'échelle d'une
// compétition (`competitions.moderator_ids`). Un amical n'appartient à aucune
// compétition : son manager était donc le seul compte capable d'en suivre le
// direct, et n'avait aucun moyen de confier ce poste à qui que ce soit. Le
// match était programmé, et personne ne pouvait le couvrir.
//
// L'INVITATION SE FAIT PAR EMAIL parce que c'est ce que le manager connaît de
// son bénévole. La résolution en compte se fait côté serveur, dans
// /api/matches/moderators, seul endroit où le SDK admin peut lire l'annuaire.
// ============================================

interface Props {
  matchId: string;
  moderatorIds: string[];
  /** Un match terminé n'a plus de direct à confier. */
  disabled?: boolean;
}

export default function MatchModerators({ matchId, moderatorIds, disabled }: Props) {
  const [profils, setProfils] = useState<UserProfile[]>([]);
  const [email, setEmail] = useState("");
  const [ajout, setAjout] = useState(false);
  const [retrait, setRetrait] = useState<string | null>(null);

  // Les uids viennent du match, les noms des comptes. Une seule requête pour
  // toute la liste, relancée quand elle change.
  useEffect(() => {
    if (moderatorIds.length === 0) { setProfils([]); return; }
    let annule = false;
    getUsersByIds(moderatorIds)
      .then((u) => { if (!annule) setProfils(u); })
      .catch(() => {});
    return () => { annule = true; };
  }, [moderatorIds]);

  const ajouter = async () => {
    const saisie = email.trim();
    if (!saisie) return;
    setAjout(true);
    try {
      const ajoute = await addMatchModerator(matchId, saisie);
      const nom = `${ajoute.firstName} ${ajoute.lastName}`.trim() || ajoute.email;
      toast.success(`${nom} couvrira ce match`);
      setEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'ajouter cette personne");
    } finally {
      setAjout(false);
    }
  };

  const retirer = async (uid: string) => {
    setRetrait(uid);
    try {
      await removeMatchModerator(matchId, uid);
      toast.success("Retiré de la couverture");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de retirer cette personne");
    } finally {
      setRetrait(null);
    }
  };

  return (
    <div className="border border-gray-200/70 bg-white p-5 sm:p-8">
      <div className="mb-5 flex items-start gap-3 border-b border-gray-200/70 pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-emerald-50 text-emerald-600">
          <Radio size={20} />
        </div>
        <div>
          <h3 className="text-base font-black text-gray-900 sm:text-lg">Qui couvre ce match</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            Ajoute n&apos;importe quel compte KoppaFoot par son email : la console live
            s&apos;ouvrira pour cette personne, sur ce match uniquement. Elle pourra
            saisir le direct et siffler la fin, rien d&apos;autre.
          </p>
        </div>
      </div>

      {profils.length > 0 && (
        <ul className="mb-4 space-y-2">
          {profils.map((p) => (
            <li
              key={p.uid}
              className="flex items-center justify-between gap-3 border border-gray-200/70 bg-gray-50/60 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">
                  {`${p.firstName} ${p.lastName}`.trim() || p.email}
                </p>
                <p className="truncate text-xs text-gray-500">{p.email}</p>
              </div>
              <button
                onClick={() => retirer(p.uid)}
                disabled={retrait === p.uid || disabled}
                className="flex h-8 w-8 shrink-0 items-center justify-center text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                aria-label={`Retirer ${p.firstName}`}
              >
                {retrait === p.uid ? <Loader2 size={15} className="animate-spin" /> : <X size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {disabled ? (
        <p className="border border-gray-200/70 bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
          Ce match est terminé : il n&apos;y a plus de direct à confier.
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Mail size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } }}
              placeholder="email@exemple.com"
              className="w-full border border-gray-200/70 bg-white py-2.5 pl-8 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={ajouter}
            disabled={ajout || !email.trim()}
            className="inline-flex items-center justify-center gap-2 bg-gray-900 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-black disabled:opacity-40"
          >
            {ajout ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}
