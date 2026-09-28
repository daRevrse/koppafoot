"use client";

import Link from "next/link";
import { ChevronRight, RefreshCw } from "lucide-react";
import { useAdminApi } from "@/hooks/useAdminApi";
import { useATraiter } from "@/components/admin/ATraiterContext";
import LigneMatch from "@/components/admin/LigneMatch";
import {
  BOUTON_CONTOUR, Carte, Chargement, Chiffre, EnTete, Erreur, Pastille, Titre, ilYA,
} from "@/components/admin/ui";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import { totalATraiter, type ATraiter } from "@/lib/admin-tableau";
import type { TableauDeBord } from "@/lib/admin-types";

// ============================================
// Le tableau de bord : ce qui attend, puis ce qui existe.
//
// IL MONTRAIT DES RÉPARTITIONS ET PAS DE TRAVAIL. Trois candidatures, un
// signalement et deux retours attendaient ; l'écran d'accueil affichait une
// barre de « rôles » à zéro partout et un bandeau « tous les systèmes
// fonctionnent normalement » que rien ne vérifiait. On ouvre maintenant sur
// ce qui demande une décision, chaque ligne menant à la page qui la prend ;
// les chiffres viennent après, comptés comme le produit compte (rôle effectif,
// matchs terminés, amicaux et compétitions ensemble).
// ============================================

const A_TRAITER: { cle: keyof ATraiter; label: string; href: string; detail: string }[] = [
  { cle: "organisateurs", label: "Candidatures organisateur", href: "/admin/organizers", detail: "Ouvrir un espace organisateur" },
  { cle: "scoreurs", label: "Candidatures scoreur", href: "/admin/scorers", detail: "Couvrir les amicaux en direct" },
  { cle: "terrains", label: "Terrains proposés", href: "/admin/terrains", detail: "Publier une fiche de terrain" },
  { cle: "contestations", label: "Amicaux contestés", href: "/admin/contestations", detail: "Deux camps en désaccord" },
  { cle: "signalements", label: "Signalements", href: "/admin/signalements", detail: "Publications de la Tribune" },
  { cle: "retours", label: "Retours d'utilisateurs", href: "/admin/retours", detail: "Non traités" },
  { cle: "competitions", label: "Compétitions à rendre publiques", href: "/admin/competitions", detail: "Publiées par leur organisateur" },
];

const ROLES = { player: "Joueur", manager: "Manager", referee: "Arbitre" } as const;

export default function AdminDashboard() {
  const { data, erreur, chargement, recharger } = useAdminApi<TableauDeBord>("/api/admin/tableau");
  const { aTraiter: compteurs, charge, rafraichir } = useATraiter();
  // Le compte du menu est relu à chaque page : il fait foi dès qu'il est lu.
  const aTraiter = charge ? compteurs : data?.aTraiter ?? compteurs;
  const total = totalATraiter(aTraiter);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <EnTete
        titre="Tableau de bord"
        sousTitre={data ? `Compté ${ilYA(data.calculeLe)}.` : "Ce qui attend une décision, puis l'état de la plateforme."}
        actions={
          <button onClick={() => { recharger(); rafraichir(); }} className={BOUTON_CONTOUR}>
            <RefreshCw size={13} /> Recompter
          </button>
        }
      />

      <section>
        <Titre compte={total}>À traiter</Titre>
        {total === 0 ? (
          <Carte className="px-4 py-5 text-sm font-semibold text-gray-500">
            Rien n&apos;attend de décision. Les candidatures, signalements, retours et contestations s&apos;afficheront ici.
          </Carte>
        ) : (
          <Carte className="divide-y divide-gray-200/70">
            {A_TRAITER.filter((a) => aTraiter[a.cle] > 0).map((a) => (
              <Link key={a.cle} href={a.href} className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-50">
                <span className="w-10 shrink-0 font-display text-2xl font-black tabular-nums text-amber-600">{aTraiter[a.cle]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-gray-900">{a.label}</span>
                  <span className="block text-xs text-gray-500">{a.detail}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </Carte>
        )}
      </section>

      {erreur && <Erreur message={erreur} onReessayer={recharger} />}
      {chargement ? (
        <Chargement />
      ) : data && (
        <>
          <section>
            <Titre>La plateforme</Titre>
            <div className="grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-3 lg:grid-cols-6">
              <Chiffre
                valeur={data.comptes.total}
                libelle="Comptes"
                detail={`+${data.comptes.nouveaux7j} en 7 jours`}
                href="/admin/users"
              />
              <Chiffre valeur={data.equipes} libelle="Équipes" href="/admin/teams" />
              <Chiffre
                valeur={data.matchs.joues}
                libelle="Matchs joués"
                detail={`${data.matchs.joues7j} cette semaine`}
                href="/admin/matches"
              />
              <Chiffre
                valeur={data.matchs.aVenir}
                libelle="À venir"
                detail={data.matchs.enDirect > 0 ? `${data.matchs.enDirect} en direct` : undefined}
                href="/admin/matches"
              />
              <Chiffre
                valeur={data.competitions.total}
                libelle="Compétitions"
                detail={`${data.competitions.enCours} en cours`}
                href="/admin/competitions"
              />
              <Chiffre valeur={data.terrains} libelle="Terrains" href="/admin/venues" />
            </div>
          </section>

          <section>
            <Titre>Les comptes</Titre>
            <Carte className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Joueurs", n: data.comptes.joueurs },
                { label: "Managers", n: data.comptes.managers },
                { label: "Arbitres", n: data.comptes.arbitres },
                { label: "Sans rôle", n: data.comptes.sansRole, note: "Ne voient que les scores" },
                { label: "Organisateurs", n: data.comptes.organisateurs },
                { label: "Scoreurs", n: data.comptes.scoreurs },
                { label: "Propriétaires de terrain", n: data.comptes.proprietaires },
                { label: "Suspendus", n: data.comptes.suspendus },
              ].map((l) => (
                <div key={l.label} className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-2">
                  <span className="text-sm font-semibold text-gray-600">
                    {l.label}
                    {l.note && <span className="block text-[11px] font-medium text-gray-400">{l.note}</span>}
                  </span>
                  <span className="font-display text-lg font-black tabular-nums text-gray-900">{l.n}</span>
                </div>
              ))}
            </Carte>
            {data.comptes.rolesHerites > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {`Dont ${data.comptes.rolesHerites} au rôle déclaré à l'inscription mais jamais activé : le produit ne leur ouvre pas leur espace.`}
              </p>
            )}
          </section>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section className="min-w-0">
              <Titre action={<Link href="/admin/matches" className="text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900">Tous</Link>}>
                Aujourd&apos;hui et derniers joués
              </Titre>
              {data.derniersMatchs.length === 0 ? (
                <Carte className="px-4 py-5 text-sm text-gray-500">Aucun match joué pour l&apos;instant.</Carte>
              ) : (
                <Carte>{data.derniersMatchs.map((m) => <LigneMatch key={m.cle} m={m} />)}</Carte>
              )}
            </section>

            <section className="min-w-0">
              <Titre action={<Link href="/admin/users" className="text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900">Tous</Link>}>
                Dernières inscriptions
              </Titre>
              <Carte className="divide-y divide-gray-200/70">
                {data.derniersComptes.map((c) => (
                  <Link key={c.uid} href={`/admin/users/${c.uid}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50">
                    <PlayerAvatar name={c.nom} photo={c.photo} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-gray-900">{c.nom}</span>
                      <span className="block truncate text-xs text-gray-500">{c.ville ?? "Ville non renseignée"}</span>
                    </span>
                    {c.role ? <Pastille ton="vert">{ROLES[c.role]}</Pastille> : <Pastille>Sans rôle</Pastille>}
                    <span className="w-16 shrink-0 text-right text-[11px] text-gray-400">{ilYA(c.creeLe)}</span>
                  </Link>
                ))}
              </Carte>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
