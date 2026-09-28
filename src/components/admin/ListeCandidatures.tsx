"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Mail, MapPin, Phone, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminAction, useAdminApi } from "@/hooks/useAdminApi";
import { useATraiter } from "@/components/admin/ATraiterContext";
import {
  BOUTON_CONTOUR, BOUTON_DANGER, BOUTON_PLEIN, Carte, Chargement, EnTete, Erreur, Filtres, Pastille, Vide, ilYA,
} from "@/components/admin/ui";

// ============================================
// Une file de candidatures : organisateurs, scoreurs, terrains.
//
// TROIS PAGES SŒURS, TROIS STYLES, DEUX RÈGLES. Les terrains se refusaient
// avec un motif que le candidat lisait ; les organisateurs et les scoreurs se
// refusaient d'un clic, sans un mot — et le scoreur n'était même pas prévenu.
// Une seule file maintenant, la même carte, le même refus motivé. Seul change
// ce qu'on vérifie avant de répondre, que chaque page décrit.
// ============================================

export interface CandidatureAffichee {
  id: string;
  uid: string;
  statut: "pending" | "approved" | "rejected";
  /** Qui candidate. */
  nom: string;
  /** Ce qui est demandé, quand ce n'est pas la personne : un terrain, une structure. */
  titre: string | null;
  email: string | null;
  telephone: string | null;
  ville: string | null;
  le: string | null;
  details: { label: string; valeur: string }[];
  motivation: string | null;
  motifRefus: string | null;
}

const STATUTS = {
  pending: { label: "En attente", ton: "ambre" as const },
  approved: { label: "Acceptée", ton: "vert" as const },
  rejected: { label: "Refusée", ton: "gris" as const },
};

export default function ListeCandidatures({
  titre, sousTitre, url, lire, urlDecision, accepter, exempleMotif,
}: {
  titre: string;
  sousTitre: string;
  url: string;
  lire: (json: unknown) => CandidatureAffichee[];
  urlDecision: (id: string) => string;
  /** Ce que fait « accepter », dit sur le bouton : « Ouvrir l'espace organisateur ». */
  accepter: string;
  exempleMotif: string;
}) {
  const { data, erreur, chargement, recharger } = useAdminApi<unknown>(url);
  const agir = useAdminAction();
  const { rafraichir } = useATraiter();
  const [filtre, setFiltre] = useState<"pending" | "toutes">("pending");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [refus, setRefus] = useState<{ id: string; motif: string } | null>(null);

  const toutes = useMemo(() => (data ? lire(data) : []), [data, lire]);
  const enAttente = toutes.filter((c) => c.statut === "pending");
  const affichees = filtre === "pending" ? enAttente : toutes;

  const decider = async (c: CandidatureAffichee, action: "approve" | "reject", motif = "") => {
    setEnCours(c.id);
    try {
      await agir(urlDecision(c.id), "PATCH", { action, motif });
      toast.success(action === "approve" ? `${c.nom} : candidature acceptée` : `${c.nom} : candidature refusée`);
      setRefus(null);
      recharger();
      rafraichir();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La décision n'a pas été enregistrée");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <EnTete titre={titre} sousTitre={sousTitre} />
      <Filtres
        valeur={filtre}
        onChange={setFiltre}
        options={[
          { valeur: "pending", label: "En attente", compte: enAttente.length },
          { valeur: "toutes", label: "Toutes", compte: toutes.length },
        ]}
      />
      {erreur && <Erreur message={erreur} onReessayer={recharger} />}
      {chargement ? (
        <Chargement />
      ) : affichees.length === 0 ? (
        <Vide titre={filtre === "pending" ? "Rien à examiner" : "Aucune candidature"} />
      ) : (
        <ul className="space-y-3">
          {affichees.map((c) => (
            <li key={c.id}>
              <Carte className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {c.titre && (
                      <p className="font-display text-lg font-black uppercase leading-tight tracking-tight text-gray-900">{c.titre}</p>
                    )}
                    <Link href={`/admin/users/${c.uid}`} className={`${c.titre ? "text-sm font-bold text-gray-600" : "text-base font-black text-gray-900"} hover:text-emerald-700`}>
                      {c.nom}
                    </Link>
                  </div>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400">{ilYA(c.le)}</span>
                    <Pastille ton={STATUTS[c.statut].ton}>{STATUTS[c.statut].label}</Pastille>
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-gray-900"><Mail size={12} /> {c.email}</a>}
                  {c.telephone && <a href={`tel:${c.telephone}`} className="flex items-center gap-1 hover:text-gray-900"><Phone size={12} /> {c.telephone}</a>}
                  {c.ville && <span className="flex items-center gap-1"><MapPin size={12} /> {c.ville}</span>}
                </div>

                {c.details.length > 0 && (
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                    {c.details.map((d) => (
                      <div key={d.label}>
                        <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">{d.label}</dt>
                        <dd className="text-sm font-bold text-gray-900">{d.valeur}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {c.motivation && (
                  <p className="mt-3 border-l-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-700">{c.motivation}</p>
                )}
                {c.statut === "rejected" && c.motifRefus && (
                  <p className="mt-3 text-xs text-gray-500"><strong className="font-black text-gray-700">Motif du refus :</strong> {c.motifRefus}</p>
                )}

                {c.statut === "pending" && refus?.id === c.id && (
                  <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                    <label htmlFor={`motif-${c.id}`} className="block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                      Motif, envoyé au candidat
                    </label>
                    <textarea
                      id={`motif-${c.id}`}
                      rows={3}
                      maxLength={500}
                      value={refus.motif}
                      onChange={(e) => setRefus({ id: c.id, motif: e.target.value })}
                      placeholder={exempleMotif}
                      className="w-full resize-none border border-gray-200/70 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-900"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => decider(c, "reject", refus.motif)}
                        disabled={enCours === c.id || refus.motif.trim().length < 5}
                        className={BOUTON_DANGER}
                      >
                        {enCours === c.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                        Refuser avec ce motif
                      </button>
                      <button onClick={() => setRefus(null)} className={BOUTON_CONTOUR}>Annuler</button>
                    </div>
                  </div>
                )}
                {c.statut === "pending" && refus?.id !== c.id && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => decider(c, "approve")} disabled={enCours === c.id} className={BOUTON_PLEIN}>
                      {enCours === c.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      {accepter}
                    </button>
                    <button onClick={() => setRefus({ id: c.id, motif: "" })} disabled={enCours === c.id} className={BOUTON_CONTOUR}>
                      <X size={13} /> Refuser
                    </button>
                  </div>
                )}
              </Carte>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
