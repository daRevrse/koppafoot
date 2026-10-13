"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  BOUTON_CONTOUR, BOUTON_VERT, Carte, Chargement, Chiffre, EnTete, Erreur, Pastille, Titre, Vide,
} from "@/components/admin/ui";

// ============================================
// Admin, les versements.
//
// CE QUE KOPPAFOOT DOIT. Les frais de réservation des terrains sont encaissés
// par KoppaFoot pour le compte des propriétaires : chaque réservation close
// laisse une somme due, au propriétaire le plus souvent, à l'équipe quand le
// propriétaire a annulé. Cette page dit à qui verser, combien, et sur quel
// numéro.
//
// LE VERSEMENT SE FAIT À LA MAIN, POUR L'INSTANT. Les dépôts FedaPay sont
// fermés sur le compte tant que leur support ne les a pas activés. On envoie
// l'argent par mobile money, puis on le marque ici : la somme ne peut l'être
// qu'une fois. Quand les dépôts seront automatiques, ce geste restera le
// filet d'un dépôt en échec.
//
// LES FONDS NE SONT PAS LIBRES TOUT DE SUITE. FedaPay les garde quelques
// jours après l'encaissement : chaque ligne dit depuis quand ils le sont.
// ============================================

interface Ligne {
  id: string;
  montant: number;
  motif: "acompte" | "remboursement";
  libelle: string;
  /** Pour un remboursement : le numéro mobile money où rendre ses frais à l'équipe. */
  telephone: string | null;
  disponible_le: string | null;
}

interface Groupe {
  beneficiaire: string;
  nom: string;
  numero: string | null;
  total: number;
  lignes: Ligne[];
}

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const numeroLisible = (n: string) => n.replace(/(\d{2})(?=\d)/g, "$1 ");

/** `maintenant` : l'heure à laquelle la liste a été lue, pas celle du rendu. */
function Liberation({ iso, maintenant }: { iso: string | null; maintenant: number }) {
  if (!iso) return <Pastille ton="gris">Libération inconnue</Pastille>;
  const libre = Date.parse(iso) <= maintenant;
  const jour = new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return <Pastille ton={libre ? "vert" : "ambre"}>{libre ? "Fonds libérés" : `Fonds libérés le ${jour}`}</Pastille>;
}

export default function AdminVersementsPage() {
  const { firebaseUser } = useAuth();
  const [donnees, setDonnees] = useState<{ tauxFrais: number; groupes: Groupe[]; luLe: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [taux, setTaux] = useState("");
  const [envoi, setEnvoi] = useState<string | null>(null);

  const appel = useCallback(async (method: string, corps?: unknown) => {
    if (!firebaseUser) throw new Error("Session expirée");
    const rep = await fetch("/api/admin/versements", {
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
      const d = (await appel("GET")) as { tauxFrais: number; groupes: Groupe[] };
      setDonnees({ ...d, luLe: Date.now() });
      setTaux(String(d.tauxFrais));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible");
    }
  }, [appel]);

  useEffect(() => { void charger(); }, [charger]);

  const enregistrerTaux = async () => {
    const valeur = Number(taux.replace(",", "."));
    if (taux.trim() === "" || !Number.isFinite(valeur) || valeur < 0 || valeur > 20) {
      toast.error("Un taux entre 0 et 20, par exemple 4.");
      return;
    }
    try {
      await appel("PUT", { tauxFrais: valeur });
      toast.success("Taux enregistré");
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    }
  };

  const marquer = async (g: Groupe) => {
    const numero = g.numero ?? g.lignes.find((l) => l.telephone)?.telephone ?? null;
    const ou = numero ? ` au ${numeroLisible(numero)}` : "";
    if (!window.confirm(`As-tu bien envoyé ${fcfa(g.total)} à ${g.nom}${ou} ? Ce geste ne s'annule pas.`)) return;
    setEnvoi(g.beneficiaire);
    try {
      const r = (await appel("POST", { ids: g.lignes.map((l) => l.id) })) as { regles: number; montant: number };
      toast.success(r.regles ? `${fcfa(r.montant)} marqués versés` : "Ces sommes étaient déjà versées");
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Le marquage a échoué");
    } finally {
      setEnvoi(null);
    }
  };

  if (erreur) return <Erreur message={erreur} onReessayer={charger} />;
  if (!donnees) return <Chargement />;

  const total = donnees.groupes.reduce((somme, g) => somme + g.total, 0);
  const tauxInchange = taux.trim() === String(donnees.tauxFrais);

  return (
    <div className="space-y-6">
      <EnTete
        titre="Versements"
        sousTitre="Les frais de réservation des terrains : ce que KoppaFoot doit, à qui, et sur quel numéro."
      />

      <div className="grid grid-cols-3 gap-px border border-gray-200/70 bg-gray-200/70">
        <Chiffre valeur={fcfa(total)} libelle="À verser" ton={total > 0 ? "text-amber-700" : "text-gray-400"} />
        <Chiffre valeur={donnees.groupes.length} libelle="Bénéficiaires" />
        <Chiffre valeur={`${donnees.tauxFrais} %`} libelle="Frais de paiement" />
      </div>

      <section>
        <Titre>Frais de paiement ajoutés à l&apos;équipe</Titre>
        <Carte className="space-y-3 px-4 py-4">
          <p className="text-sm text-gray-600">
            Chaque encaissement coûte des frais à FedaPay. Ce taux s&apos;ajoute à ce que l&apos;équipe paie pour ses
            frais de réservation, et lui est montré avant. {donnees.tauxFrais === 0 && (
              <strong>À 0 %, c&apos;est KoppaFoot qui supporte les frais de FedaPay.</strong>
            )}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">Taux, en %</span>
              <input
                inputMode="decimal"
                value={taux}
                onChange={(e) => setTaux(e.target.value)}
                className="w-32 border border-gray-200/70 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              />
            </label>
            <button onClick={() => void enregistrerTaux()} disabled={tauxInchange} className={BOUTON_VERT}>Enregistrer</button>
          </div>
        </Carte>
      </section>

      <section>
        <Titre compte={donnees.groupes.length}>Sommes dues</Titre>
        {donnees.groupes.length === 0 ? (
          <Vide titre="Rien à verser" texte="Une somme apparaît ici quand une réservation payée est jouée, manquée ou annulée." />
        ) : (
          <div className="space-y-3">
            {donnees.groupes.map((g) => (
              <Carte key={g.beneficiaire}>
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-gray-900">{g.nom}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {g.numero
                        ? `Mobile money : ${numeroLisible(g.numero)}`
                        : g.lignes.some((l) => l.telephone)
                          ? "À rendre à l'équipe, au numéro indiqué sur chaque ligne"
                          : "Aucun numéro connu : à lui demander"}
                    </p>
                  </div>
                  <span className="font-display text-lg font-black tabular-nums text-gray-900">{fcfa(g.total)}</span>
                  <button onClick={() => void marquer(g)} disabled={envoi !== null} className={BOUTON_CONTOUR}>
                    {envoi === g.beneficiaire && <Loader2 size={14} className="animate-spin" />}
                    Marquer versé
                  </button>
                </div>
                <div className="divide-y divide-gray-200/70 border-t border-gray-200/70">
                  {g.lignes.map((l) => (
                    <div key={l.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 text-gray-700">{l.libelle}</span>
                      {l.motif === "remboursement" && (
                        <Pastille ton="bleu">
                          À rendre à l&apos;équipe{l.telephone ? ` au ${numeroLisible(l.telephone)}` : ""}
                        </Pastille>
                      )}
                      <Liberation iso={l.disponible_le} maintenant={donnees.luLe} />
                      <span className="font-black tabular-nums text-gray-900">{fcfa(l.montant)}</span>
                    </div>
                  ))}
                </div>
              </Carte>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
