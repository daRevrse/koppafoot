"use client";

import Link from "next/link";
import { useAdminApi } from "@/hooks/useAdminApi";
import { Carte, Chargement, Chiffre, EnTete, Erreur, Titre, ilYA } from "@/components/admin/ui";
import type { TableauDeBord } from "@/lib/admin-types";

// ============================================
// Les statistiques de la plateforme.
//
// Mêmes chiffres que le tableau de bord, détaillés, et comptés au même
// endroit (lib/admin-serveur) : cette page comptait les comptes par
// `user_type` et affichait « 0J / 0M / 0A », un « taux de complétion » qui
// divisait les matchs terminés par tous les amicaux jamais créés, défis refusés
// compris, et ignorait les compétitions.
// ============================================

function Barre({ label, valeur, max }: { label: string; valeur: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-sm font-semibold text-gray-700">{label}</span>
      <span className="h-2 flex-1 bg-gray-100">
        <span className="block h-full bg-gray-900" style={{ width: `${max > 0 ? (valeur / max) * 100 : 0}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right text-sm font-black tabular-nums text-gray-900">{valeur}</span>
    </div>
  );
}

export default function AdminStatsPage() {
  const { data, erreur, chargement, recharger } = useAdminApi<TableauDeBord>("/api/admin/tableau");

  if (chargement) return <Chargement />;
  if (erreur || !data) return <Erreur message={erreur ?? "Lecture impossible"} onReessayer={recharger} />;
  const c = data.comptes;
  const m = data.matchs;
  const roles = [
    { label: "Joueurs", n: c.joueurs },
    { label: "Managers", n: c.managers },
    { label: "Arbitres", n: c.arbitres },
    { label: "Sans rôle", n: c.sansRole },
  ];
  const maxVille = data.villes[0]?.comptes ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <EnTete titre="Statistiques" sousTitre={`Compté ${ilYA(data.calculeLe)}.`} />

      <section>
        <Titre>Croissance</Titre>
        <div className="grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-4">
          <Chiffre valeur={c.total} libelle="Comptes" />
          <Chiffre valeur={`+${c.nouveaux7j}`} libelle="Sur 7 jours" />
          <Chiffre valeur={`+${c.nouveaux30j}`} libelle="Sur 30 jours" />
          <Chiffre valeur={data.equipes} libelle="Équipes" />
        </div>
      </section>

      <section>
        <Titre>Matchs</Titre>
        <div className="grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-4">
          <Chiffre valeur={m.joues} libelle="Joués" detail={`${m.amicauxJoues} amicaux, ${m.competitionJoues} en compétition`} />
          <Chiffre valeur={m.joues7j} libelle="Joués cette semaine" />
          <Chiffre valeur={m.aVenir} libelle="À venir" />
          <Chiffre valeur={data.competitions.enCours} libelle="Compétitions en cours" detail={`sur ${data.competitions.total}`} />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <Titre>Rôles</Titre>
          <Carte className="space-y-3 p-4">
            {roles.map((r) => <Barre key={r.label} label={r.label} valeur={r.n} max={c.total} />)}
            <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">
              Le rôle activé dans Évolution, ou à défaut celui déclaré à l&apos;inscription.
              {c.rolesHerites > 0 && ` ${c.rolesHerites} ne l'ont jamais activé : leur espace ne leur est pas ouvert.`}
            </p>
          </Carte>
        </section>
        <section>
          <Titre>Casquettes</Titre>
          <Carte className="space-y-3 p-4">
            <Barre label="Organisateurs" valeur={c.organisateurs} max={c.total} />
            <Barre label="Scoreurs" valeur={c.scoreurs} max={c.total} />
            <Barre label="Propriétaires" valeur={c.proprietaires} max={c.total} />
            <Barre label="Administrateurs" valeur={c.admins} max={c.total} />
            <Barre label="Suspendus" valeur={c.suspendus} max={c.total} />
          </Carte>
        </section>
      </div>

      <section>
        <Titre>Managers et équipes</Titre>
        <div className="grid grid-cols-3 gap-px border border-gray-200/70 bg-gray-200/70">
          <Chiffre valeur={data.managers.une} libelle="Gèrent 1 équipe" />
          <Chiffre valeur={data.managers.deux} libelle="Gèrent 2 équipes" />
          <Chiffre
            valeur={data.managers.troisEtPlus}
            libelle="Gèrent 3 équipes ou plus"
            ton={data.managers.troisEtPlus > 0 ? "text-emerald-700" : "text-gray-900"}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          La cible du Club multi-équipes : une structure à plusieurs équipes (seniors, jeunes, féminines). Au-delà de 2 équipes,
          l&apos;offre gratuite ne permet plus d&apos;en créer.
        </p>
        {data.managers.plusGrands.length > 0 && (
          <Carte className="mt-3 divide-y divide-gray-100">
            {data.managers.plusGrands.map((m) => (
              <Link
                key={m.uid}
                href={`/admin/users/${m.uid}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50"
              >
                <span className="truncate font-semibold text-gray-800">{m.nom}</span>
                <span className="shrink-0 font-black tabular-nums text-gray-900">{m.equipes} équipes</span>
              </Link>
            ))}
          </Carte>
        )}
      </section>

      <section>
        <Titre>Villes</Titre>
        <Carte className="space-y-3 p-4">
          {data.villes.length === 0
            ? <p className="text-sm text-gray-500">Aucune ville renseignée.</p>
            : data.villes.map((v) => <Barre key={v.ville} label={v.ville} valeur={v.comptes} max={maxVille} />)}
        </Carte>
      </section>
    </div>
  );
}
