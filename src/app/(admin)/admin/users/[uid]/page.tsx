"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Ban, ExternalLink, Loader2, Mail, Phone, Send } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminAction, useAdminApi } from "@/hooks/useAdminApi";
import ModaleSuspension from "@/components/admin/ModaleSuspension";
import RecordActions from "@/components/admin/RecordActions";
import {
  BOUTON_CONTOUR, BOUTON_DANGER, Carte, Chargement, Erreur, Pastille, Titre, ilYA,
} from "@/components/admin/ui";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import type { FicheCompteAdmin } from "@/lib/admin-types";

// ============================================
// La fiche d'un compte, pour l'administration.
//
// Tout ce qu'on décide d'un compte se décidait depuis une ligne de tableau :
// une fenêtre pour les casquettes, un panneau pour l'activité, une autre
// fenêtre pour corriger, un bouton rouge pour suspendre. On décidait sans voir.
// Ici, d'abord ce qu'il est et ce qu'il a fait ; puis ce qu'on peut lui
// accorder ou lui retirer, casquette par casquette, en sachant pourquoi.
//
// LE SCOREUR S'ACCORDE D'ICI AUSSI. Sa casquette ne s'obtenait que par
// candidature : un scoreur qu'on connaît, ou dont il faut la retirer après un
// abus, n'avait aucun autre chemin que la console Firebase.
// ============================================

const ROLES = { player: "Joueur", manager: "Manager", referee: "Arbitre" } as const;
const CANDIDATURES = { organisateur: "Organisateur", scoreur: "Scoreur", terrain: "Terrain" } as const;
const STATUTS: Record<string, { label: string; ton: "ambre" | "vert" | "rouge" }> = {
  pending: { label: "En attente", ton: "ambre" },
  approved: { label: "Acceptée", ton: "vert" },
  rejected: { label: "Refusée", ton: "rouge" },
};

type Casquette = "organizer" | "scorer" | "superadmin";

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 py-2 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-bold text-gray-900">{children}</span>
    </div>
  );
}

export default function FicheCompteAdminPage() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const { data: c, erreur, chargement, recharger } = useAdminApi<FicheCompteAdmin>(`/api/admin/comptes/${uid}`);
  const agir = useAdminAction();
  const [enCours, setEnCours] = useState<string | null>(null);
  // Vrai : suspendre (ou bloquer la connexion d'un compte déjà suspendu) ; faux : réactiver.
  const [suspension, setSuspension] = useState<boolean | null>(null);

  if (chargement) return <Chargement />;
  if (erreur || !c) return <Erreur message={erreur ?? "Compte introuvable"} onReessayer={recharger} />;

  const nom = `${c.prenom} ${c.nom}`.trim() || "Compte sans nom";
  const moi = user?.uid === c.uid;

  const casquette = async (role: Casquette, poser: boolean) => {
    const libelle = { organizer: "organisateur", scorer: "scoreur", superadmin: "administrateur" }[role];
    if (role === "superadmin" && poser && !window.confirm(
      `Donner l'accès complet à l'administration à ${nom} ?\n\nUn administrateur lit et modifie toutes les données de la plateforme.`,
    )) return;
    setEnCours(role);
    try {
      await agir("/api/admin/promote", "POST", { uid: c.uid, action: poser ? "promote" : "revoke", role });
      toast.success(poser ? `${nom} est ${libelle}` : `Casquette ${libelle} retirée`);
      recharger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'opération a échoué");
    } finally {
      setEnCours(null);
    }
  };

  const CASQUETTES: { role: Casquette; label: string; detail: string; pose: boolean }[] = [
    { role: "organizer", label: "Organisateur", detail: "Crée et gère ses compétitions.", pose: c.casquettes.organisateur },
    { role: "scorer", label: "Scoreur", detail: "Tient le score en direct des amicaux qu'il ne joue pas.", pose: c.casquettes.scoreur },
    { role: "superadmin", label: "Administrateur", detail: "Accès complet à cette administration.", pose: c.casquettes.admin },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900">
        <ArrowLeft size={13} /> Comptes
      </Link>

      <Carte className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <PlayerAvatar name={nom} photo={c.photo} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-black uppercase leading-tight tracking-tight text-gray-900">{nom}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {c.role ? (
                <Pastille ton={c.roleHerite ? "gris" : "vert"} title={c.roleHerite ? "Déclaré à l'inscription, jamais activé dans Évolution" : undefined}>
                  {ROLES[c.role]}{c.roleHerite ? " (hérité)" : ""}
                </Pastille>
              ) : <Pastille>Sans rôle</Pastille>}
              {c.casquettes.organisateur && <Pastille ton="bleu">Organisateur</Pastille>}
              {c.casquettes.scoreur && <Pastille ton="bleu">Scoreur</Pastille>}
              {c.casquettes.proprietaire && <Pastille ton="bleu">Terrains</Pastille>}
              {c.moderateur && <Pastille ton="bleu">Modérateur</Pastille>}
              {c.casquettes.admin && <Pastille ton="noir">Administrateur</Pastille>}
              {!c.actif && <Pastille ton="rouge">Suspendu</Pastille>}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-gray-900"><Mail size={13} /> {c.email}</a>}
              {c.telephone && <a href={`tel:${c.telephone}`} className="flex items-center gap-1.5 hover:text-gray-900"><Phone size={13} /> {c.telephone}</a>}
              <span>{c.ville ?? "Ville non renseignée"}</span>
              <span className="text-gray-400">Inscrit {ilYA(c.creeLe)}</span>
            </div>
            {c.bio && <p className="mt-2 text-sm italic text-gray-500">« {c.bio} »</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {(c.role || c.equipesJouees.length > 0) && (
            <Link href={`/profile/${c.uid}`} className={BOUTON_CONTOUR}><ExternalLink size={13} /> Sa page</Link>
          )}
          <Link href={`/admin/messages?uid=${c.uid}&nom=${encodeURIComponent(nom)}`} className={BOUTON_CONTOUR}>
            <Send size={13} /> Lui écrire
          </Link>
          <RecordActions
            variante="boutons"
            resource="user"
            id={c.uid}
            label={nom}
            onDone={recharger}
            champs={[
              { cle: "first_name", label: "Prénom" },
              { cle: "last_name", label: "Nom" },
              { cle: "location_city", label: "Ville" },
              { cle: "bio", label: "Bio" },
            ]}
            valeurs={{ first_name: c.prenom, last_name: c.nom, location_city: c.ville ?? "", bio: c.bio ?? "" }}
          />
          {!moi && (
            <button
              onClick={() => setSuspension(c.actif)}
              disabled={c.actif && c.casquettes.admin}
              title={c.actif && c.casquettes.admin ? "Retire d'abord l'accès à l'administration" : undefined}
              className={c.actif ? BOUTON_DANGER : BOUTON_CONTOUR}
            >
              {c.actif ? "Suspendre" : "Réactiver"}
            </button>
          )}
        </div>
      </Carte>

      {!c.actif && (
        <Carte className="border-l-4 border-l-red-600 p-4">
          <div className="flex items-start gap-3">
            <Ban size={18} className="mt-0.5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="font-black text-gray-900">
                Compte suspendu
                {c.suspension?.le && <span className="font-semibold text-gray-500">{` ${ilYA(c.suspension.le)}`}</span>}
                {c.suspension?.par && <span className="font-semibold text-gray-500">{` par ${c.suspension.par.nom}`}</span>}
              </p>
              {c.suspension?.motif && <p className="text-gray-600">Motif : {c.suspension.motif}</p>}
              <p className="text-gray-500">
                {c.connexionBloquee === true && "La connexion est bloquée, sur le site comme sur l'application."}
                {c.connexionBloquee === null && "Ce compte n'a pas d'identifiant de connexion."}
                {c.connexionBloquee === false && "Suspendu avant que la suspension ne bloque la connexion : ce compte peut encore se connecter."}
              </p>
              {c.connexionBloquee === false && (
                <button onClick={() => setSuspension(true)} className={`${BOUTON_DANGER} mt-2`}>Bloquer la connexion</button>
              )}
            </div>
          </div>
        </Carte>
      )}

      {suspension !== null && (
        <ModaleSuspension
          uid={c.uid}
          nom={nom}
          suspendre={suspension}
          onFermer={() => setSuspension(null)}
          onFait={recharger}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <Titre>Casquettes</Titre>
          <Carte className="divide-y divide-gray-200/70">
            {CASQUETTES.map((k) => {
              const verrou = moi && k.role === "superadmin";
              return (
                <div key={k.role} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-gray-900">{k.label}</p>
                    <p className="text-xs text-gray-500">{verrou ? "Tu ne peux pas retirer tes propres droits." : k.detail}</p>
                  </div>
                  <button
                    onClick={() => casquette(k.role, !k.pose)}
                    disabled={enCours !== null || verrou}
                    className={k.pose ? BOUTON_DANGER : BOUTON_CONTOUR}
                  >
                    {enCours === k.role && <Loader2 size={13} className="animate-spin" />}
                    {k.pose ? "Retirer" : "Accorder"}
                  </button>
                </div>
              );
            })}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-gray-900">Propriétaire de terrain</p>
                <p className="text-xs text-gray-500">S&apos;obtient en faisant publier un terrain (Terrains proposés).</p>
              </div>
              {c.casquettes.proprietaire ? <Pastille ton="vert">Oui</Pastille> : <Pastille>Non</Pastille>}
            </div>
          </Carte>
          {c.nomOrganisateur && (
            <p className="mt-2 text-xs text-gray-500">Organise sous le nom « {c.nomOrganisateur} ».</p>
          )}
        </section>

        <section>
          <Titre>Activité</Titre>
          <Carte className="px-4 py-2">
            <Ligne label="Matchs créés (manager)">{c.activite.matchsCrees}</Ligne>
            <Ligne label="Matchs arbitrés">{c.activite.matchsArbitres}</Ligne>
            <Ligne label="Désignations en attente">{c.activite.designationsEnAttente}</Ligne>
            <Ligne label="Note moyenne reçue">{c.activite.noteMoyenne ?? "–"}</Ligne>
            <Ligne label="Publications (Tribune)">{c.activite.publications}</Ligne>
            <Ligne label="Connexion">{c.fournisseurs.join(", ") || "–"}</Ligne>
          </Carte>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {[
          { titre: "Dirige", liste: c.equipesDirigees.map((e) => ({ cle: e.id, label: e.nom, href: `/admin/teams/${e.id}` })) },
          { titre: "Joue dans", liste: c.equipesJouees.map((e) => ({ cle: e.id, label: e.nom, href: `/admin/teams/${e.id}` })) },
          {
            titre: "Organise",
            liste: c.competitions.map((x) => ({ cle: x.id, label: `${x.nom}${x.publique ? "" : " (non publique)"}`, href: x.lien ?? "/admin/competitions" })),
          },
        ].map((bloc) => (
          <section key={bloc.titre}>
            <Titre compte={bloc.liste.length}>{bloc.titre}</Titre>
            {bloc.liste.length === 0 ? (
              <Carte className="px-4 py-3 text-sm text-gray-400">Rien.</Carte>
            ) : (
              <Carte className="divide-y divide-gray-200/70">
                {bloc.liste.map((x) => (
                  <Link key={x.cle} href={x.href} className="block truncate px-4 py-2.5 text-sm font-bold text-gray-900 hover:bg-gray-50">{x.label}</Link>
                ))}
              </Carte>
            )}
          </section>
        ))}
      </div>

      {c.candidatures.length > 0 && (
        <section>
          <Titre compte={c.candidatures.length}>Candidatures</Titre>
          <Carte className="divide-y divide-gray-200/70">
            {c.candidatures.map((x, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="text-sm font-black text-gray-900">{CANDIDATURES[x.genre]}</span>
                <Pastille ton={STATUTS[x.statut]?.ton ?? "ambre"}>{STATUTS[x.statut]?.label ?? x.statut}</Pastille>
                <span className="text-xs text-gray-400">{ilYA(x.le)}</span>
                {x.motifRefus && <span className="w-full text-xs text-gray-500">Motif : {x.motifRefus}</span>}
              </div>
            ))}
          </Carte>
        </section>
      )}
    </div>
  );
}
