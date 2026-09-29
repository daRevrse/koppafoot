"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminAction, useAdminApi } from "@/hooks/useAdminApi";
import {
  BOUTON_DANGER, BOUTON_PLEIN, Carte, Chargement, EnTete, Erreur, Pastille, Titre,
} from "@/components/admin/ui";

// ============================================
// Les administrateurs.
//
// CETTE PAGE ANNONÇAIT « 0 SUPERADMIN SUR LA PLATEFORME » à l'administrateur
// qui la lisait : elle les cherchait par `user_type == "superadmin"`, que le
// modèle actuel n'écrit plus (la casquette est un drapeau, voir lib/hats), et
// sa promotion par e-mail passait par une route qui refusait ce même
// administrateur. La liste vient maintenant du serveur, sur les deux signaux.
// ============================================

interface Admin {
  uid: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  herite: boolean;
  moi: boolean;
}

export default function AdminSettingsPage() {
  const { data, erreur, chargement, recharger } = useAdminApi<{ admins: Admin[] }>("/api/admin/admins");
  const agir = useAdminAction();
  const [email, setEmail] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);

  const promouvoir = async (e: React.FormEvent) => {
    e.preventDefault();
    const adresse = email.trim();
    if (!adresse) return;
    if (!window.confirm(`Donner l'accès complet à l'administration au compte ${adresse} ?`)) return;
    setEnCours("ajout");
    try {
      const r = await agir<{ message?: string }>("/api/admin/promote", "POST", { email: adresse, action: "promote", role: "superadmin" });
      toast.success(r.message ?? "Administrateur ajouté");
      setEmail("");
      recharger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'opération a échoué");
    } finally {
      setEnCours(null);
    }
  };

  const retirer = async (a: Admin) => {
    if (!window.confirm(`Retirer l'accès à l'administration de ${a.nom} ?`)) return;
    setEnCours(a.uid);
    try {
      await agir("/api/admin/promote", "POST", { uid: a.uid, action: "revoke", role: "superadmin" });
      toast.success(`${a.nom} n'est plus administrateur`);
      recharger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'opération a échoué");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <EnTete titre="Administrateurs" sousTitre="Les comptes qui ont la main sur cette administration." />

      <section>
        <Titre compte={data?.admins.length}>Administrateurs</Titre>
        {erreur && <Erreur message={erreur} onReessayer={recharger} />}
        {chargement ? <Chargement /> : (
          <Carte className="divide-y divide-gray-200/70">
            {(data?.admins ?? []).map((a) => (
              <div key={a.uid} className="flex items-center gap-3 px-4 py-3">
                <ShieldCheck size={18} className="shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/users/${a.uid}`} className="flex items-center gap-2 text-sm font-black text-gray-900 hover:text-emerald-700">
                    <span className="truncate">{a.nom}</span>
                    {a.moi && <Pastille ton="noir">Toi</Pastille>}
                    {a.herite && <Pastille ton="ambre" title="Ancien modèle : user_type « superadmin » sans le drapeau">Ancien modèle</Pastille>}
                  </Link>
                  <p className="truncate text-xs text-gray-500">{a.email ?? a.telephone ?? "Sans contact"}</p>
                </div>
                {!a.moi && (
                  <button onClick={() => retirer(a)} disabled={enCours !== null} className={BOUTON_DANGER}>
                    {enCours === a.uid && <Loader2 size={13} className="animate-spin" />}
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </Carte>
        )}
      </section>

      <section>
        <Titre>Ajouter un administrateur</Titre>
        <Carte className="p-4">
          <form onSubmit={promouvoir} className="flex flex-wrap gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail du compte"
              className="min-w-0 flex-1 border border-gray-200/70 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
            />
            <button type="submit" disabled={!email.trim() || enCours !== null} className={BOUTON_PLEIN}>
              {enCours === "ajout" && <Loader2 size={13} className="animate-spin" />}
              Donner l&apos;accès
            </button>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            Le compte doit déjà exister. Un administrateur lit et modifie toutes les données de la plateforme ;
            son rôle sur le terrain ne change pas. Depuis la fiche d&apos;un compte, on peut aussi l&apos;accorder à
            quelqu&apos;un qui s&apos;est inscrit par téléphone.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Le tout premier administrateur se crée en ligne de commande :{" "}
            <code className="bg-gray-100 px-1 py-0.5 text-gray-700">npx tsx scripts/promote-superadmin.ts e-mail</code>
          </p>
        </Carte>
      </section>
    </div>
  );
}
