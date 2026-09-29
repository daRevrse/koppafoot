"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminAction, useAdminApi } from "@/hooks/useAdminApi";
import { useATraiter } from "@/components/admin/ATraiterContext";
import LigneMatch from "@/components/admin/LigneMatch";
import {
  BOUTON_CONTOUR, BOUTON_DANGER, BOUTON_PLEIN, Carte, Chargement, EnTete, Erreur, Filtres, Pastille, Titre, Vide, ilYA,
} from "@/components/admin/ui";
import type { ContestationAdmin } from "@/lib/admin-types";

// ============================================
// Les amicaux contestés, et leur arbitrage.
//
// QUAND DEUX CAMPS NE S'ACCORDENT PAS, PERSONNE NE TRANCHAIT. Le match restait
// « contesté » pour toujours : le score ne comptait ni ne disparaissait, et
// les deux managers attendaient une réponse que rien dans le produit ne
// pouvait donner. L'administration tranche ici, au vu de ce que chaque camp
// a dit du match, événement par événement.
//
// LE MOTIF EST EXIGÉ. Il part aux deux managers (notification, page du
// match) : une décision qu'on ne comprend pas relance la dispute au lieu de
// la clore.
// ============================================

const CAMPS = { home: "Domicile", away: "Extérieur" } as const;

export default function AdminContestationsPage() {
  const { data, erreur, chargement, recharger } = useAdminApi<{ contestations: ContestationAdmin[] }>("/api/admin/contestations");
  const agir = useAdminAction();
  const { rafraichir } = useATraiter();
  const [filtre, setFiltre] = useState<"a_trancher" | "tranchees">("a_trancher");
  const [decision, setDecision] = useState<{ matchId: string; choix: "valide" | "annule"; motif: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  const toutes = useMemo(() => data?.contestations ?? [], [data]);
  const aTrancher = toutes.filter((c) => !c.arbitrage);
  const tranchees = toutes.filter((c) => c.arbitrage);
  const affichees = filtre === "a_trancher" ? aTrancher : tranchees;

  const trancher = async () => {
    if (!decision) return;
    setEnCours(true);
    try {
      await agir("/api/admin/contestations", "POST", {
        matchId: decision.matchId, decision: decision.choix, motif: decision.motif,
      });
      toast.success(decision.choix === "valide" ? "Score validé, les deux managers sont prévenus" : "Match annulé, les deux managers sont prévenus");
      setDecision(null);
      recharger();
      rafraichir();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'arbitrage a échoué");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <EnTete
        titre="Contestations"
        sousTitre="Les amicaux sur lesquels les deux camps ne s'accordent pas. Ta décision part aux deux managers avec son motif."
      />
      <Filtres
        valeur={filtre}
        onChange={setFiltre}
        options={[
          { valeur: "a_trancher", label: "À trancher", compte: aTrancher.length },
          { valeur: "tranchees", label: "Tranchées", compte: tranchees.length },
        ]}
      />
      {erreur && <Erreur message={erreur} onReessayer={recharger} />}
      {chargement ? (
        <Chargement />
      ) : affichees.length === 0 ? (
        <Vide titre={filtre === "a_trancher" ? "Aucune contestation en cours" : "Aucune contestation tranchée"} />
      ) : (
        <ul className="space-y-4">
          {affichees.map((c) => (
            <li key={c.matchId}>
              <Carte>
                <LigneMatch m={c.match} />
                <div className="space-y-4 border-t border-gray-200/70 p-4">
                  <div>
                    <Titre>Ce que disent les camps</Titre>
                    {c.retours.length === 0 ? (
                      <p className="text-sm text-gray-500">Aucun retour écrit : la contestation porte sur des événements du match.</p>
                    ) : (
                      <ul className="space-y-2">
                        {c.retours.map((r) => (
                          <li key={r.camp} className="text-sm">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-black text-gray-900">{r.equipe}</span>
                              <span className="text-xs text-gray-400">{CAMPS[r.camp]} · {ilYA(r.le)}</span>
                              <Pastille ton={r.validation === "contested" ? "rouge" : "vert"}>
                                {r.validation === "contested" ? "Conteste" : "Valide"}
                              </Pastille>
                            </span>
                            {r.commentaire && <span className="mt-1 block border-l-2 border-gray-200 pl-3 text-gray-700">{r.commentaire}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {c.evenements.length > 0 && (
                    <div>
                      <Titre compte={c.evenements.length}>Événements contestés</Titre>
                      <ul className="space-y-1.5">
                        {c.evenements.map((e) => (
                          <li key={e.id} className="text-sm">
                            <span className="font-bold text-gray-900">{e.libelle}</span>
                            <span className="text-gray-500"> — contesté par {CAMPS[e.camp].toLowerCase()} : {e.motif}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {!c.statsCreditees && (
                    <p className="text-xs text-gray-500">
                      Score renseigné après coup : il n&apos;a encore rien crédité. Le valider le fera compter pour les deux clubs et les joueurs nommés.
                    </p>
                  )}

                  {c.arbitrage ? (
                    <p className="border-l-2 border-gray-900 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      <strong className="font-black text-gray-900">{c.arbitrage.decision === "valide" ? "Score validé" : "Match annulé"}</strong>
                      {" "}{ilYA(c.arbitrage.le)}. Motif : {c.arbitrage.motif}
                    </p>
                  ) : decision?.matchId === c.matchId ? (
                    <div className="space-y-2 border-t border-gray-100 pt-4">
                      <label htmlFor={`motif-${c.matchId}`} className="block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                        {decision.choix === "valide" ? "Valider le score" : "Annuler le match"} — motif, lu par les deux managers
                      </label>
                      <textarea
                        id={`motif-${c.matchId}`}
                        rows={3}
                        maxLength={500}
                        value={decision.motif}
                        onChange={(e) => setDecision({ ...decision, motif: e.target.value })}
                        placeholder={decision.choix === "valide"
                          ? "ex : Le score correspond à la feuille de l'arbitre et aux photos transmises."
                          : "ex : Le match n'a pas pu aller à son terme, aucun des deux scores n'est vérifiable."}
                        className="w-full resize-none border border-gray-200/70 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
                      />
                      <p className="text-xs text-gray-500">
                        {decision.choix === "valide"
                          ? "Le score compte dans les bilans, le classement et les statistiques."
                          : "Le match passe « annulé » : il sort des bilans, du classement et des statistiques calculées."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={trancher}
                          disabled={enCours || decision.motif.trim().length < 5}
                          className={decision.choix === "valide" ? BOUTON_PLEIN : BOUTON_DANGER}
                        >
                          {enCours && <Loader2 size={13} className="animate-spin" />}
                          Confirmer
                        </button>
                        <button onClick={() => setDecision(null)} className={BOUTON_CONTOUR}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                      <button onClick={() => setDecision({ matchId: c.matchId, choix: "valide", motif: "" })} className={BOUTON_PLEIN}>
                        <Check size={13} /> Valider le score
                      </button>
                      <button onClick={() => setDecision({ matchId: c.matchId, choix: "annule", motif: "" })} className={BOUTON_DANGER}>
                        <X size={13} /> Annuler le match
                      </button>
                    </div>
                  )}
                </div>
              </Carte>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
