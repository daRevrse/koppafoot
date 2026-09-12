"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { suitLeMatch, basculerSuiviMatch } from "@/lib/suivi-match";

// ============================================
// La cloche d'un match.
//
// CE QU'ELLE PROMET, ET SEULEMENT ÇA. Elle prévient quand quelqu'un TIENT LA
// CONSOLE : coup d'envoi, buts, fin. Un match que personne ne couvre
// n'émettra rien, et aucune cloche n'y changera quoi que ce soit — c'est
// pourquoi le libellé parle du direct et non du match.
//
// Elle existait déjà pour les compétitions (FollowCompetitionButton), mais
// suivre une compétition entière pour un match, c'est recevoir les
// quarante autres. Sur un amical, elle n'existait pas du tout : un amical
// n'appartient à aucune compétition, il n'y avait rien à suivre.
//
// UN ÉTAT, DEUX CLOCHES. Le tableau d'affichage la montre en haut de page, et
// sa barre repliée la garde quand on défile. Deux composants autonomes
// auraient lu deux fois l'abonnement, et la cloche basculée dans l'une
// serait restée éteinte dans l'autre : l'état vit dans `useSuiviMatch`,
// appelé une fois, et chaque cloche ne fait que l'afficher.
// ============================================

export interface SuiviMatch {
  suivi: boolean;
  charge: boolean;
  occupe: boolean;
  basculer: () => void;
}

export function useSuiviMatch(
  mid: string,
  /** La compétition, quand il y en a une. Sert à la diffusion. */
  cid?: string | null,
): SuiviMatch {
  const { user } = useAuth();
  const [suivi, setSuivi] = useState(false);
  const [charge, setCharge] = useState(true);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    if (!user) { setCharge(false); return; }
    let vivant = true;
    suitLeMatch(mid, user.uid)
      .then((v) => { if (vivant) setSuivi(v); })
      .finally(() => { if (vivant) setCharge(false); });
    return () => { vivant = false; };
  }, [mid, user]);

  const basculer = async () => {
    if (!user) {
      toast("Crée un compte pour recevoir le direct de ce match.", { icon: "🔔" });
      return;
    }
    setOccupe(true);
    // Bascule optimiste : la cloche répond au doigt, la correction n'arrive
    // que si l'écriture échoue.
    const vise = !suivi;
    setSuivi(vise);
    try {
      await basculerSuiviMatch(mid, user.uid, vise, cid);
      toast.success(vise ? "Tu suis ce match" : "Suivi arrêté");
    } catch {
      setSuivi(!vise);
      toast.error("Le suivi n'a pas pu être enregistré");
    } finally {
      setOccupe(false);
    }
  };

  return { suivi, charge, occupe, basculer: () => { void basculer(); } };
}

/** La cloche, sur le fond sombre du tableau d'affichage. */
export default function ClocheMatch({ etat }: { etat: SuiviMatch }) {
  const Icone = etat.suivi ? BellRing : Bell;
  return (
    <button
      type="button"
      onClick={etat.basculer}
      disabled={etat.occupe}
      aria-pressed={etat.suivi}
      aria-label={etat.suivi ? "Ne plus suivre ce match" : "Suivre ce match"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center border transition-colors disabled:opacity-50 ${
        etat.suivi
          ? "border-emerald-400 text-emerald-300"
          : "border-white/15 text-white/70 hover:border-white hover:text-white"
      }`}
    >
      {etat.charge || etat.occupe ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Icone size={14} />
      )}
    </button>
  );
}
