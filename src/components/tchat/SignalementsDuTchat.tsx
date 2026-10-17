"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminAction, useAdminApi } from "@/hooks/useAdminApi";
import { BOUTON_CONTOUR, BOUTON_DANGER, Carte, Chargement, Erreur, Titre, Vide, ilYA } from "@/components/admin/ui";
import type { SignalementDuTchat } from "@/lib/tchat";

// ============================================
// Les messages du tchat signalés, dans la page Signalements, à côté de ceux
// de la Tribune : un signalement attend une décision, il vit avec les autres.
// ============================================

export default function SignalementsDuTchat({ onTraite }: { onTraite?: () => void }) {
  const { data, erreur, chargement, recharger, setData } = useAdminApi<{ signalements: SignalementDuTchat[] }>(
    "/api/admin/tchat-signalements",
  );
  const agir = useAdminAction();
  const [enCours, setEnCours] = useState<string | null>(null);
  const liste = data?.signalements ?? [];

  const moderer = async (s: SignalementDuTchat, action: "supprimer" | "ignorer") => {
    if (action === "supprimer" && !window.confirm(`Supprimer le message de ${s.auteurNom} ? Il disparaît du tchat.`)) return;
    const cle = `${s.mid}_${s.messageId}`;
    setEnCours(cle);
    try {
      await agir("/api/admin/tchat-signalements", "PATCH", { mid: s.mid, messageId: s.messageId, action });
      toast.success(action === "supprimer" ? "Message supprimé" : "Signalement ignoré");
      setData({ signalements: liste.filter((x) => `${x.mid}_${x.messageId}` !== cle) });
      onTraite?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'opération a échoué");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <section>
      <Titre compte={liste.length}>Messages du tchat</Titre>
      {erreur && <Erreur message={erreur} onReessayer={recharger} />}
      {chargement ? (
        <Chargement />
      ) : liste.length === 0 ? (
        <Vide titre="Aucun message signalé" />
      ) : (
        <ul className="space-y-3">
          {liste.map((s) => {
            const cle = `${s.mid}_${s.messageId}`;
            return (
              <li key={cle}>
                <Carte className="p-4">
                  <p className="text-sm font-black text-gray-900">
                    {s.auteurUid ? (
                      <Link href={`/admin/users/${s.auteurUid}`} className="hover:text-emerald-700">{s.auteurNom}</Link>
                    ) : s.auteurNom}
                    <span className="font-semibold text-gray-400">
                      {" "}· signalé {s.signalements > 1 ? `${s.signalements} fois` : "une fois"} {ilYA(s.le)}
                    </span>
                  </p>
                  {/* La copie prise au signalement : un modérateur a pu vider le message depuis. */}
                  <p className="mt-2 border-l-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm italic text-gray-700">
                    {s.texte || "(sans texte)"}
                  </p>
                  {s.raisons.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      <strong className="font-black text-gray-700">Motifs :</strong> {s.raisons.join(" · ")}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button onClick={() => moderer(s, "ignorer")} disabled={enCours === cle} className={BOUTON_CONTOUR}>
                      <Check size={13} /> Ignorer
                    </button>
                    <button onClick={() => moderer(s, "supprimer")} disabled={enCours === cle} className={BOUTON_DANGER}>
                      {enCours === cle ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Supprimer le message
                    </button>
                    <Link
                      href={s.cid ? `/admin/competitions/${s.cid}` : `/matches/${s.mid}`}
                      className="ml-auto text-xs font-bold text-gray-400 hover:text-gray-700"
                    >
                      {s.cid ? "Voir la compétition" : "Voir le match"}
                    </Link>
                  </div>
                </Carte>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
