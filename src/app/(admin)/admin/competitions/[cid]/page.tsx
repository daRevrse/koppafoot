"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, EyeOff, Loader2, Mail, Phone, Settings } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminApi } from "@/hooks/useAdminApi";
import { setCompetitionValidated } from "@/lib/admin-firestore";
import { useATraiter } from "@/components/admin/ATraiterContext";
import MiniEcusson from "@/components/match/MiniEcusson";
import {
  BOUTON_CONTOUR, BOUTON_VERT, Carte, Chargement, Chiffre, Erreur, Pastille, Titre, dateDeMatch, ilYA, type Ton,
} from "@/components/admin/ui";
import { LIBELLES_CATEGORIE } from "@/lib/genre";
import { FOOT } from "@/i18n/foot";
import type { Competition, CompMatchRound } from "@/types";

// ============================================
// Une compétition, telle que l'administration doit la voir.
//
// La liste ne menait qu'à la page publique : on y voyait ce que voit un
// supporter, rien de ce qu'il faut pour décider de la valider ou pour aider
// son organisateur. Ici : qui la tient et comment le joindre, son format,
// ses équipes (et le manager de chacune), les inscriptions en attente, le
// calendrier — et le bouton de validation, à côté de ce qui la justifie.
// ============================================

interface CompteVu { uid: string; nom: string; email: string | null; telephone: string | null }

interface Reponse {
  competition: Competition;
  creeLe: string | null;
  organisateurs: CompteVu[];
  moderateurs: CompteVu[];
  equipes: {
    id: string; nom: string; logo: string | null; groupe: string | null; joueurs: number;
    disqualifiee: boolean; club: string | null; manager: CompteVu | null;
  }[];
  inscriptions: {
    id: string; club: string; clubId: string; ville: string; statut: string;
    frais: number | null; fraisStatut: string; manager: CompteVu | null; creeLe: string | null;
  }[];
  matchs: {
    id: string; date: string | null; heure: string | null; statut: string; phase: string;
    groupe: string | null; tour: CompMatchRound | null; domicile: string; exterieur: string;
    scoreDomicile: number | null; scoreExterieur: number | null; terrain: string | null;
  }[];
}

const STATUTS: Record<string, { label: string; ton: Ton }> = {
  draft: { label: "Brouillon", ton: "gris" },
  registration: { label: "Inscriptions", ton: "bleu" },
  group_stage: { label: "Phase de groupes", ton: "vert" },
  knockout: { label: "Phase finale", ton: "vert" },
  completed: { label: "Terminée", ton: "gris" },
};

const TYPES: Record<string, string> = {
  groups_knockout: "Poules puis phase finale",
  cup: "Coupe (élimination directe)",
  league: "Championnat",
  league_playoffs: "Championnat puis play-offs",
};

const INSCRIPTIONS: Record<string, { label: string; ton: Ton }> = {
  pending: { label: "En attente", ton: "ambre" },
  accepted: { label: "Acceptée", ton: "vert" },
  rejected: { label: "Refusée", ton: "rouge" },
  removed: { label: "Retirée", ton: "gris" },
};

const STATUTS_MATCH: Record<string, string> = {
  scheduled: "Programmé", live: "En direct", completed: "Terminé", cancelled: "Annulé", postponed: "Reporté",
};

function Contact({ c }: { c: CompteVu }) {
  return (
    <div className="px-4 py-3">
      <Link href={`/admin/users/${c.uid}`} className="text-sm font-black text-gray-900 hover:text-emerald-700">{c.nom}</Link>
      {c.email && <a href={`mailto:${c.email}`} className="mt-1 flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"><Mail size={13} /> {c.email}</a>}
      {c.telephone && <a href={`tel:${c.telephone}`} className="mt-1 flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"><Phone size={13} /> {c.telephone}</a>}
    </div>
  );
}

export default function AdminCompetitionDetailPage() {
  const { cid } = useParams<{ cid: string }>();
  const { data, erreur, chargement, recharger } = useAdminApi<Reponse>(`/api/admin/competitions/${cid}`);
  const { rafraichir } = useATraiter();
  const [enCours, setEnCours] = useState(false);

  if (chargement) return <Chargement />;
  if (erreur || !data) return <Erreur message={erreur ?? "Compétition introuvable"} onReessayer={recharger} />;
  const { competition: c, organisateurs, moderateurs, equipes, inscriptions, matchs } = data;
  const st = STATUTS[c.status] ?? { label: c.status, ton: "gris" as const };
  const aValider = !c.isValidated && c.status !== "draft";
  const f = c.format;
  const enAttente = inscriptions.filter((i) => i.statut === "pending");
  const joues = matchs.filter((m) => m.statut === "completed").length;
  const enDirect = matchs.filter((m) => m.statut === "live").length;
  const programmes = matchs.filter((m) => m.date && m.statut !== "completed" && m.statut !== "cancelled").length;

  const basculer = async () => {
    const versValide = !c.isValidated;
    if (!versValide && !window.confirm(
      `Retirer « ${c.name} » du public ?\n\nElle disparaîtra du Direct, de l'annuaire et des liens partagés. Son organisateur la garde intacte.`,
    )) return;
    setEnCours(true);
    try {
      await setCompetitionValidated(c.id, versValide);
      toast.success(versValide ? `« ${c.name} » est validée` : `« ${c.name} » retirée du public`);
      rafraichir();
      recharger();
    } catch {
      toast.error("L'opération a échoué");
    } finally {
      setEnCours(false);
    }
  };

  const format = [
    TYPES[c.competitionType] ?? c.competitionType,
    f.team_size ? `${f.team_size} contre ${f.team_size}` : null,
    f.half_duration ? `2 × ${f.half_duration} min` : null,
    c.competitionType === "groups_knockout" || c.competitionType === "league" || c.competitionType === "league_playoffs"
      ? `${f.group_count} poule${f.group_count > 1 ? "s" : ""} de ${f.teams_per_group}`
      : null,
    c.competitionType === "groups_knockout" ? `${f.qualifiers_per_group} qualifié${f.qualifiers_per_group > 1 ? "s" : ""} par poule` : null,
    f.double_round ? "aller-retour" : null,
    f.has_third_place ? "petite finale" : null,
    `${f.points.win}-${f.points.draw}-${f.points.loss} pts`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/competitions" className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900">
        <ArrowLeft size={13} /> Compétitions
      </Link>

      <Carte className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <MiniEcusson nom={c.name} logo={c.logoUrl} taille={64} className="text-gray-400" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-black uppercase leading-tight tracking-tight text-gray-900">{c.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {[
                c.organizerName,
                c.venueCity,
                c.startDate ? `du ${dateDeMatch(c.startDate.slice(0, 10))}` : null,
                c.endDate ? `au ${dateDeMatch(c.endDate.slice(0, 10))}` : null,
                `créée ${ilYA(data.creeLe)}`,
              ].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pastille ton={st.ton}>{st.label}</Pastille>
              {aValider && <Pastille ton="ambre">À valider</Pastille>}
              {c.isValidated && c.status !== "draft" && <Pastille ton="vert">Publique</Pastille>}
              {c.status === "draft" && <Pastille>Pas encore publiée</Pastille>}
              {c.category && <Pastille ton="bleu">{LIBELLES_CATEGORIE.fr[c.category]}</Pastille>}
              {c.entryFee != null && c.entryFee > 0 && <Pastille>{`Inscription ${c.entryFee} ${c.entryFeeCurrency}`}</Pastille>}
            </div>
            <p className="mt-2 text-xs text-gray-500">{format}</p>
            {c.description && <p className="mt-2 text-sm italic text-gray-500">« {c.description} »</p>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button onClick={basculer} disabled={enCours} className={c.isValidated ? BOUTON_CONTOUR : BOUTON_VERT}>
            {enCours ? <Loader2 size={13} className="animate-spin" /> : c.isValidated ? <EyeOff size={13} /> : <CheckCircle2 size={13} />}
            {c.isValidated ? "Retirer du public" : "Valider"}
          </button>
          {c.slug && <Link href={`/c/${c.slug}`} className={BOUTON_CONTOUR}><ExternalLink size={13} /> Page publique</Link>}
          {/* L'espace organisateur s'ouvre à l'administration : corriger une
              équipe ou un calendrier pour un organisateur qui appelle à l'aide. */}
          <Link href={`/organizer/competitions/${c.id}`} className={BOUTON_CONTOUR}><Settings size={13} /> Gérer comme l&apos;organisateur</Link>
        </div>
      </Carte>

      <div className="grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-4">
        <Chiffre valeur={equipes.length} libelle="Équipes" />
        <Chiffre valeur={enAttente.length} libelle="Inscriptions en attente" ton={enAttente.length > 0 ? "text-amber-600" : undefined} />
        <Chiffre valeur={programmes} libelle="Matchs programmés" detail={enDirect > 0 ? `${enDirect} en direct` : undefined} />
        <Chiffre valeur={joues} libelle="Matchs joués" detail={`sur ${matchs.length}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {inscriptions.length > 0 && (
            <section>
              <Titre compte={inscriptions.length}>Inscriptions</Titre>
              <Carte className="divide-y divide-gray-200/70">
                {inscriptions.map((i) => {
                  const s = INSCRIPTIONS[i.statut] ?? { label: i.statut, ton: "gris" as const };
                  return (
                    <div key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/teams/${i.clubId}`} className="text-sm font-black text-gray-900 hover:text-emerald-700">{i.club || "Équipe"}</Link>
                        <p className="text-xs text-gray-500">
                          {[i.ville, i.manager ? `par ${i.manager.nom}` : null, `demandée ${ilYA(i.creeLe)}`].filter(Boolean).join(" · ")}
                          {i.frais ? ` · frais ${i.frais} (${i.fraisStatut === "paid" ? "payés" : "non payés"})` : ""}
                        </p>
                      </div>
                      <Pastille ton={s.ton}>{s.label}</Pastille>
                    </div>
                  );
                })}
              </Carte>
            </section>
          )}

          <section>
            <Titre compte={equipes.length}>Équipes</Titre>
            {equipes.length === 0 ? (
              <Carte className="px-4 py-6 text-center text-sm text-gray-500">Aucune équipe pour l&apos;instant.</Carte>
            ) : (
              <Carte className="divide-y divide-gray-200/70">
                {equipes.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <MiniEcusson nom={e.nom} logo={e.logo} taille={28} className="text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <Link href={c.slug ? `/c/${c.slug}/teams/${e.id}` : "#"} className="text-sm font-bold text-gray-900 hover:text-emerald-700">{e.nom}</Link>
                      <p className="text-xs text-gray-500">
                        {[e.groupe ? `Groupe ${e.groupe}` : null, `${e.joueurs} joueur${e.joueurs > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
                        {e.manager ? <> · <Link href={`/admin/users/${e.manager.uid}`} className="font-semibold hover:text-gray-900">{e.manager.nom}</Link></> : " · sans manager"}
                      </p>
                    </div>
                    {e.club && <Link href={`/admin/teams/${e.club}`} className="text-xs font-bold text-gray-500 hover:text-gray-900">Club</Link>}
                    {e.disqualifiee && <Pastille ton="rouge">Disqualifiée</Pastille>}
                  </div>
                ))}
              </Carte>
            )}
          </section>

          <section>
            <Titre compte={matchs.length}>Matchs</Titre>
            {matchs.length === 0 ? (
              <Carte className="px-4 py-6 text-center text-sm text-gray-500">Aucun match : le calendrier n&apos;est pas encore généré.</Carte>
            ) : (
              <Carte className="divide-y divide-gray-200/70">
                {matchs.map((m) => {
                  const joue = m.statut === "completed" || m.statut === "live";
                  return (
                    <Link
                      key={m.id}
                      href={c.slug ? `/c/${c.slug}/matches/${m.id}` : "#"}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-gray-50"
                    >
                      <span className="w-28 shrink-0 text-xs text-gray-500">{m.date ? dateDeMatch(m.date, m.heure) : "Date à fixer"}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                        {m.domicile} {joue ? <b className="tabular-nums">{m.scoreDomicile ?? 0} – {m.scoreExterieur ?? 0}</b> : "–"} {m.exterieur}
                      </span>
                      <span className="text-xs text-gray-500">
                        {m.tour ? FOOT.fr.tour(m.tour) : m.groupe ? `Groupe ${m.groupe}` : ""}
                      </span>
                      <Pastille ton={m.statut === "live" ? "rouge" : m.statut === "completed" ? "gris" : "bleu"}>
                        {STATUTS_MATCH[m.statut] ?? m.statut}
                      </Pastille>
                    </Link>
                  );
                })}
              </Carte>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section>
            <Titre compte={organisateurs.length}>{organisateurs.length > 1 ? "Organisateurs" : "Organisateur"}</Titre>
            <Carte className="divide-y divide-gray-200/70">
              {organisateurs.length === 0
                ? <p className="px-4 py-3 text-sm text-gray-500">Aucun organisateur.</p>
                : organisateurs.map((o) => <Contact key={o.uid} c={o} />)}
            </Carte>
          </section>
          {moderateurs.length > 0 && (
            <section>
              <Titre compte={moderateurs.length}>Modérateurs</Titre>
              <Carte className="divide-y divide-gray-200/70">
                {moderateurs.map((o) => <Contact key={o.uid} c={o} />)}
              </Carte>
            </section>
          )}
          {(c.rulesText || c.rulesUrl) && (
            <section>
              <Titre>Règlement</Titre>
              <Carte className="px-4 py-3 text-sm text-gray-600">
                {c.rulesText && <p className="line-clamp-6 whitespace-pre-line">{c.rulesText}</p>}
                {c.rulesUrl && <a href={c.rulesUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-bold text-gray-900 underline">Document <ExternalLink size={12} /></a>}
                {c.requireRulesAcceptance && <p className="mt-2 text-xs text-gray-500">À accepter pour s&apos;inscrire.</p>}
              </Carte>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
