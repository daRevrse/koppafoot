"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone } from "lucide-react";
import { useAdminApi } from "@/hooks/useAdminApi";
import RecordActions from "@/components/admin/RecordActions";
import EffectifParPoste from "@/components/team/EffectifParPoste";
import MatchsDuClub from "@/components/team/MatchsDuClub";
import MiniEcusson from "@/components/match/MiniEcusson";
import { BOUTON_CONTOUR, Carte, Chargement, Chiffre, Erreur, Pastille, Titre, ilYA } from "@/components/admin/ui";
import type { FicheDuClub } from "@/lib/fiche-club-serveur";

// ============================================
// Une équipe, telle que l'administration doit la voir.
//
// La page plantait à l'ouverture (une date de création qui n'était pas une
// chaîne), et quand elle s'ouvrait, elle comptait autrement que la fiche
// publique. Elle lit maintenant LA MÊME FICHE que le public — effectif par
// poste, bilan, matchs amicaux et de compétition — et ajoute ce que seule
// l'administration doit voir : comment joindre le manager, et le compte
// derrière chaque joueur.
// ============================================

const NIVEAUX: Record<string, string> = {
  beginner: "Débutant", amateur: "Amateur", intermediate: "Intermédiaire", advanced: "Avancé",
};

interface Reponse {
  equipe: {
    id: string; nom: string; ville: string; niveau: string; logo: string | null; couleur: string | null;
    recrute: boolean; fantome: boolean; description: string; slogan: string; maxMembres: number; creeLe: string | null;
  };
  manager: { uid: string; nom: string; email: string | null; telephone: string | null } | null;
  fiche: FicheDuClub;
}

export default function AdminTeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, erreur, chargement, recharger } = useAdminApi<Reponse>(`/api/admin/equipes/${id}`);

  if (chargement) return <Chargement />;
  if (erreur || !data) return <Erreur message={erreur ?? "Équipe introuvable"} onReessayer={recharger} />;
  const { equipe: e, manager, fiche } = data;
  const b = fiche.bilan;
  const comptes = fiche.effectif.filter((j) => j.uid).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/teams" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900">
        <ArrowLeft size={13} /> Équipes
      </Link>

      <Carte className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <MiniEcusson nom={e.nom} logo={e.logo} taille={64} className="text-gray-400" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-black uppercase leading-tight tracking-tight text-gray-900">{e.nom}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {[e.ville, NIVEAUX[e.niveau], `créée ${ilYA(e.creeLe)}`].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {e.recrute && <Pastille ton="vert">Recrute</Pastille>}
              {e.fantome && <Pastille ton="ambre">Adversaire hors plateforme</Pastille>}
            </div>
            {e.slogan && <p className="mt-2 text-sm italic text-gray-500">« {e.slogan} »</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <Link href={`/teams/${e.id}`} className={BOUTON_CONTOUR}><ExternalLink size={13} /> Fiche publique</Link>
          <RecordActions
            variante="boutons"
            resource="team"
            id={e.id}
            label={e.nom}
            onDone={recharger}
            champs={[
              { cle: "name", label: "Nom" },
              { cle: "city", label: "Ville" },
              { cle: "slogan", label: "Slogan" },
              { cle: "description", label: "Description" },
              { cle: "max_members", label: "Effectif maximum", type: "nombre" },
              { cle: "level", label: "Niveau", type: "liste", options: Object.entries(NIVEAUX).map(([valeur, label]) => ({ valeur, label })) },
              { cle: "is_recruiting", label: "En recrutement", type: "booleen" },
            ]}
            valeurs={{
              name: e.nom, city: e.ville, slogan: e.slogan, description: e.description,
              max_members: e.maxMembres, level: e.niveau, is_recruiting: e.recrute,
            }}
          />
        </div>
      </Carte>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <section>
            <Titre compte={fiche.effectif.length}>Effectif</Titre>
            <p className="mb-2 text-xs text-gray-500">
              {comptes} avec un compte, {fiche.effectif.length - comptes} sans compte. Un nom mène à la fiche du compte.
            </p>
            <EffectifParPoste
              joueurs={fiche.effectif.map((j) => ({
                cle: j.id, nom: j.nom, numero: j.numero, poste: j.poste, photo: j.photo,
                lien: j.uid ? `/admin/users/${j.uid}` : null,
                apres: j.uid ? null : <Pastille>Sans compte</Pastille>,
              }))}
              staff={fiche.staff}
              vide="Aucun joueur dans l'effectif."
            />
          </section>
          <section>
            <Titre compte={fiche.matchs.length}>Matchs</Titre>
            <MatchsDuClub matchs={fiche.matchs} />
          </section>
        </div>

        <aside className="space-y-6">
          <section>
            <Titre>Manager</Titre>
            <Carte className="px-4 py-3">
              {manager ? (
                <>
                  <Link href={`/admin/users/${manager.uid}`} className="text-sm font-black text-gray-900 hover:text-emerald-700">{manager.nom}</Link>
                  {manager.email && <a href={`mailto:${manager.email}`} className="mt-1 flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"><Mail size={13} /> {manager.email}</a>}
                  {manager.telephone && <a href={`tel:${manager.telephone}`} className="mt-1 flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"><Phone size={13} /> {manager.telephone}</a>}
                </>
              ) : (
                <p className="text-sm text-gray-500">Aucun manager : le compte a été supprimé.</p>
              )}
            </Carte>
          </section>
          <section>
            <Titre>Bilan</Titre>
            <div className="grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70">
              <Chiffre valeur={b.joues} libelle="Joués" />
              <Chiffre valeur={b.gagnes} libelle="Gagnés" ton="text-emerald-700" />
              <Chiffre valeur={b.nuls} libelle="Nuls" />
              <Chiffre valeur={b.perdus} libelle="Perdus" ton="text-red-600" />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Buts {b.butsPour}–{b.butsContre}, amicaux et compétitions ensemble, comme sur la fiche publique.
            </p>
          </section>
          {fiche.competitions.length > 0 && (
            <section>
              <Titre compte={fiche.competitions.length}>Compétitions</Titre>
              <Carte className="divide-y divide-gray-200/70">
                {fiche.competitions.map((c) => (
                  <Link key={c.lienEquipe} href={c.lienEquipe} className="block px-4 py-2.5 hover:bg-gray-50">
                    <span className="block truncate text-sm font-bold text-gray-900">{c.nom}</span>
                    <span className="text-xs text-gray-500">
                      {[c.groupe ? `Groupe ${c.groupe}` : null, c.rang ? `${c.rang === 1 ? "1er" : `${c.rang}e`}` : null, c.points != null ? `${c.points} pts` : null].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                ))}
              </Carte>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
