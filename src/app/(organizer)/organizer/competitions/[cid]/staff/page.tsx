"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, Loader2, ShieldCheck, UserPlus, Trash2, Mail, Ticket, Plus, X,
  Copy, Check, KeyRound, Clock, Users, Share2,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { onCompetition, onCompMatches, onCompTeams } from "@/lib/competition-firestore";
import { onStaffGrants } from "@/lib/staff-access";
import {
  describeStaffScope,
  explainStaffScope,
  formatStaffCode,
  isGrantActive,
} from "@/lib/staff-scope";
import type {
  Competition, CompMatch, CompTeam, FirestoreUser, StaffGrant, StaffScope,
} from "@/types";
import toast from "react-hot-toast";

interface ModeratorRow {
  uid: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

/** A code as the organizer API returns it. */
interface CodeRow {
  code: string;
  label: string;
  scope: StaffScope;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  usedCount: number;
  lastUsedAt: string | null;
}

// ── Scope <-> select value ───────────────────────────────────
// The picker is one <select>, so each scope is flattened to a key.

function keyToScope(key: string, matches: CompMatch[]): StaffScope | null {
  if (key === "competition") return { kind: "competition" };
  const [kind, rest] = key.split(":");
  if (kind === "stage" && (rest === "group" || rest === "knockout")) {
    return { kind: "stage", stage: rest };
  }
  if (kind === "group" && rest) return { kind: "group", group: rest };
  if (kind === "match" && rest) {
    const m = matches.find((x) => x.id === rest);
    if (!m) return null;
    return {
      kind: "match",
      matchId: m.id,
      matchLabel: `${m.homeTeamName || "?"} vs ${m.awayTeamName || "?"}`,
    };
  }
  return null;
}

function formatDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export default function CompetitionStaffPage() {
  const params = useParams<{ cid: string }>();
  const cid = params.cid;
  const { user, firebaseUser } = useAuth();
  const router = useRouter();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [moderators, setModerators] = useState<ModeratorRow[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  // Access codes and the people who redeemed them.
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [grants, setGrants] = useState<StaffGrant[]>([]);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ label: "", scopeKey: "competition", expiresAt: "" });
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [revokingCode, setRevokingCode] = useState<string | null>(null);
  const [revokingGrant, setRevokingGrant] = useState<string | null>(null);
  /** The code that was just minted — shown once, big, ready to be shared. */
  const [freshCode, setFreshCode] = useState<CodeRow | null>(null);

  useEffect(() => {
    if (!cid) return;
    const unsubCompetition = onCompetition(cid, setCompetition);
    const unsubTeams = onCompTeams(cid, setTeams);
    const unsubMatches = onCompMatches(cid, setMatches);
    const unsubGrants = onStaffGrants(cid, setGrants);
    return () => {
      unsubCompetition();
      unsubTeams();
      unsubMatches();
      unsubGrants();
    };
  }, [cid]);

  // Guard: only organizers of this competition may view the staff screen.
  useEffect(() => {
    if (!user || !competition) return;
    if (!competition.organizerIds.includes(user.uid)) {
      router.replace("/organizer");
    }
  }, [user, competition, router]);

  // Resolve moderator names whenever the moderatorIds list changes. Users are
  // publicly readable, so a direct getDoc per uid is fine here.
  useEffect(() => {
    const ids = competition?.moderatorIds;
    if (!ids) return;
    if (ids.length === 0) {
      setModerators([]);
      return;
    }
    let cancelled = false;
    setLoadingMods(true);
    (async () => {
      const rows = await Promise.all(
        ids.map(async (uid): Promise<ModeratorRow> => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
              const d = snap.data() as FirestoreUser;
              return { uid, firstName: d.first_name, lastName: d.last_name, email: d.email };
            }
          } catch (err) {
            console.error("Error loading moderator profile:", err);
          }
          return { uid, firstName: "", lastName: "", email: null };
        }),
      );
      if (!cancelled) {
        setModerators(rows);
        setLoadingMods(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [competition?.moderatorIds]);

  // Codes never reach the browser through Firestore — they are secrets, so
  // the API is the only way to see them, and only as an organizer.
  const loadCodes = useCallback(async () => {
    if (!firebaseUser || !cid) return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/competitions/staff-codes?cid=${encodeURIComponent(cid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setCodes(data.codes ?? []);
    } catch (err) {
      console.error("Error loading staff codes:", err);
    } finally {
      setLoadingCodes(false);
    }
  }, [firebaseUser, cid]);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  const groupLetters = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams) if (t.group) set.add(t.group);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [teams]);

  const hasKnockoutMatches = useMemo(
    () => matches.some((m) => m.stage === "knockout"),
    [matches],
  );
  const hasGroupMatches = useMemo(() => matches.some((m) => m.stage === "group"), [matches]);

  const linkFor = (code: string) =>
    `${typeof window === "undefined" ? "" : window.location.origin}/staff/rejoindre?code=${code}`;

  const handleCopy = async (code: string, what: "code" | "link") => {
    const text = what === "code" ? formatStaffCode(code) : linkFor(code);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(`${code}:${what}`);
      setTimeout(() => setCopiedCode(null), 2000);
      toast.success(what === "code" ? "Code copié" : "Lien copié");
    } catch {
      toast.error("Copie impossible — sélectionne le code à la main");
    }
  };

  const handleShare = async (row: CodeRow) => {
    const text = `Accès staff « ${row.label} » — ${describeStaffScope(row.scope)}\nCode : ${formatStaffCode(row.code)}\n${linkFor(row.code)}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Accès staff KoppaFoot", text });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    handleCopy(row.code, "link");
  };

  const handleCreateCode = async () => {
    if (!firebaseUser) {
      toast.error("Session expirée, reconnecte-toi");
      return;
    }
    const label = form.label.trim();
    if (!label) {
      toast.error("Donne un nom à ce code (ex : « Kodjo — poule A »)");
      return;
    }
    const scope = keyToScope(form.scopeKey, matches);
    if (!scope) {
      toast.error("Choisis une portée valide");
      return;
    }
    setCreating(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/staff-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cid,
          label,
          scope,
          // <input type="date"> gives a day; the access dies at the end of it.
          expiresAt: form.expiresAt ? `${form.expiresAt}T23:59:59` : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Impossible de créer le code");
        return;
      }
      setCreateOpen(false);
      setForm({ label: "", scopeKey: "competition", expiresAt: "" });
      setFreshCode({
        code: data.code,
        label,
        scope,
        createdAt: new Date().toISOString(),
        expiresAt: data.expiresAt ?? null,
        revoked: false,
        usedCount: 0,
        lastUsedAt: null,
      });
      await loadCodes();
    } catch (err) {
      console.error("Error creating staff code:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeCode = async (code: string) => {
    if (!firebaseUser) return;
    if (
      !window.confirm(
        "Révoquer ce code ? Les personnes qui l'ont déjà activé perdront l'accès immédiatement.",
      )
    ) {
      return;
    }
    setRevokingCode(code);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/staff-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cid, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Impossible de révoquer le code");
        return;
      }
      toast.success("Code révoqué");
      await loadCodes();
    } catch (err) {
      console.error("Error revoking staff code:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setRevokingCode(null);
    }
  };

  const handleRevokeGrant = async (uid: string) => {
    if (!firebaseUser) return;
    setRevokingGrant(uid);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/staff-grants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cid, uid }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Impossible de retirer l'accès");
        return;
      }
      toast.success("Accès retiré");
      // onStaffGrants refreshes the list live.
    } catch (err) {
      console.error("Error revoking staff grant:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setRevokingGrant(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Saisis une adresse e-mail");
      return;
    }
    if (!firebaseUser) {
      toast.error("Session expirée, reconnecte-toi");
      return;
    }
    setSubmitting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/moderators", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cid, email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || trimmed;
      toast.success(`${name} ajouté comme modérateur`);
      setEmail("");
      // onCompetition will refresh moderatorIds live.
    } catch (err) {
      console.error("Error adding moderator:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (uid: string) => {
    if (!firebaseUser) {
      toast.error("Session expirée, reconnecte-toi");
      return;
    }
    setRemovingUid(uid);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/competitions/moderators", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cid, uid }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Une erreur est survenue");
        return;
      }
      toast.success("Modérateur retiré");
      // onCompetition will refresh moderatorIds live.
    } catch (err) {
      console.error("Error removing moderator:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setRemovingUid(null);
    }
  };

  if (!competition) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const activeCodes = codes.filter((c) => !c.revoked);
  const revokedCodes = codes.filter((c) => c.revoked);
  const activeGrants = grants.filter((g) => isGrantActive(g));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href={`/organizer/competitions/${cid}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary-600"
      >
        <ArrowLeft size={16} />
        Tableau de bord
      </Link>

      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-2xl font-extrabold text-gray-900"
        >
          Staff
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="mt-0.5 max-w-xl text-sm text-gray-500"
        >
          Deux façons de confier la saisie live : un code d&apos;accès, limité à ce que tu
          décides, ou une invitation par e-mail pour un membre de confiance.
        </motion.p>
      </div>

      {/* ── Access codes ─────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-900">
              <Ticket size={16} className="text-primary-600" />
              Codes d&apos;accès
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Pas besoin de compte connu à l&apos;avance : tu envoies un code, la personne
              l&apos;active et n&apos;obtient que la portée choisie.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
          >
            <Plus size={16} />
            Créer un code
          </button>
        </div>

        {loadingCodes ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-gray-300" />
          </div>
        ) : activeCodes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
              <KeyRound size={22} className="text-primary-500" />
            </div>
            <p className="mt-3 text-sm font-bold text-gray-900">Aucun code actif</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500">
              Crée un code pour le bénévole qui tiendra la feuille de match — tu peux le
              limiter à une poule, une phase, ou un seul match.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeCodes.map((row) => {
              const expired =
                row.expiresAt != null && new Date(row.expiresAt).getTime() <= Date.now();
              return (
                <div
                  key={row.code}
                  className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{row.label}</p>
                      <p className="mt-0.5 text-xs font-semibold text-primary-600">
                        {describeStaffScope(row.scope)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        {row.usedCount > 0
                          ? `Activé ${row.usedCount} fois`
                          : "Jamais activé"}
                        {row.expiresAt && ` · ${expired ? "expiré le" : "expire le"} ${formatDay(row.expiresAt)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeCode(row.code)}
                      disabled={revokingCode === row.code}
                      aria-label={`Révoquer le code ${row.label}`}
                      className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {revokingCode === row.code ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <code
                      className={`rounded-lg px-3 py-2 font-mono text-sm font-black tracking-[0.15em] ${
                        expired ? "bg-gray-100 text-gray-400 line-through" : "bg-gray-900 text-white"
                      }`}
                    >
                      {formatStaffCode(row.code)}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(row.code, "code")}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      {copiedCode === `${row.code}:code` ? (
                        <Check size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                      Copier le code
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShare(row)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      <Share2 size={14} />
                      Partager le lien
                    </button>
                  </div>
                </div>
              );
            })}

            {revokedCodes.length > 0 && (
              <p className="px-1 text-[11px] text-gray-400">
                {revokedCodes.length} code{revokedCodes.length > 1 ? "s" : ""} révoqué
                {revokedCodes.length > 1 ? "s" : ""} (plus utilisable
                {revokedCodes.length > 1 ? "s" : ""}).
              </p>
            )}
          </div>
        )}
      </motion.section>

      {/* ── People holding an access ─────────────────────── */}
      {grants.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-900">
            <Users size={16} className="text-emerald-600" />
            Accès activés
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">
              {activeGrants.length}
            </span>
          </h2>
          <div className="space-y-2">
            {grants.map((grant) => {
              const active = isGrantActive(grant);
              return (
                <div
                  key={grant.uid}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm ${
                    active ? "border-gray-100 bg-white" : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    <ShieldCheck size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{grant.name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {describeStaffScope(grant.scope)}
                      {!active && " · accès retiré"}
                    </p>
                  </div>
                  {active && (
                    <button
                      type="button"
                      onClick={() => handleRevokeGrant(grant.uid)}
                      disabled={revokingGrant === grant.uid}
                      aria-label={`Retirer l'accès de ${grant.name}`}
                      className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {revokingGrant === grant.uid ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ── Moderators (e-mail invite) ───────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-900">
            <Mail size={16} className="text-gray-400" />
            Modérateurs
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Accès complet au live de la compétition, pour un membre qui a déjà un compte
            KoppaFoot. Sans accès à la configuration.
          </p>
        </div>

        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <Mail
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="email"
              placeholder="e-mail du modérateur"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-4 text-sm focus:border-primary-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Ajouter
          </button>
        </form>

        {loadingMods ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin text-gray-300" />
          </div>
        ) : moderators.length === 0 ? (
          <p className="px-1 text-xs text-gray-400">Aucun modérateur pour l&apos;instant.</p>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {moderators.map((mod) => {
                const fullName = [mod.firstName, mod.lastName].filter(Boolean).join(" ");
                return (
                  <motion.div
                    key={mod.uid}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="group flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                      <ShieldCheck size={18} className="text-primary-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900">
                        {fullName || "Membre"}
                      </p>
                      {mod.email && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{mod.email}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(mod.uid)}
                      disabled={removingUid === mod.uid}
                      aria-label={`Retirer ${fullName || "ce modérateur"}`}
                      className="shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {removingUid === mod.uid ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.section>

      {/* ── Create-code modal ────────────────────────────── */}
      <AnimatePresence>
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-gray-900">
                  Nouveau code d&apos;accès
                </h2>
                <button
                  onClick={() => !creating && setCreateOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Pour qui ?
                  </label>
                  <input
                    type="text"
                    placeholder="Kodjo — poule A"
                    value={form.label}
                    onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Sert uniquement à t&apos;y retrouver dans la liste.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Portée</label>
                  <select
                    value={form.scopeKey}
                    onChange={(e) => setForm((p) => ({ ...p, scopeKey: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  >
                    <option value="competition">Toute la compétition</option>
                    {hasGroupMatches && <option value="stage:group">Phase de groupes</option>}
                    {hasKnockoutMatches && <option value="stage:knockout">Phase finale</option>}
                    {groupLetters.length > 0 && (
                      <optgroup label="Une poule">
                        {groupLetters.map((g) => (
                          <option key={g} value={`group:${g}`}>
                            Poule {g}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {matches.length > 0 && (
                      <optgroup label="Un seul match">
                        {matches.map((m) => (
                          <option key={m.id} value={`match:${m.id}`}>
                            {m.homeTeamName || "?"} vs {m.awayTeamName || "?"}
                            {m.date ? ` (${m.date})` : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {(() => {
                      const scope = keyToScope(form.scopeKey, matches);
                      return scope ? explainStaffScope(scope) : "";
                    })()}
                  </p>
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <Clock size={13} />
                    Expire le (optionnel)
                  </label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    Recommandé : la fin du tournoi. Sans date, le code reste valable jusqu&apos;à
                    ce que tu le révoques.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => !creating && setCreateOpen(false)}
                    className="rounded-lg px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCode}
                    disabled={creating}
                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-all hover:bg-primary-700 disabled:opacity-50"
                  >
                    {creating ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
                    Générer le code
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Fresh code, shown once, big ──────────────────── */}
      <AnimatePresence>
        {freshCode && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="w-full max-w-md rounded-t-2xl bg-white p-6 text-center shadow-xl sm:rounded-2xl"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                <Check size={24} className="text-emerald-600" />
              </div>
              <h2 className="mt-3 font-display text-lg font-bold text-gray-900">
                Code créé pour {freshCode.label}
              </h2>
              <p className="mt-1 text-xs text-gray-500">{explainStaffScope(freshCode.scope)}</p>

              <code className="mt-4 block rounded-xl bg-gray-900 px-4 py-4 font-mono text-2xl font-black tracking-[0.2em] text-white">
                {formatStaffCode(freshCode.code)}
              </code>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => handleShare(freshCode)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
                >
                  <Share2 size={16} />
                  Partager le lien
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(freshCode.code, "code")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                >
                  {copiedCode === `${freshCode.code}:code` ? (
                    <Check size={16} className="text-emerald-600" />
                  ) : (
                    <Copy size={16} />
                  )}
                  Copier le code
                </button>
              </div>
              <button
                type="button"
                onClick={() => setFreshCode(null)}
                className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
              >
                Fermer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
