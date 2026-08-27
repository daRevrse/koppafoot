"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Loader2, MapPin, Users, Trophy, Calendar, Shield,
  Crown, UserX, Ghost, Palette, Clock,
} from "lucide-react";
import { getAdminTeamDetail, type AdminTeamDetail } from "@/lib/admin-firestore";
import TirsAuBut from "@/components/match/TirsAuBut";

// ============================================
// La fiche d'une équipe, vue de l'administration.
//
// La liste ne donnait que nom, ville, niveau et un compte de membres. Pour
// répondre à « qui dirige cette équipe », « qui en fait partie », « qu'a-t-elle
// joué », il fallait ouvrir la console Firebase. Cette page rassemble ce que
// les documents contiennent réellement, y compris ce que le produit ne montre
// nulle part : les identifiants, le staff délégué, les joueurs sans compte.
// ============================================

const NIVEAUX: Record<string, string> = {
  beginner: "Débutant",
  amateur: "Amateur",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
};

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">{titre}</h2>
      {children}
    </section>
  );
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-gray-50 py-2 last:border-0">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-gray-900">{children}</dd>
    </div>
  );
}

export default function AdminTeamDetailPage() {
  const { id } = useParams() as { id: string };
  const [detail, setDetail] = useState<AdminTeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAdminTeamDetail(id)
      .then((d) => { if (d) setDetail(d); else setIntrouvable(true); })
      .catch(() => setIntrouvable(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (introuvable || !detail) {
    return (
      <div className="space-y-4">
        <Link href="/admin/teams" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900">
          <ChevronLeft size={16} /> Équipes
        </Link>
        <p className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          Cette équipe n&apos;existe plus.
        </p>
      </div>
    );
  }

  const { team, manager, members, ghostPlayers, matches } = detail;
  const termines = matches.filter((m) => m.status === "completed");
  const effectif = members.length + ghostPlayers.length;

  return (
    <div className="space-y-5">
      <Link href="/admin/teams" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900">
        <ChevronLeft size={16} /> Équipes
      </Link>

      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
          style={{ backgroundColor: team.color || "#059669" }}
        >
          {team.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-extrabold text-gray-900">{team.name}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1"><MapPin size={11} /> {team.city || "Ville inconnue"}</span>
            <span className="flex items-center gap-1"><Shield size={11} /> {NIVEAUX[team.level] ?? team.level}</span>
            <span className="flex items-center gap-1"><Users size={11} /> {effectif} joueur{effectif > 1 ? "s" : ""}</span>
          </p>
        </div>
        {team.isGhost && (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Hors plateforme
          </span>
        )}
        {team.isRecruiting && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
            Recrute
          </span>
        )}
      </div>

      {/* Bilan */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Matchs joués", valeur: team.matchesPlayed, ton: "text-gray-900" },
          { label: "Victoires", valeur: team.wins, ton: "text-emerald-600" },
          { label: "Nuls", valeur: team.draws, ton: "text-gray-900" },
          { label: "Défaites", valeur: team.losses, ton: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">{s.label}</p>
            <p className={`mt-1 font-display text-2xl font-black tabular-nums ${s.ton}`}>{s.valeur}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Identité */}
        <Bloc titre="Identité du document">
          <dl>
            <Ligne label="Identifiant"><code className="text-xs text-gray-500">{team.id}</code></Ligne>
            <Ligne label="Manager">
              {manager ? (
                <Link href={`/admin/users?q=${encodeURIComponent(manager.email ?? "")}`} className="hover:underline">
                  {`${manager.firstName} ${manager.lastName}`.trim() || manager.email || manager.uid}
                </Link>
              ) : (
                <span className="text-amber-600">compte introuvable</span>
              )}
            </Ligne>
            <Ligne label="Identifiant manager"><code className="text-xs text-gray-500">{team.managerId}</code></Ligne>
            <Ligne label="Effectif maximum">{team.maxMembers || "non défini"}</Ligne>
            <Ligne label="Couleur">
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm border border-gray-200" style={{ backgroundColor: team.color }} />
                <code className="text-xs text-gray-500">{team.color}</code>
              </span>
            </Ligne>
            <Ligne label="Abonnés">{team.followersCount ?? 0}</Ligne>
            <Ligne label="Créée le">{team.createdAt?.slice(0, 10) || ","}</Ligne>
            <Ligne label="Modifiée le">{team.updatedAt?.slice(0, 10) || ","}</Ligne>
          </dl>
          {team.slogan && (
            <p className="mt-3 border-l-2 border-gray-100 pl-3 text-sm italic text-gray-500">«&nbsp;{team.slogan}&nbsp;»</p>
          )}
          {team.description && (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">{team.description}</p>
          )}
        </Bloc>

        {/* Staff */}
        <Bloc titre="Staff">
          {(team.staff ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucun staff nommé.</p>
          ) : (
            <ul className="space-y-2">
              {(team.staff ?? []).map((m) => (
                <li key={m.uid} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{m.name}</p>
                    <p className="text-[11px] text-gray-500">{m.title}</p>
                  </div>
                  {m.delegated && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600">
                      <Crown size={10} /> Droits manager
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* Les droits que lisent les règles Firestore, et non l'affichage :
              les deux doivent coïncider, et c'est ici qu'on le vérifie. */}
          <p className="mt-3 text-[11px] text-gray-400">
            Droits délégués en base : {(team.staffManagerIds ?? []).length === 0
              ? "aucun"
              : (team.staffManagerIds ?? []).join(", ")}
          </p>
        </Bloc>

        {/* Effectif avec compte */}
        <Bloc titre={`Effectif avec compte (${members.length})`}>
          {members.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucun compte dans l&apos;effectif.</p>
          ) : (
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.uid} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {`${m.firstName} ${m.lastName}`.trim() || m.email || m.uid}
                    </p>
                    <p className="truncate text-[11px] text-gray-500">
                      {m.position ?? "poste inconnu"}
                      {team.squadNumbers?.[m.uid] ? ` · N°${team.squadNumbers[m.uid]}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-gray-900">{m.goals ?? 0} b · {m.assists ?? 0} p</p>
                    {m.isActive === false && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-500">
                        <UserX size={10} /> suspendu
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        {/* Joueurs sans compte */}
        <Bloc titre={`Joueurs sans compte (${ghostPlayers.length})`}>
          {ghostPlayers.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucun joueur sans compte.</p>
          ) : (
            <ul className="space-y-2">
              {ghostPlayers.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      <Ghost size={11} className="mr-1 inline text-gray-400" />
                      {g.firstName} {g.lastName}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {g.position}{g.squadNumber ? ` · N°${g.squadNumber}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-bold text-gray-900">
                    {g.matchesPlayed} m · {g.goals} b · {g.assists} p
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Bloc>
      </div>

      {/* Matchs */}
      <Bloc titre={`Matchs (${matches.length}, dont ${termines.length} terminés)`}>
        {matches.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Cette équipe n&apos;a aucun match.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {matches.slice(0, 40).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0">
                  <Link href={`/matches/${m.id}`} className="text-sm font-semibold text-gray-900 hover:underline">
                    {m.homeTeamName} <span className="text-gray-300">vs</span> {m.awayTeamName}
                  </Link>
                  <p className="flex flex-wrap items-center gap-x-3 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1"><Calendar size={10} /> {m.date} {m.time}</span>
                    {m.venueName && <span className="flex items-center gap-1"><MapPin size={10} /> {m.venueName}</span>}
                    {!m.awayManagerId && <span className="text-gray-400">amical hors plateforme</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {m.status === "completed" ? (
                    <>
                      <span className="font-display text-sm font-black tabular-nums text-gray-900">
                        {m.scoreHome ?? "?"} – {m.scoreAway ?? "?"}
                      </span>
                      <TirsAuBut home={m.penaltyHome} away={m.penaltyAway} />
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-gray-400">
                      <Clock size={10} /> {m.status}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {matches.length > 40 && (
          <p className="mt-3 text-[11px] text-gray-400">
            Les 40 plus récents sur {matches.length}.
          </p>
        )}
      </Bloc>

      {(team.achievements ?? []).length > 0 && (
        <Bloc titre="Palmarès">
          <ul className="space-y-2">
            {(team.achievements ?? []).map((a, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                <Trophy size={14} className="shrink-0 text-amber-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{a.title}</p>
                  <p className="text-[11px] text-gray-500">{a.date}</p>
                </div>
              </li>
            ))}
          </ul>
        </Bloc>
      )}

      {(team.trainingSchedule ?? []).length > 0 && (
        <Bloc titre="Créneaux d'entraînement">
          <ul className="space-y-1.5">
            {(team.trainingSchedule ?? []).map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                <Palette size={12} className="text-violet-400" />
                jour {c.day} · {c.time} · {c.location}{c.label ? ` · ${c.label}` : ""}
              </li>
            ))}
          </ul>
        </Bloc>
      )}
    </div>
  );
}
