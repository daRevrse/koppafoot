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
// ============================================

export default function FollowMatchButton({
  mid,
  cid,
}: {
  mid: string;
  /** La compétition, quand il y en a une. Sert à la diffusion. */
  cid?: string | null;
}) {
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

  const Icone = suivi ? BellRing : Bell;

  return (
    <button
      type="button"
      onClick={basculer}
      disabled={occupe}
      aria-pressed={suivi}
      aria-label={suivi ? "Ne plus suivre ce match" : "Suivre ce match"}
      className={`flex h-8 w-8 items-center justify-center border transition-colors disabled:opacity-50 ${
        suivi
          ? "border-emerald-600 text-emerald-700"
          : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
      }`}
    >
      {charge || occupe ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Icone size={14} />
      )}
    </button>
  );
}
