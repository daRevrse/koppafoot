"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  BOUTON_CONTOUR, BOUTON_VERT, Carte, Chargement, Chiffre, EnTete, Erreur, MenuActions, Modale, Pastille, Titre, Vide,
  type Ton,
} from "@/components/admin/ui";
import { LIMITES_GRATUIT, limitesEnVigueur, type CleLimite, type DroitOffre } from "@/lib/offre";
import { ID_FORMULES, PRIX_PLANCHER, libelleFormule, type IdFormule, type PrixOffre, type StatutPaiement } from "@/lib/paiement";

// ============================================
// Admin, l'offre.
//
// Quatre gestes :
//
// - FIXER LA DATE D'ENTRÉE EN VIGUEUR des limites de l'offre gratuite. Avant
//   elle, personne n'est limité. Les conditions d'utilisation promettent de
//   prévenir : la date se fixe donc à l'avance, et s'annonce.
// - FIXER LES PRIX du Pro. Une formule est en vente dès qu'elle a un prix ;
//   vider les deux ferme la vente sur-le-champ.
// - ACCORDER LE PRO (ou l'option sans pub) à la main, pour une durée, à qui
//   on veut le faire essayer : un organisateur, un gérant, un club.
// - SUIVRE LES PAIEMENTS, et revérifier celui d'un client qui dit avoir payé :
//   la relecture chez FedaPay accorde le Pro si le paiement a bien abouti,
//   et seulement dans ce cas.
// ============================================

interface VueDroit {
  actif: boolean;
  depuis: string;
  jusquAu: string | null;
  motif: string | null;
  source: string;
}

interface Compte {
  uid: string;
  nom: string;
  email: string | null;
  pro: VueDroit | null;
  sansPub: VueDroit | null;
}

interface VuePaiement {
  id: string;
  nom: string;
  email: string | null;
  /** `null` : des frais de réservation de terrain, pas une formule. */
  formule: IdFormule | null;
  montant: number;
  statut: StatutPaiement;
  environnement: "sandbox" | "live";
  fedapayStatut: string | null;
  mode: string | null;
  anomalie: string | null;
  echeanceApres: string | null;
  creeLe: string | null;
}

interface Donnees {
  jour: string;
  limitesDepuis: string | null;
  prix: PrixOffre;
  fedapay: { configure: boolean; environnement: "sandbox" | "live" };
  comptes: Compte[];
}

const STATUT_PAIEMENT: Record<StatutPaiement, { label: string; ton: Ton }> = {
  paye: { label: "Payé", ton: "vert" },
  en_attente: { label: "En attente", ton: "ambre" },
  echoue: { label: "Refusé", ton: "gris" },
  annule: { label: "Annulé", ton: "gris" },
  expire: { label: "Expiré", ton: "gris" },
};

/** Les prix rangés, tels qu'on les saisit : vide quand la formule n'est pas en vente. */
const versSaisie = (prix: Partial<PrixOffre>): Record<IdFormule, string> =>
  Object.fromEntries(ID_FORMULES.map((id) => [id, prix[id] == null ? "" : String(prix[id])])) as Record<IdFormule, string>;

const LIBELLE_LIMITE: Record<CleLimite, string> = {
  equipes: "Équipes gérées par un manager",
  terrains: "Terrains référencés par un gérant",
  competitions: "Compétitions en cours par organisateur (brouillons compris)",
  equipesParCompetition: "Équipes dans une compétition",
};

const DUREES = [
  { valeur: "1", label: "1 mois" },
  { valeur: "3", label: "3 mois" },
  { valeur: "6", label: "6 mois" },
  { valeur: "12", label: "1 an" },
  { valeur: "aucune", label: "Sans échéance" },
  { valeur: "date", label: "Jusqu'à une date précise" },
];

const ETIQUETTE = "mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-500";
const CHAMP = "w-full border border-gray-200/70 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";

function jourCourt(jour: string): string {
  const d = new Date(`${jour}T00:00:00`);
  return Number.isNaN(d.getTime()) ? jour : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** Dans `mois` mois, la veille : « 1 mois » à partir du 5 octobre court jusqu'au 4 novembre inclus. */
function echeance(mois: number, depuis: Date = new Date()): string {
  const d = new Date(depuis);
  d.setMonth(d.getMonth() + mois);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function PastilleDroit({ nom, droit }: { nom: string; droit: VueDroit | null }) {
  if (!droit) return null;
  if (!droit.actif) return <Pastille ton="gris">{nom} expiré</Pastille>;
  return (
    <Pastille ton={nom === "Pro" ? "vert" : "bleu"}>
      {nom} {droit.jusquAu ? `jusqu'au ${jourCourt(droit.jusquAu)}` : "sans échéance"}
    </Pastille>
  );
}

export default function AdminOffrePage() {
  const { firebaseUser } = useAuth();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [paiements, setPaiements] = useState<VuePaiement[]>([]);
  const [saisiePrix, setSaisiePrix] = useState<Record<IdFormule, string>>(() => versSaisie({}));
  const [revue, setRevue] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [accord, setAccord] = useState<{ compte: string; droit: DroitOffre; duree: string; date: string; motif: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const appel = useCallback(async (method: string, corps?: unknown, url = "/api/admin/offre") => {
    if (!firebaseUser) throw new Error("Session expirée");
    const rep = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}`, ...(corps ? { "Content-Type": "application/json" } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok) throw new Error(data.error ?? "Erreur serveur");
    return data;
  }, [firebaseUser]);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      const [d, p] = await Promise.all([
        appel("GET") as Promise<Donnees>,
        appel("GET", undefined, "/api/admin/paiements") as Promise<{ paiements: VuePaiement[] }>,
      ]);
      setDonnees(d);
      setDate(d.limitesDepuis ?? "");
      setSaisiePrix(versSaisie(d.prix));
      setPaiements(p.paiements);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible");
    }
  }, [appel]);

  useEffect(() => { void charger(); }, [charger]);

  const chiffres = useMemo(() => {
    const l = donnees?.comptes ?? [];
    return { pro: l.filter((c) => c.pro?.actif).length, sansPub: l.filter((c) => c.sansPub?.actif && !c.pro?.actif).length };
  }, [donnees]);

  const enregistrerDate = async (valeur: string | null) => {
    try {
      await appel("PUT", { limitesDepuis: valeur });
      toast.success(valeur ? "Date d'entrée en vigueur enregistrée" : "Limites suspendues");
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    }
  };

  const accorder = async () => {
    if (!accord) return;
    const jusquAu = accord.duree === "aucune" ? null : accord.duree === "date" ? accord.date : echeance(Number(accord.duree));
    if (accord.duree === "date" && !accord.date) {
      toast.error("Choisis la date d'échéance");
      return;
    }
    setEnvoi(true);
    try {
      await appel("POST", { compte: accord.compte, droit: accord.droit, jusquAu, motif: accord.motif });
      toast.success(accord.droit === "pro" ? "Pro accordé" : "Option sans pub accordée");
      setAccord(null);
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Accord impossible");
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (c: Compte, droit: DroitOffre) => {
    const quoi = droit === "pro" ? "le Pro" : "l'option sans pub";
    if (!window.confirm(`Retirer ${quoi} à ${c.nom} ? Ce qu'il a déjà créé reste en place.`)) return;
    try {
      await appel("DELETE", { uid: c.uid, droit });
      toast.success("Droit retiré");
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retrait impossible");
    }
  };

  const enregistrerPrix = async () => {
    const prix: Record<string, number | null> = {};
    for (const id of ID_FORMULES) {
      const brut = saisiePrix[id].trim();
      // Vérifié ici aussi : `Number("abc")` vaut NaN, que JSON écrit `null`,
      // et le serveur y lirait « pas en vente » sans rien dire.
      if (brut !== "" && (!/^\d+$/.test(brut) || Number(brut) < PRIX_PLANCHER)) {
        toast.error(`${libelleFormule(id)} : un nombre entier d'au moins ${PRIX_PLANCHER} FCFA, ou vide.`);
        return;
      }
      prix[id] = brut === "" ? null : Number(brut);
    }
    try {
      await appel("PUT", { prix });
      toast.success(Object.values(prix).some((p) => p !== null) ? "Prix enregistrés" : "Vente fermée");
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    }
  };

  const reverifier = async (id: string) => {
    setRevue(id);
    try {
      const etat = (await appel("POST", { id }, "/api/admin/paiements")) as { statut: StatutPaiement };
      toast.success(etat.statut === "paye" ? "Paiement confirmé, Pro accordé" : `Chez FedaPay : ${STATUT_PAIEMENT[etat.statut].label.toLowerCase()}`);
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Revérification impossible");
    } finally {
      setRevue(null);
    }
  };

  if (erreur) return <Erreur message={erreur} onReessayer={charger} />;
  if (!donnees) return <Chargement />;

  const enVigueur = limitesEnVigueur(donnees.limitesDepuis, donnees.jour);
  const joursAvant = date ? Math.round((Date.parse(date) - Date.parse(donnees.jour)) / 864e5) : null;
  const prixInchanges = ID_FORMULES.every((id) => saisiePrix[id].trim() === versSaisie(donnees.prix)[id]);

  return (
    <div className="space-y-6">
      <EnTete
        titre="Offre"
        sousTitre="Les limites de l'offre gratuite, les prix de KoppaFoot Pro, les comptes qui l'ont, et les paiements."
        actions={
          <button
            onClick={() => setAccord({ compte: "", droit: "pro", duree: "3", date: "", motif: "" })}
            className={BOUTON_VERT}
          >
            <Plus size={14} /> Accorder un droit
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-px border border-gray-200/70 bg-gray-200/70">
        <Chiffre valeur={chiffres.pro} libelle="Comptes Pro actifs" />
        <Chiffre valeur={chiffres.sansPub} libelle="Sans pub seul" />
        <Chiffre
          valeur={enVigueur ? "Oui" : "Non"}
          libelle="Limites en vigueur"
          ton={enVigueur ? "text-emerald-700" : "text-gray-400"}
        />
      </div>

      <section>
        <Titre>Limites de l&apos;offre gratuite</Titre>
        <Carte className="divide-y divide-gray-200/70">
          {(Object.keys(LIMITES_GRATUIT) as CleLimite[]).map((cle) => (
            <div key={cle} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
              <span className="text-gray-700">{LIBELLE_LIMITE[cle]}</span>
              <span className="font-display text-lg font-black tabular-nums text-gray-900">{LIMITES_GRATUIT[cle]}</span>
            </div>
          ))}
          <div className="space-y-3 px-4 py-4">
            <p className="text-sm text-gray-600">
              {donnees.limitesDepuis
                ? enVigueur
                  ? <>En vigueur depuis le <strong>{jourCourt(donnees.limitesDepuis)}</strong>.</>
                  : <>En vigueur à partir du <strong>{jourCourt(donnees.limitesDepuis)}</strong>. D&apos;ici là, personne n&apos;est limité.</>
                : <>Pas encore en vigueur : personne n&apos;est limité.</>}
              {" "}Une limite ne retire jamais rien : elle empêche seulement de créer au-delà, et une compétition née
              avant cette date n&apos;est jamais plafonnée.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label>
                <span className={ETIQUETTE}>Entrée en vigueur</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP} />
              </label>
              <button
                onClick={() => void enregistrerDate(date || null)}
                disabled={date === (donnees.limitesDepuis ?? "")}
                className={BOUTON_VERT}
              >
                Enregistrer
              </button>
              {donnees.limitesDepuis && (
                <button onClick={() => void enregistrerDate(null)} className={BOUTON_CONTOUR}>Suspendre les limites</button>
              )}
            </div>
            {joursAvant !== null && joursAvant < 30 && date !== (donnees.limitesDepuis ?? "") && (
              <p className="text-xs font-semibold text-amber-700">
                Moins de 30 jours de préavis : les conditions d&apos;utilisation promettent d&apos;annoncer les options
                payantes à l&apos;avance. Préviens les comptes concernés avant cette date.
              </p>
            )}
          </div>
        </Carte>
      </section>

      <section>
        <Titre>Vente de KoppaFoot Pro</Titre>
        <Carte className="space-y-3 px-4 py-4">
          <p className="text-sm text-gray-600">
            {!donnees.fedapay.configure
              ? <>La clé FedaPay n&apos;est pas configurée : rien n&apos;est en vente, quels que soient les prix.</>
              : donnees.fedapay.environnement === "live"
                ? <>Une formule est en vente dès qu&apos;elle a un prix. Vide les deux pour fermer la vente.</>
                : <><strong>Bac à sable.</strong> Seuls les administrateurs voient les formules, et l&apos;argent est fictif.</>}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            {ID_FORMULES.map((id) => (
              <label key={id}>
                <span className={ETIQUETTE}>{libelleFormule(id)} (FCFA)</span>
                <input
                  inputMode="numeric"
                  value={saisiePrix[id]}
                  onChange={(e) => setSaisiePrix({ ...saisiePrix, [id]: e.target.value })}
                  placeholder="Pas en vente"
                  className={CHAMP}
                />
              </label>
            ))}
            <button onClick={() => void enregistrerPrix()} disabled={prixInchanges} className={BOUTON_VERT}>
              Enregistrer
            </button>
          </div>
        </Carte>
      </section>

      <section>
        <Titre compte={donnees.comptes.length}>Comptes avec un droit</Titre>
        {donnees.comptes.length === 0 ? (
          <Vide titre="Personne pour l'instant" texte="Accorde le Pro à un organisateur ou un gérant pour le lui faire essayer." />
        ) : (
          <Carte className="divide-y divide-gray-200/70">
            {donnees.comptes.map((c) => (
              <div key={c.uid} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-gray-900">{c.nom}</span>
                    <PastilleDroit nom="Pro" droit={c.pro} />
                    <PastilleDroit nom="Sans pub" droit={c.sansPub} />
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {c.email ?? c.uid}
                    {(c.pro?.motif || c.sansPub?.motif) && <> · {c.pro?.motif ?? c.sansPub?.motif}</>}
                  </p>
                </div>
                <MenuActions
                  actions={[
                    { label: "Prolonger ou modifier", onClick: () => setAccord({
                      compte: c.email ?? c.uid, droit: c.pro ? "pro" : "sans_pub", duree: "3", date: "", motif: c.pro?.motif ?? c.sansPub?.motif ?? "",
                    }) },
                    ...(c.pro ? [{ label: "Retirer le Pro", onClick: () => void retirer(c, "pro"), danger: true }] : []),
                    ...(c.sansPub ? [{ label: "Retirer l'option sans pub", onClick: () => void retirer(c, "sans_pub"), danger: true }] : []),
                  ]}
                />
              </div>
            ))}
          </Carte>
        )}
      </section>

      <section>
        <Titre compte={paiements.length}>Paiements</Titre>
        {paiements.length === 0 ? (
          <Vide titre="Aucun paiement" texte="Les achats du Pro apparaîtront ici, du plus récent au plus ancien." />
        ) : (
          <Carte className="divide-y divide-gray-200/70">
            {paiements.map((p) => {
              const rembourse = p.statut === "paye" && (p.fedapayStatut ?? "").includes("refunded");
              const sansEffet = p.statut === "paye" && !p.echeanceApres;
              const revoir = p.statut !== "paye" && p.environnement === donnees.fedapay.environnement;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-gray-900">{p.nom}</span>
                      <Pastille ton={STATUT_PAIEMENT[p.statut].ton}>{STATUT_PAIEMENT[p.statut].label}</Pastille>
                      {p.environnement === "sandbox" && <Pastille ton="bleu">Bac à sable</Pastille>}
                      {p.anomalie && <Pastille ton="rouge">Écart : {p.anomalie}</Pastille>}
                      {rembourse && <Pastille ton="rouge">Remboursé chez FedaPay</Pastille>}
                      {sansEffet && <Pastille ton="rouge" title="Le compte avait déjà un Pro sans échéance : à rembourser.">Payé sans effet</Pastille>}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {p.formule ? libelleFormule(p.formule) : "Frais de réservation"} · {p.montant.toLocaleString("fr-FR")} FCFA
                      {p.mode && <> · {p.mode}</>}
                      {p.creeLe && <> · {new Date(p.creeLe).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</>}
                      {p.echeanceApres && <> · Pro jusqu&apos;au {jourCourt(p.echeanceApres)}</>}
                      {" "}· {p.email ?? p.id}
                    </p>
                  </div>
                  {revoir && (
                    <button onClick={() => void reverifier(p.id)} disabled={revue !== null} className={BOUTON_CONTOUR}>
                      {revue === p.id && <Loader2 size={14} className="animate-spin" />}
                      Revérifier
                    </button>
                  )}
                </div>
              );
            })}
          </Carte>
        )}
      </section>

      {accord && (
        <Modale titre="Accorder un droit" onFermer={() => setAccord(null)} largeur="max-w-md">
          <div className="space-y-4">
            <label className="block">
              <span className={ETIQUETTE}>Compte</span>
              <input value={accord.compte} onChange={(e) => setAccord({ ...accord, compte: e.target.value })}
                placeholder="E-mail ou identifiant du compte" className={CHAMP} />
            </label>
            <div>
              <span className={ETIQUETTE}>Droit</span>
              <div className="space-y-1.5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={accord.droit === "pro"} onChange={() => setAccord({ ...accord, droit: "pro" })} />
                  KoppaFoot Pro (lève les limites, comprend le sans pub)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={accord.droit === "sans_pub"} onChange={() => setAccord({ ...accord, droit: "sans_pub" })} />
                  Option sans pub seule
                </label>
              </div>
            </div>
            <label className="block">
              <span className={ETIQUETTE}>Durée</span>
              <select value={accord.duree} onChange={(e) => setAccord({ ...accord, duree: e.target.value })} className={CHAMP}>
                {DUREES.map((d) => <option key={d.valeur} value={d.valeur}>{d.label}</option>)}
              </select>
            </label>
            {accord.duree === "date" && (
              <label className="block">
                <span className={ETIQUETTE}>Jusqu&apos;au (inclus)</span>
                <input type="date" value={accord.date} onChange={(e) => setAccord({ ...accord, date: e.target.value })} className={CHAMP} />
              </label>
            )}
            {accord.duree !== "aucune" && accord.duree !== "date" && (
              <p className="text-xs text-gray-500">Jusqu&apos;au {jourCourt(echeance(Number(accord.duree)))} inclus.</p>
            )}
            <label className="block">
              <span className={ETIQUETTE}>Motif (facultatif)</span>
              <input value={accord.motif} onChange={(e) => setAccord({ ...accord, motif: e.target.value })} maxLength={140}
                placeholder="Testeur, Coupe de Bè" className={CHAMP} />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setAccord(null)} className={BOUTON_CONTOUR}>Annuler</button>
            <button onClick={() => void accorder()} disabled={envoi || !accord.compte.trim()} className={BOUTON_VERT}>
              {envoi && <Loader2 size={14} className="animate-spin" />}
              Accorder
            </button>
          </div>
        </Modale>
      )}
    </div>
  );
}
