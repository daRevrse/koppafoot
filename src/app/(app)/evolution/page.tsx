"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Rocket, User, Briefcase, ArrowLeft, ArrowRight, Loader2,
  Check, Circle, CheckCircle2, Trophy, Pencil, RefreshCw, Mail,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { EvolutionRole, FirestoreUser } from "@/types";

// ============================================
// Évolution — role onboarding. Proposes the available roles (Joueur,
// Manager), walks the user through activating one and completing the
// matching profile fields. Once activated the same route becomes the
// role home ("Espace joueur" / "Espace manager") — the sidebar entry
// re-labels itself accordingly.
// ============================================

const ROLES: {
  role: EvolutionRole;
  title: string;
  Icon: typeof User;
  tagline: string;
  perks: string[];
}[] = [
  {
    role: "player",
    title: "Joueur",
    Icon: User,
    tagline: "Tu joues dans une équipe (ou tu veux en rejoindre une).",
    perks: [
      "Ton profil sportif : poste, pied fort, ville",
      "Retrouve-toi sur les feuilles de match des compétitions",
      "Tes stats (buts, matchs) au fil des compétitions",
    ],
  },
  {
    role: "manager",
    title: "Manager",
    Icon: Briefcase,
    tagline: "Tu diriges une équipe et son effectif.",
    perks: [
      "Deviens propriétaire d'une équipe de compétition",
      "Réponds aux invitations des organisateurs",
      "Gère ton effectif et tes compositions",
    ],
  },
];

const POSITIONS = [
  { value: "goalkeeper", label: "Gardien" },
  { value: "defender", label: "Défenseur" },
  { value: "midfielder", label: "Milieu" },
  { value: "forward", label: "Attaquant" },
];

const FEET = [
  { value: "right", label: "Droit" },
  { value: "left", label: "Gauche" },
  { value: "both", label: "Les deux" },
];

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-colors";

function ChoicePills({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
            value === opt.value
              ? "bg-emerald-500 text-white"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function EvolutionPage() {
  const { user, updateProfile } = useAuth();

  // null = show role home (if activated) or selection; otherwise onboarding.
  const [picking, setPicking] = useState<EvolutionRole | null>(null);
  const [switching, setSwitching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state (prefilled from the profile).
  const [position, setPosition] = useState(user?.position ?? "");
  const [strongFoot, setStrongFoot] = useState(user?.strongFoot ?? "");
  const [teamName, setTeamName] = useState(user?.teamName ?? "");
  const [city, setCity] = useState(user?.locationCity ?? "");

  if (!user) return null;

  const activated = user.evolutionRole ?? null;
  const showSelection = (!activated || switching) && !picking;

  const activate = async (role: EvolutionRole) => {
    setSubmitting(true);
    try {
      const patch: Partial<FirestoreUser> = {
        evolution_role: role,
        location_city: city.trim() || user.locationCity || "",
      };
      // Organizer/superadmin keep their privileged user_type; everyone
      // else's account type follows the activated role (legacy model).
      if (user.userType !== "organizer" && user.userType !== "superadmin") {
        patch.user_type = role;
      }
      if (role === "player") {
        if (position) patch.position = position;
        if (strongFoot) patch.strong_foot = strongFoot as FirestoreUser["strong_foot"];
      } else {
        if (teamName.trim()) patch.team_name = teamName.trim();
      }
      await updateProfile(patch);
      toast.success(role === "player" ? "Espace joueur activé !" : "Espace manager activé !");
      setPicking(null);
      setSwitching(false);
    } catch (err) {
      console.error("Evolution activate failed:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Role home (activated) ──────────────────────────────────
  if (activated && !switching && !picking) {
    const isPlayer = activated === "player";
    const checklist = isPlayer
      ? [
          { label: "Photo de profil", done: !!user.profilePictureUrl },
          { label: "Poste préféré", done: !!user.position },
          { label: "Pied fort", done: !!user.strongFoot },
          { label: "Ville", done: !!user.locationCity },
          { label: "Bio", done: !!user.bio },
        ]
      : [
          { label: "Photo de profil", done: !!user.profilePictureUrl },
          { label: "Nom d'équipe", done: !!user.teamName },
          { label: "Ville", done: !!user.locationCity },
          { label: "Contact (téléphone)", done: !!user.phone },
        ];
    const doneCount = checklist.filter((c) => c.done).length;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              {isPlayer ? <User size={26} /> : <Briefcase size={26} />}
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-black tracking-tight text-gray-900">
                {isPlayer ? "Espace joueur" : "Espace manager"}
              </h1>
              <p className="mt-0.5 text-sm font-bold text-gray-400">
                {isPlayer
                  ? "Ton profil sportif est actif."
                  : "Ton profil manager est actif."}
              </p>
            </div>
          </div>

          {/* Completion checklist */}
          <div className="mt-6 rounded-2xl bg-gray-50 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                Compte complété
              </p>
              <span className="text-xs font-black text-emerald-600">
                {doneCount}/{checklist.length}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(doneCount / checklist.length) * 100}%` }}
              />
            </div>
            <ul className="mt-4 space-y-2.5">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2.5 text-sm font-bold">
                  {item.done ? (
                    <CheckCircle2 size={17} className="shrink-0 text-emerald-500" />
                  ) : (
                    <Circle size={17} className="shrink-0 text-gray-300" />
                  )}
                  <span className={item.done ? "text-gray-700" : "text-gray-400"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/profile"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600"
            >
              <Pencil size={14} />
              Compléter mon profil
            </Link>
          </div>

          {/* Role-specific next steps */}
          <div className="mt-6 space-y-3">
            {!isPlayer && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <Mail size={17} className="mt-0.5 shrink-0 text-amber-500" />
                <p className="text-sm font-semibold leading-relaxed text-amber-800">
                  Un organisateur peut t&apos;inviter à prendre la gestion d&apos;une équipe
                  de sa compétition — tu recevras l&apos;invitation par email et dans tes
                  notifications.
                </p>
              </div>
            )}
            <Link
              href="/competitions"
              className="flex items-center justify-between rounded-2xl border border-gray-100 p-4 transition-colors hover:bg-gray-50"
            >
              <span className="flex items-center gap-3 text-sm font-bold text-gray-700">
                <Trophy size={17} className="text-emerald-500" />
                Suivre les compétitions
              </span>
              <ArrowRight size={16} className="text-gray-300" />
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSwitching(true)}
          className="mx-auto flex items-center gap-2 text-xs font-bold text-gray-400 transition-colors hover:text-gray-600"
        >
          <RefreshCw size={13} />
          Changer de rôle
        </button>
      </div>
    );
  }

  // ── Role selection ─────────────────────────────────────────
  if (showSelection) {
    return (
      <div className="mx-auto max-w-2xl">
        {switching && (
          <button
            type="button"
            onClick={() => setSwitching(false)}
            className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-gray-400 transition-colors hover:text-gray-600"
          >
            <ArrowLeft size={15} />
            Retour à mon espace
          </button>
        )}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
            <Rocket size={26} />
          </div>
          <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-gray-900">
            Fais évoluer ton compte
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-bold text-gray-400">
            Choisis ton rôle sur le terrain : on active ton espace et on
            t&apos;accompagne pour compléter ton compte.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {ROLES.map(({ role, title, Icon, tagline, perks }, i) => (
            <motion.button
              key={role}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => setPicking(role)}
              className={`group rounded-[2rem] border-2 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                activated === role
                  ? "border-emerald-400"
                  : "border-transparent hover:border-emerald-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                  <Icon size={22} />
                </div>
                {activated === role && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-600">
                    Actif
                  </span>
                )}
              </div>
              <p className="mt-4 font-display text-lg font-black text-gray-900">{title}</p>
              <p className="mt-1 text-xs font-bold leading-relaxed text-gray-400">{tagline}</p>
              <ul className="mt-4 space-y-2">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-xs font-semibold text-gray-500">
                    <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                    {perk}
                  </li>
                ))}
              </ul>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-emerald-600">
                {activated === role ? "Mettre à jour" : "Choisir ce rôle"}
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  // ── Onboarding form for the picked role ────────────────────
  const isPlayerForm = picking === "player";
  return (
    <div className="mx-auto max-w-lg">
      <button
        type="button"
        onClick={() => setPicking(null)}
        className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-gray-400 transition-colors hover:text-gray-600"
      >
        <ArrowLeft size={15} />
        Changer de rôle
      </button>

      <AnimatePresence mode="wait">
        <motion.div
          key={picking}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              {isPlayerForm ? <User size={20} /> : <Briefcase size={20} />}
            </div>
            <div>
              <h2 className="font-display text-xl font-black text-gray-900">
                {isPlayerForm ? "Ton profil joueur" : "Ton profil manager"}
              </h2>
              <p className="text-xs font-bold text-gray-400">
                Tout est modifiable plus tard dans ton profil.
              </p>
            </div>
          </div>

          <form
            className="mt-6 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (picking) activate(picking);
            }}
          >
            {isPlayerForm ? (
              <>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-400">
                    Ton poste
                  </label>
                  <ChoicePills options={POSITIONS} value={position} onChange={setPosition} />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-400">
                    Pied fort
                  </label>
                  <ChoicePills options={FEET} value={strongFoot} onChange={setStrongFoot} />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-400">
                  Nom de ton équipe <span className="font-bold normal-case text-gray-300">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="ex: FC Étoile"
                  className={inputClass}
                />
                <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-gray-400">
                  Pas d&apos;équipe ? Un organisateur pourra t&apos;inviter à gérer une
                  équipe de sa compétition.
                </p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-400">
                Ta ville
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="ex: Lomé"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              {isPlayerForm ? "Activer mon espace joueur" : "Activer mon espace manager"}
            </button>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
