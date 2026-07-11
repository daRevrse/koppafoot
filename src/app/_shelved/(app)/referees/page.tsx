"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  Award, MapPin, Search, Filter, ChevronDown, X,
  Star, Clock, Shield, Send, Inbox, ChevronRight, Loader2, Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "next/navigation";
import {
  searchReferees, inviteRefereeToMatch, getMatchById,
  getMatchesByReferee, onMatchesByReferee, respondToRefereeInvitation,
  getMatchesLookingForReferee, applyToMatchAsReferee,
  respondToRefereeApplication, getMatchesByManager
} from "@/lib/firestore";
import type { UserProfile, Match } from "@/types";

// ============================================
// Extended referee type (user doc has extra fields)
// ============================================

interface RefereeProfile extends UserProfile {
  license_number?: string;
  license_level?: "trainee" | "regional" | "national" | "international";
  experience_years?: number;
}

// ============================================
// Constants
// ============================================

const LICENSE_LABELS: Record<string, string> = {
  trainee: "Stagiaire",
  regional: "Régional",
  national: "National",
  international: "International",
};

const LICENSE_COLORS: Record<string, string> = {
  trainee: "bg-gray-100 text-gray-700",
  regional: "bg-blue-100 text-blue-700",
  national: "bg-purple-100 text-purple-700",
  international: "bg-accent-100 text-accent-700",
};

const AVATAR_COLORS = [
  { bg: "bg-purple-100", text: "text-purple-600" },
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-emerald-100", text: "text-emerald-600" },
  { bg: "bg-orange-100", text: "text-orange-600" },
  { bg: "bg-red-100", text: "text-red-600" },
];

const CITIES = ["Toutes", "Paris", "Lyon", "Marseille", "Toulouse"];
const LICENSE_LEVELS = ["Tous", "trainee", "regional", "national", "international"];

function getAvatarColor(uid: string) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ============================================
// Skeleton Components
// ============================================

function RefereeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-full bg-gray-200 animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="h-5 w-16 rounded-full bg-gray-200 animate-pulse" />
        </div>
        <div className="flex gap-4">
          <div className="h-3 w-28 rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3.5 w-3.5 rounded bg-gray-200 animate-pulse" />
          ))}
        </div>
        <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
        <div className="h-10 w-full rounded-lg bg-gray-200 animate-pulse" />
      </div>
    </div>
  );
}
// ============================================
// Component
// ============================================

type Tab = "available" | "requests" | "confirmed";

export default function RefereesPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const matchId = searchParams.get("matchId");

  const [tab, setTab] = useState<Tab>(
    (user?.userType === "referee") ? "requests" : "available"
  );
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("Toutes");
  const [licenseFilter, setLicenseFilter] = useState("Tous");
  const [showFilters, setShowFilters] = useState(false);
  const [requestedReferees, setRequestedReferees] = useState<Set<string>>(new Set());
  const [match, setMatch] = useState<Match | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);

  const [referees, setReferees] = useState<RefereeProfile[]>([]);
  const [invitations, setInvitations] = useState<Match[]>([]);
  const [availableMatches, setAvailableMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmedMatches, setConfirmedMatches] = useState<Match[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  const isReferee = user?.userType === "referee";
  const isManager = user?.userType === "manager";

  const fetchRefereeData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // If matchId is provided, fetch specific match info
      if (matchId) {
        const matchData = await getMatchById(matchId);
        setMatch(matchData);
      }

      if (isReferee) {
        // Referee view
        const [available, invited, pending, confirmed] = await Promise.all([
          getMatchesLookingForReferee(),
          getMatchesByReferee(user.uid, "invited"),
          getMatchesByReferee(user.uid, "pending"),
          getMatchesByReferee(user.uid, "confirmed")
        ]);
        setAvailableMatches(available);
        setInvitations([...invited, ...pending]);
        setConfirmedMatches(confirmed);
      } else {
        // Manager view
        if (tab === "available") {
          const filters: { city?: string; licenseLevel?: string; query?: string } = {};
          if (cityFilter !== "Toutes") filters.city = cityFilter;
          if (licenseFilter !== "Tous") filters.licenseLevel = licenseFilter;
          if (query.trim()) filters.query = query.trim();
          const results = await searchReferees(filters);
          const filtered = results.filter((r) => r.uid !== user.uid);
          setReferees(filtered as RefereeProfile[]);
        } else {
          // Fetch manager's matches with pending referee applications
          // Only show matches where the user is the HOME manager (manager_id)
          const results = await getMatchesByManager(user.uid);
          
          // Filter: only allow managing referees for matches where user is the creator/home manager
          const homeMatches = results.filter(m => m.managerId === user.uid);
          
          setInvitations(homeMatches.filter(m => m.refereeStatus === "pending"));
          setConfirmedMatches(homeMatches.filter(m => m.refereeStatus === "confirmed"));
        }
      }
    } catch (err) {
      console.error("Erreur lors du chargement des données:", err);
    } finally {
      setLoading(false);
    }
  }, [tab, cityFilter, licenseFilter, query, user, isReferee, matchId]);

  useEffect(() => {
    if (!user) return;

    if (isReferee) {
      // Real-time listeners for referee
      const unsubInvited = onMatchesByReferee(user.uid, (data) => {
        setInvitations(data.filter(m => m.refereeStatus === 'invited' || m.refereeStatus === 'pending'));
      });

      const unsubConfirmed = onMatchesByReferee(user.uid, (data) => {
        setConfirmedMatches(data);
      }, "confirmed");

      // Still need available matches
      getMatchesLookingForReferee().then(setAvailableMatches);

      setLoading(false);

      return () => {
        unsubInvited();
        unsubConfirmed();
      };
    } else {
      // Manager view logic
      fetchRefereeData();
    }
  }, [user, isReferee, fetchRefereeData]);

  const handleInvitationResponse = async (matchId: string, accepted: boolean) => {
    setResponding(matchId);
    try {
      if (isReferee) {
        await respondToRefereeInvitation(matchId, accepted);
      } else {
        await respondToRefereeApplication(matchId, accepted);
      }
      await fetchRefereeData();
    } catch (err) {
      console.error("Erreur réponse invitation:", err);
    } finally {
      setResponding(null);
    }
  };

  const handleApplyToMatch = async (matchId: string) => {
    if (!user || user.userType !== "referee") return;
    setApplying(matchId);
    try {
      await applyToMatchAsReferee(matchId, user.uid, `${user.firstName} ${user.lastName}`);
      await fetchRefereeData();
    } catch (err) {
      console.error("Erreur postulation:", err);
    } finally {
      setApplying(null);
    }
  };

  const handleRequest = async (refereeId: string) => {
    if (!matchId || requesting) return;
    
    const referee = referees.find(r => r.uid === refereeId);
    if (!referee) return;

    setRequesting(refereeId);
    try {
      await inviteRefereeToMatch(matchId, refereeId, `${referee.firstName} ${referee.lastName}`);
      setRequestedReferees((prev) => new Set([...prev, refereeId]));
    } catch (err) {
      console.error("Erreur d'invitation:", err);
    } finally {
      setRequesting(null);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 font-display">
          {isReferee ? "Espace Arbitre" : "Arbitres"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isReferee 
            ? "G&egrave;re tes invitations et trouve de nouveaux matchs &agrave; arbitrer"
            : match 
              ? `Invite un arbitre pour : ${match.homeTeamName} vs ${match.awayTeamName || "???"}`
              : "Trouve et sollicite des arbitres pour tes matchs"
          }
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="flex border-b border-gray-200"
      >
        <button
          onClick={() => setTab("available")}
          className={`flex items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors ${
            tab === "available"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Award size={16} /> 
          {isReferee ? "Matchs disponibles" : "Trouver un arbitre"}
          <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
            tab === "available" ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"
          }`}>
            {loading ? "..." : isReferee ? availableMatches.length : referees.length}
          </span>
        </button>
        <button
          onClick={() => setTab("requests")}
          className={`flex items-center gap-2 border-b-2 pb-3 px-6 text-sm font-medium transition-colors ${
            tab === "requests"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Inbox size={16} /> 
          {isReferee ? "Invitations re&ccedil;ues" : "Postulations re&ccedil;ues"}
          <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
            tab === "requests" ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"
          }`}>
            {loading ? "..." : invitations.length}
          </span>
        </button>

        <button
          onClick={() => setTab("confirmed")}
          className={`flex items-center gap-2 border-b-2 pb-3 px-6 text-sm font-medium transition-colors ${
            tab === "confirmed"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Award size={16} /> 
          {isReferee ? "Mes matchs confirm&eacute;s" : "Arbitres confirm&eacute;s"}
          <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
            tab === "confirmed" ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"
          }`}>
            {loading ? "..." : confirmedMatches.length}
          </span>
        </button>
      </motion.div>

      {/* Tab: Available Referees */}
      {tab === "available" && (
        <>
          {/* Search + Filters */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 }}
            className="space-y-3"
          >
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher par nom..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 transition-shadow focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)]"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  showFilters
                    ? "border-primary-300 bg-primary-50 text-primary-700"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Filter size={16} /> Filtres
                <ChevronDown size={14} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </button>
            </div>

            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Ville</label>
                  <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none"
                  >
                    {CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Niveau licence</label>
                  <select
                    value={licenseFilter}
                    onChange={(e) => setLicenseFilter(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none"
                  >
                    {LICENSE_LEVELS.map((l) => (
                      <option key={l} value={l}>{l === "Tous" ? "Tous" : LICENSE_LABELS[l]}</option>
                    ))}
                  </select>
                </div>
                {(cityFilter !== "Toutes" || licenseFilter !== "Tous") && (
                  <button
                    onClick={() => { setCityFilter("Toutes"); setLicenseFilter("Tous"); }}
                    className="mt-auto flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <X size={14} /> Réinitialiser
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Loading state */}
          {loading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <RefereeCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Grid View */}
          {!loading && isReferee && availableMatches.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availableMatches.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700">
                      {m.format}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar size={12} /> {new Date(m.date).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-gray-900 mb-1 font-display">
                    {m.homeTeamName} vs {m.awayTeamName || "???"}
                  </h3>
                  
                  <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} /> {m.time}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} /> {m.venueName}, {m.venueCity}
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplyToMatch(m.id)}
                    disabled={applying === m.id}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    {applying === m.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>Postuler au match</>
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {!loading && !isReferee && referees.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {referees.map((referee, i) => {
                const colors = getAvatarColor(referee.uid);
                const hasRequested = requestedReferees.has(referee.uid);
                const initials = `${referee.firstName?.[0] ?? ""}${referee.lastName?.[0] ?? ""}`.toUpperCase();
                const licenseLevel = (referee as RefereeProfile).license_level;
                const experienceYears = (referee as RefereeProfile).experience_years;

                return (
                  <motion.div
                    key={referee.uid}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.06 }}
                    whileHover={{ y: -3 }}
                    className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
                  >
                    <div className="p-5">
                      {/* Referee head */}
                      <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${colors.bg}`}>
                          <span className={`text-sm font-bold ${colors.text}`}>{initials}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-gray-900 font-display truncate">
                            {referee.firstName} {referee.lastName}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin size={12} /> {referee.locationCity || "Non renseigné"}
                          </div>
                        </div>
                        {licenseLevel && (
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${LICENSE_COLORS[licenseLevel] ?? "bg-gray-100 text-gray-700"}`}>
                            {LICENSE_LABELS[licenseLevel] ?? licenseLevel}
                          </span>
                        )}
                      </div>

                      {/* Experience */}
                      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                        {experienceYears != null ? (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {experienceYears} an{experienceYears > 1 ? "s" : ""} d&apos;exp&eacute;rience
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> Exp&eacute;rience N/A
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Shield size={12} /> Arbitre
                        </span>
                      </div>

                      {/* Rating */}
                      <div className="mt-2 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            size={14}
                            className="text-gray-200"
                          />
                        ))}
                        <span className="ml-1 text-xs font-medium text-gray-400">N/A</span>
                      </div>

                      {/* Bio */}
                      {referee.bio && (
                        <p className="mt-3 text-xs text-gray-500 line-clamp-2">{referee.bio}</p>
                      )}

                      {/* CTA */}
                      <button
                        onClick={() => handleRequest(referee.uid)}
                        disabled={
                          hasRequested || 
                          (!!matchId && requesting === referee.uid) ||
                          (!!match && match.managerId !== user?.uid)
                        }
                        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                          hasRequested
                            ? "bg-primary-50 text-primary-600 cursor-default"
                            : (!!match && match.managerId !== user?.uid)
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-primary-600 text-white hover:bg-primary-700 hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
                        }`}
                      >
                        {hasRequested ? (
                          <>Invitation envoy&eacute;e</>
                        ) : requesting === referee.uid ? (
                          <><Loader2 size={16} className="animate-spin" /> Envoi...</>
                        ) : (!!match && match.managerId !== user?.uid) ? (
                          <><Shield size={16} /> Équipe à domicile uniquement</>
                        ) : matchId ? (
                          <><Send size={16} /> Inviter au match</>
                        ) : (
                          <><Send size={16} /> Demander</>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!loading && ((isReferee && availableMatches.length === 0) || (!isReferee && referees.length === 0)) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/50 py-16 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100">
                <Award size={32} className="text-gray-300" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">
                {isReferee ? "Aucun match disponible" : "Aucun arbitre trouv\u00e9"}
              </h3>
              <p className="mt-1 max-w-xs text-sm text-gray-500">
                {isReferee 
                  ? "Il n'y a pas de matchs en attente d'arbitre pour le moment." 
                  : "Essaie d'élargir tes crit\u00e8res de recherche."
                }
              </p>
            </motion.div>
          )}
        </>
      )}

      {tab === "requests" && (
        <div className="space-y-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          ) : invitations.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {invitations.map((invitation) => (
                <motion.div
                  key={invitation.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-600">
                        <Inbox size={12} /> 
                        {isReferee 
                          ? (invitation.refereeStatus === "invited" ? "Invitation Re\u00e7ue" : "Postulation Envoy\u00e9e") 
                          : "Postulation Re\u00e7ue"
                        }
                      </div>
                      <h4 className="mt-1 font-bold text-gray-900 font-display">
                        {invitation.homeTeamName} vs {invitation.awayTeamName || "???"}
                      </h4>
                      <div className="mt-2 space-y-1 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} /> {new Date(invitation.date).toLocaleDateString()} &agrave; {invitation.time}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={14} /> {invitation.venueName || "Lieu non d\u00e9fini"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Award size={14} /> Format: {invitation.format}
                        </div>
                        {!isReferee && invitation.refereeName && (
                          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-600">
                            <Shield size={12} /> Arbitre: {invitation.refereeName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-3">
                    {isReferee && invitation.refereeStatus === "pending" ? (
                      <div className="flex-1 rounded-lg bg-gray-100 py-2.5 text-center text-sm font-semibold text-gray-500">
                        Postulation en attente
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleInvitationResponse(invitation.id, true)}
                          disabled={!!responding}
                          className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          {responding === invitation.id ? (
                            <Loader2 size={16} className="mx-auto animate-spin" />
                          ) : (
                            "Accepter"
                          )}
                        </button>
                        <button
                          onClick={() => handleInvitationResponse(invitation.id, false)}
                          disabled={!!responding}
                          className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          Refuser
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/50 py-16 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100">
                <Inbox size={32} className="text-gray-300" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">
                {isReferee ? "Aucune invitation" : "Aucune postulation"}
              </h3>
              <p className="mt-1 max-w-xs text-sm text-gray-500">
                {isReferee 
                  ? "Tu n'as pas d'invitations en attente pour le moment." 
                  : "Aucun arbitre n'a encore postul\u00e9 &agrave; tes matchs."
                }
              </p>
              <button
                onClick={() => setTab("available")}
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {isReferee ? "Explorer les matchs" : "Voir les arbitres"} <ChevronRight size={14} />
              </button>
            </motion.div>
          )}
        </div>
      )}

      {tab === "confirmed" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : confirmedMatches.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {confirmedMatches.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="rounded-xl border border-primary-100 bg-white p-5 shadow-sm border-l-4 border-l-primary-500"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700">
                      Confirm&eacute;
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar size={12} /> {new Date(m.date).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">
                    {m.homeTeamName} vs {m.awayTeamName || "???"}
                  </h3>
                  <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} /> {m.time}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} /> {m.venueName}, {m.venueCity}
                    </div>
                    {!isReferee && (
                      <div className="flex items-center gap-1.5 text-primary-600 font-medium">
                        <Award size={12} /> Arbitre : {m.refereeName}
                      </div>
                    )}
                  </div>
                  {isReferee && m.status === "upcoming" && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider mb-2">Instructions</p>
                      <p className="text-xs text-gray-600">Pr&eacute;sente-toi 15min avant le coup d&apos;envoi.</p>
                    </div>
                  )}
                  {isReferee && m.status === "completed" && (
                    <span className="block w-full text-center px-4 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-bold">
                      Match termin&eacute;
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/50 p-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm">
                <Award size={32} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 font-display">Aucun match confirm&eacute;</h3>
              <p className="mt-2 max-w-sm text-sm text-gray-500">
                {isReferee 
                  ? "Tu n'as pas encore de matchs assign\u00e9s. Postule &agrave; des matchs ou attends des invitations."
                  : "Aucun arbitre n'a encore \u00e9t\u00e9 confirm\u00e9 pour tes matchs."}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
