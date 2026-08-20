"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft, Loader2, Users, BarChart3, UserCheck, Plus, Pencil, Trash2,
  Check, X, BadgeCheck, Save, Link2, Download,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCompetition, getCompTeam, listCompMatches,
  addCompPlayer, updateCompPlayer, removeCompPlayer,
} from "@/lib/competition-firestore";
import { getTeamsByManager } from "@/lib/firestore";
import { computeSquadStats } from "@/lib/player-stats";
import type { Competition, CompPlayer, CompTeam, RosterClaim, Team } from "@/types";

// ============================================
// Mon équipe — one competition team. The manager runs the roster, validates
// the players who claim their line, and reads the squad's stats. The team's
// name, poule and ownership stay with the organizer (enforced in the rules).
// ============================================

type Tab = "roster" | "claims" | "stats";

const inputClass =
  "w-full border border-gray-200/70 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

export default function MyTeamPage() {
  const { cid, tid } = useParams() as { cid: string; tid: string };
  const { user, firebaseUser } = useAuth();
  const router = useRouter();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [team, setTeam] = useState<CompTeam | null>(null);
  const [matches, setMatches] = useState<Awaited<ReturnType<typeof listCompMatches>>>([]);
  const [claims, setClaims] = useState<RosterClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("roster");

  // Roster editor
  const [editing, setEditing] = useState<CompPlayer | null>(null);
  const [adding, setAdding] = useState(false);
  const [fName, setFName] = useState("");
  const [fNumber, setFNumber] = useState("");
  const [fPosition, setFPosition] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyClaim, setBusyClaim] = useState<string | null>(null);

  // Club link
  const [clubs, setClubs] = useState<Team[]>([]);
  const [importing, setImporting] = useState(false);

  const reloadTeam = useCallback(async () => {
    const t = await getCompTeam(cid, tid);
    setTeam(t);
    return t;
  }, [cid, tid]);

  const reloadClaims = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/competitions/roster-claims?cid=${cid}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { claims: RosterClaim[] };
      setClaims((data.claims ?? []).filter((c) => c.teamId === tid));
    } catch {
      // Non-blocking — the rest of the page still works.
    }
  }, [firebaseUser, cid, tid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [comp, t, m] = await Promise.all([
          getCompetition(cid),
          getCompTeam(cid, tid),
          listCompMatches(cid),
        ]);
        if (cancelled) return;
        setCompetition(comp);
        setTeam(t);
        setMatches(m);
      } catch (err) {
        console.error("Error loading team:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cid, tid]);

  useEffect(() => {
    reloadClaims();
  }, [reloadClaims]);

  // The manager's clubs — source of the roster import.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getTeamsByManager(user.uid)
      .then((t) => {
        if (!cancelled) setClubs(t);
      })
      .catch((err) => console.error("Error loading clubs:", err));
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Pulls the club squad into the competition roster. Runs server-side: the
  // import also writes a `linked_comp_players` row on each player's own user
  // doc — only the admin SDK may do that — which is what makes their personal
  // statistics fill with no claim and no validation.
  const importClub = async (club: Team) => {
    if (!firebaseUser) return;
    setImporting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/club-import", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ cid, teamId: tid, clubId: club.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "L'import a échoué");
        return;
      }
      await reloadTeam();
      toast.success(
        data.added === 0
          ? "Effectif déjà à jour"
          : `${data.added} joueur${data.added > 1 ? "s" : ""} importé${data.added > 1 ? "s" : ""}`,
      );
    } catch (err) {
      console.error("Error importing club roster:", err);
      toast.error("L'import a échoué");
    } finally {
      setImporting(false);
    }
  };

  // Guard: only this team's manager (or an organizer) belongs here.
  useEffect(() => {
    if (loading || !user || !team || !competition) return;
    const allowed =
      team.claimedByManagerId === user.uid || competition.organizerIds.includes(user.uid);
    if (!allowed) router.replace("/mon-equipe");
  }, [loading, user, team, competition, router]);

  const roster = useMemo(() => {
    const players = team?.players ?? [];
    return [...players].sort((a, b) => {
      const na = parseInt(a.number, 10);
      const nb = parseInt(b.number, 10);
      if (Number.isNaN(na) && Number.isNaN(nb)) return a.name.localeCompare(b.name);
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return na - nb;
    });
  }, [team]);

  const squadStats = useMemo(
    () => (team ? computeSquadStats(matches, tid, roster) : []),
    [matches, team, tid, roster],
  );

  const openAdd = () => {
    setEditing(null);
    setFName("");
    setFNumber("");
    setFPosition("");
    setAdding(true);
  };

  const openEdit = (player: CompPlayer) => {
    setAdding(false);
    setEditing(player);
    setFName(player.name);
    setFNumber(player.number);
    setFPosition(player.position ?? "");
  };

  const closeEditor = () => {
    setAdding(false);
    setEditing(null);
  };

  const savePlayer = async () => {
    const name = fName.trim();
    if (!name) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCompPlayer(cid, tid, editing.id, {
          name,
          number: fNumber.trim(),
          position: fPosition.trim(),
        });
      } else {
        await addCompPlayer(cid, tid, {
          name,
          number: fNumber.trim(),
          position: fPosition.trim() || undefined,
        });
      }
      await reloadTeam();
      toast.success(editing ? "Joueur modifié" : "Joueur ajouté");
      closeEditor();
    } catch (err) {
      console.error("Error saving player:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const deletePlayer = async (player: CompPlayer) => {
    setSaving(true);
    try {
      await removeCompPlayer(cid, tid, player.id);
      await reloadTeam();
      toast.success("Joueur retiré");
    } catch (err) {
      console.error("Error removing player:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const decideClaim = async (claim: RosterClaim, action: "accept" | "reject") => {
    if (!firebaseUser) return;
    setBusyClaim(claim.id);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/roster-claims", {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: claim.id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      toast.success(action === "accept" ? "Rattachement validé" : "Demande refusée");
      await Promise.all([reloadClaims(), reloadTeam()]);
    } catch {
      toast.error("Une erreur est survenue");
    } finally {
      setBusyClaim(null);
    }
  };

  // Unlinking is a plain roster write — the manager owns the players array.
  const unlink = async (player: CompPlayer) => {
    setSaving(true);
    try {
      await updateCompPlayer(cid, tid, player.id, { user_id: null });
      await reloadTeam();
      toast.success("Rattachement retiré");
    } catch (err) {
      console.error("Error unlinking player:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!team || !competition) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="font-display text-lg font-black text-gray-900">Équipe introuvable</p>
        <Link href="/mon-equipe" className="mt-3 inline-block text-sm font-bold text-emerald-600">
          ← Mes équipes
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof Users; badge?: number }[] = [
    { key: "roster", label: "Effectif", icon: Users },
    { key: "claims", label: "Rattachements", icon: UserCheck, badge: claims.length },
    { key: "stats", label: "Stats", icon: BarChart3 },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/mon-equipe"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-emerald-600"
      >
        <ArrowLeft size={16} />
        Mes équipes
      </Link>

      <div className="flex items-center gap-4 border border-gray-200/70 bg-white p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-gray-50">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Users size={24} className="text-gray-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-black text-gray-900">{team.name}</h1>
          <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">
            {competition.name}
            {team.group ? ` · Groupe ${team.group}` : ""}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-bold transition-colors ${
              tab === t.key ? "bg-white text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.icon size={14} />
            {t.label}
            {!!t.badge && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-white">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Effectif ─────────────────────────────── */}
      {tab === "roster" && (
        <div className="space-y-3">
          {/* Club link — avoids typing the same squad into two models. */}
          {team.claimedByTeamId ? (
            (() => {
              const club = clubs.find((c) => c.id === team.claimedByTeamId);
              return (
                <div className="flex flex-wrap items-center gap-3 border border-emerald-100 bg-emerald-50/60 p-4">
                  <Link2 size={16} className="shrink-0 text-emerald-600" />
                  <p className="min-w-0 flex-1 text-sm font-bold text-emerald-900">
                    Rattachée à {club ? club.name : "ton club"}
                  </p>
                  {club && (
                    <button
                      type="button"
                      onClick={() => importClub(club)}
                      disabled={importing}
                      className="flex shrink-0 items-center gap-1.5 border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {importing ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Download size={13} />
                      )}
                      Resynchroniser
                    </button>
                  )}
                </div>
              );
            })()
          ) : clubs.length > 0 ? (
            <div className=" border border-gray-200/70 bg-white p-4">
              <p className="text-sm font-bold text-gray-900">Importer ton effectif</p>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">
                Reprends les joueurs de ton club plutôt que de tout ressaisir. Ceux qui
                ont un compte KoppaFoot sont rattachés directement — leurs stats se
                remplissent sans qu&apos;ils aient à le demander.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {clubs.map((club) => (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => importClub(club)}
                    disabled={importing}
                    className="flex items-center gap-1.5 bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {importing ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    {club.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className=" border border-dashed border-gray-200/70 bg-gray-50/60 p-4">
              <p className="text-sm font-bold text-gray-700">Pas encore de club</p>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">
                Crée ton club pour gérer un effectif permanent et l&apos;importer dans
                chacune de tes compétitions.{" "}
                <Link href="/teams" className="font-black text-emerald-600 hover:underline">
                  Créer mon club →
                </Link>
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={openAdd}
            className="flex w-full items-center justify-center gap-2 border border-dashed border-gray-200/70 py-3 text-sm font-bold text-gray-500 transition-colors hover:border-emerald-300 hover:text-emerald-600"
          >
            <Plus size={15} />
            Ajouter un joueur
          </button>

          {(adding || editing) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 border border-gray-200/70 bg-white p-4"
            >
              <div className="grid gap-2 sm:grid-cols-[5rem_1fr_8rem]">
                <input
                  type="text"
                  value={fNumber}
                  onChange={(e) => setFNumber(e.target.value)}
                  placeholder="N°"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  placeholder="Nom du joueur"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={fPosition}
                  onChange={(e) => setFPosition(e.target.value)}
                  placeholder="Poste"
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className=" px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={savePlayer}
                  disabled={saving}
                  className="flex items-center gap-2 bg-emerald-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Enregistrer
                </button>
              </div>
            </motion.div>
          )}

          {roster.length === 0 ? (
            <p className=" border border-gray-200/70 bg-white px-5 py-8 text-center text-sm font-bold text-gray-400">
              Effectif vide.
            </p>
          ) : (
            <div className="divide-y divide-gray-50 overflow-hidden border border-gray-200/70 bg-white">
              {roster.map((player) => (
                <div key={player.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-gray-50 text-xs font-black tabular-nums text-gray-500">
                    {player.number || "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{player.name}</p>
                    {player.user_id && (
                      <button
                        type="button"
                        onClick={() => unlink(player)}
                        disabled={saving}
                        className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-600 hover:text-red-500 disabled:opacity-50"
                      >
                        <BadgeCheck size={10} /> Compte lié · délier
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openEdit(player)}
                    className="shrink-0 p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePlayer(player)}
                    disabled={saving}
                    className="shrink-0 p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Rattachements ────────────────────────── */}
      {tab === "claims" && (
        <div className="space-y-3">
          {claims.length === 0 ? (
            <p className=" border border-gray-200/70 bg-white px-5 py-8 text-center text-sm font-bold text-gray-400">
              Aucune demande en attente.
            </p>
          ) : (
            claims.map((claim) => (
              <div
                key={claim.id}
                className="flex items-center gap-3 border border-gray-200/70 bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-gray-900">{claim.userName}</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">
                    déclare être « {claim.playerName} »
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => decideClaim(claim, "reject")}
                  disabled={busyClaim === claim.id}
                  className="shrink-0 border border-gray-200/70 p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  <X size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => decideClaim(claim, "accept")}
                  disabled={busyClaim === claim.id}
                  className="flex shrink-0 items-center gap-1.5 bg-emerald-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                >
                  {busyClaim === claim.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Check size={15} />
                  )}
                  Valider
                </button>
              </div>
            ))
          )}
          <p className=" bg-gray-50 p-4 text-xs font-semibold leading-relaxed text-gray-500">
            Quand un joueur clique « C&apos;est moi » sur la page publique de
            l&apos;équipe, sa demande arrive ici. Une fois validée, ses buts, cartons et
            matchs joués alimentent ses statistiques personnelles.
          </p>
        </div>
      )}

      {/* ── Stats ────────────────────────────────── */}
      {tab === "stats" && (
        <div className="overflow-x-auto border border-gray-200/70 bg-white">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="border-b border-gray-200/70 text-[11px] font-black uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 text-left">Joueur</th>
                <th className="px-2 py-3 text-center">MJ</th>
                <th className="px-2 py-3 text-center">Tit.</th>
                <th className="px-2 py-3 text-center">Buts</th>
                <th className="px-2 py-3 text-center">🟨</th>
                <th className="px-4 py-3 text-center">🟥</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {squadStats.map(({ player, stats }) => (
                <tr key={player.id}>
                  <td className="px-4 py-2.5">
                    <span className="font-bold text-gray-900">{player.name}</span>
                    {player.number && (
                      <span className="ml-2 text-xs tabular-nums text-gray-400">
                        #{player.number}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-gray-600">
                    {stats.matchesPlayed}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-gray-600">
                    {stats.starts}
                  </td>
                  <td className="px-2 py-2.5 text-center font-black tabular-nums text-emerald-600">
                    {stats.goals}
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-gray-600">
                    {stats.yellowCards}
                  </td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-gray-600">
                    {stats.redCards}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {squadStats.length === 0 && (
            <p className="px-5 py-8 text-center text-sm font-bold text-gray-400">
              Effectif vide.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
