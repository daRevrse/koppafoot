"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Rocket, User, Briefcase, ArrowLeft, ArrowRight, Loader2,
  Check, Trophy, RefreshCw, Mail,
  Store, ClipboardCheck, BarChart3, CalendarDays, Users, Swords, Lock,
  Search, FileText, Flag,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRoleOnboarding } from "@/hooks/useRoleOnboarding";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import type { EvolutionRole, FirestoreUser } from "@/types";

// ============================================
// Évolution, role onboarding. Proposes the available roles (Joueur,
// Manager), walks the user through activating one and completing the
// matching profile fields. Once activated the same route becomes the
// role home ("Espace joueur" / "Espace manager"), the sidebar entry
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
  {
    role: "referee",
    title: "Arbitre",
    Icon: Flag,
    tagline: "Tu tiens le sifflet.",
    perks: [
      "Ta fiche d'arbitre : licence, niveau, ville",
      "Tu apparais dans la recherche, catégorie Arbitres",
      "Les organisateurs te trouvent et te contactent",
    ],
  },
];

// Feature map of each espace, mirrors the shelved verticals (src/app/_shelved)
// that come back one by one: set `href` when a vertical is unfrozen and the
// row flips from a "Bientôt" teaser to a real link.
const ROLE_FEATURES: Record<EvolutionRole, {
  label: string;
  desc: string;
  Icon: typeof User;
  href?: string;
}[]> = {
  player: [
    { label: "Mes équipes", desc: "Les équipes dont tu fais partie", Icon: Users, href: "/teams" },
    { label: "Mes statistiques", desc: "Buts, cartons et matchs joués en compétition", Icon: BarChart3, href: "/stats" },
    { label: "Mercato", desc: "Trouve une équipe qui recrute près de chez toi", Icon: Store, href: "/mercato" },
    { label: "Mes matchs & convocations", desc: "Réponds aux convocations et suis tes matchs", Icon: ClipboardCheck, href: "/participations" },
    { label: "Mon calendrier", desc: "Tes matchs et entraînements en un coup d'œil", Icon: CalendarDays, href: "/calendar" },
  ],
  manager: [
    { label: "Mon équipe", desc: "Effectif permanent, entraînements, palmarès", Icon: Users, href: "/teams" },
    { label: "Mes compétitions", desc: "Effectif engagé, rattachements et stats", Icon: Trophy, href: "/mon-equipe" },
    { label: "Mercato", desc: "Recrute des joueurs, gère shortlist et candidatures", Icon: Store, href: "/mercato" },
    { label: "Défis & matchs amicaux", desc: "Défie d'autres équipes et planifie tes matchs", Icon: Swords, href: "/matches" },
    { label: "Mon calendrier", desc: "Tes matchs et entraînements en un coup d'œil", Icon: CalendarDays, href: "/calendar" },
  ],
  // L'arbitre vient d'etre degele : sa fiche et sa visibilite existent
  // aujourd'hui, ses ecrans propres (designations, rapports) sont encore au
  // placard, d'ou l'absence de `href`, qui les affiche en « Bientot » plutot
  // que de promettre une page qui n'ouvre pas.
  referee: [
    { label: "Ma fiche d'arbitre", desc: "Licence, niveau et coordonnées visibles par les organisateurs", Icon: User, href: "/profile" },
    { label: "Être trouvé", desc: "Tu apparais dans la recherche, catégorie Arbitres", Icon: Search, href: "/" },
    { label: "Mon calendrier", desc: "Tes matchs et rendez-vous en un coup d'œil", Icon: CalendarDays, href: "/calendar" },
    { label: "Mes désignations", desc: "Les matchs sur lesquels on te désigne", Icon: ClipboardCheck },
    { label: "Mes rapports de match", desc: "Feuille de match et rapport après rencontre", Icon: FileText },
  ],
};

/** Ce qui distingue chaque espace : son nom, son icone, sa phrase. */
const ROLE_META: Record<EvolutionRole, { space: string; profile: string; tagline: string; Icon: typeof User }> = {
  player: { space: "Espace joueur", profile: "Ton profil joueur", tagline: "Ton profil sportif est actif.", Icon: User },
  manager: { space: "Espace manager", profile: "Ton profil manager", tagline: "Ton profil manager est actif.", Icon: Briefcase },
  referee: { space: "Espace arbitre", profile: "Ton profil arbitre", tagline: "Ton profil d'arbitre est actif.", Icon: Flag },
};



const LICENSE_LEVELS = [
  { value: "trainee", label: "Stagiaire" },
  { value: "regional", label: "Régional" },
  { value: "national", label: "National" },
  { value: "international", label: "International" },
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
  "w-full border border-gray-200/70 bg-white px-4 py-3 text-sm font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-300 focus:border-gray-900 focus:outline-none transition-colors";

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
          className={`border px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
            value === opt.value
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
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
  const onboarding = useRoleOnboarding();

  // null = show role home (if activated) or selection; otherwise onboarding.
  const [picking, setPicking] = useState<EvolutionRole | null>(null);
  const [switching, setSwitching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state (prefilled from the profile).
  const [position, setPosition] = useState(user?.position ?? "");
  const [strongFoot, setStrongFoot] = useState(user?.strongFoot ?? "");
  const [teamName, setTeamName] = useState(user?.teamName ?? "");
  const [licenseLevel, setLicenseLevel] = useState(user?.licenseLevel ?? "");
  const [licenseNumber, setLicenseNumber] = useState(user?.licenseNumber ?? "");
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
      } else if (role === "referee") {
        if (licenseLevel) patch.license_level = licenseLevel;
        if (licenseNumber.trim()) patch.license_number = licenseNumber.trim();
      } else {
        if (teamName.trim()) patch.team_name = teamName.trim();
      }
      await updateProfile(patch);

      toast.success(`${ROLE_META[role].space} activé !`);
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
    // Un seul point de verite pour « quel espace suis-je en train de
    // montrer ». Douze conditions binaires joueur/manager vivaient ici : un
    // troisieme role les aurait toutes fait mentir.
    // Meme precaution qu'ailleurs : un role stocke peut ne plus exister dans
    // le type. Sans repli, la page entiere plante sur une valeur heritee.
    const meta = ROLE_META[activated];
    if (!meta) {
      return (
        <div className="mx-auto max-w-2xl border border-gray-200/70 bg-white p-8 text-center">
          <p className="font-display text-lg font-black text-gray-900">Rôle à réactiver</p>
          <p className="mt-2 text-sm text-gray-500">
            Ton rôle n&apos;existe plus sous cette forme. Choisis-en un ci-dessous.
          </p>
          <button
            type="button"
            onClick={() => setSwitching(true)}
            className="mt-5 inline-flex border border-gray-900 bg-gray-900 px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
          >
            Choisir mon rôle
          </button>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className=" border border-gray-200/70 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-emerald-50 text-emerald-500">
              <meta.Icon size={26} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-black tracking-tight text-gray-900">
                {meta.space}
              </h1>
              <p className="mt-0.5 text-sm font-bold text-gray-400">{meta.tagline}</p>
            </div>
          </div>

          {/* Guided onboarding, steps come from lib/onboarding.ts and are
              derived from live data, so the list can't drift from reality. */}
          <div className="mt-6">
            {onboarding ? (
              <OnboardingChecklist progress={onboarding} />
            ) : (
              <div className="h-32 animate-pulse bg-gray-50" />
            )}
          </div>

          {/* Role-specific next steps. "Suivre les compétitions" used to sit
              here; it duplicated the sidebar entry and pushed the real
              features down. */}
          {activated === "manager" && (
            <div className="mt-6 flex items-start gap-3 border border-amber-100 bg-amber-50 p-4">
              <Mail size={17} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-sm font-semibold leading-relaxed text-amber-800">
                Un organisateur peut t&apos;inviter à prendre la gestion d&apos;une équipe
                de sa compétition, tu recevras l&apos;invitation par email et dans tes
                notifications.
              </p>
            </div>
          )}

          {/* The role's features, unfrozen one by one */}
          <div className="mt-8">
            <p className="px-1 text-xs font-black uppercase tracking-widest text-gray-400">
              {meta.space}
            </p>
            <p className="mt-1 px-1 text-xs font-semibold text-gray-400">
              Ces fonctionnalités arrivent progressivement.
            </p>
            <div className="mt-3 space-y-2.5">
              {(ROLE_FEATURES[activated] ?? []).map(({ label, desc, Icon, href }) =>
                href ? (
                  <Link
                    key={label}
                    href={href}
                    className="flex items-center gap-4 border border-gray-200/70 p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-emerald-50 text-emerald-500">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-gray-900">{label}</p>
                      <p className="mt-0.5 text-xs font-semibold text-gray-400">{desc}</p>
                    </div>
                    <ArrowRight size={16} className="shrink-0 text-gray-300" />
                  </Link>
                ) : (
                  <div
                    key={label}
                    className="flex items-center gap-4 border border-dashed border-gray-200/70 bg-gray-50/60 p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-gray-100 text-gray-400">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-gray-500">{label}</p>
                      <p className="mt-0.5 text-xs font-semibold text-gray-400">{desc}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 border border-gray-200/70 bg-gray-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-gray-500">
                      <Lock size={10} />
                      Bientôt
                    </span>
                  </div>
                ),
              )}
            </div>
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
          <div className="mx-auto flex h-14 w-14 items-center justify-center bg-emerald-50 text-emerald-500">
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map(({ role, title, Icon, tagline, perks }, i) => (
            <motion.button
              key={role}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => setPicking(role)}
              className={`group border-2 bg-white p-6 text-left transition-all hover:-translate-y-0.5 ${
                activated === role
                  ? "border-emerald-400"
                  : "border-transparent hover:border-emerald-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center bg-emerald-50 text-emerald-500 transition-colors group-hover:bg-emerald-500 group-hover:text-white">
                  <Icon size={22} />
                </div>
                {activated === role && (
                  <span className="border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
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
  // Le formulaire suit le role choisi, sans supposer qu'il n'y en a que deux.
  const formMeta = picking ? ROLE_META[picking] : null;
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
          className=" border border-gray-200/70 bg-white p-6 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-emerald-50 text-emerald-500">
              {formMeta && <formMeta.Icon size={20} />}
            </div>
            <div>
              <h2 className="font-display text-xl font-black text-gray-900">
                {formMeta?.profile}
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
            {picking === "player" ? (
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
            ) : picking === "referee" ? (
              <>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wide text-gray-400">
                    Ton niveau de licence
                  </label>
                  <ChoicePills options={LICENSE_LEVELS} value={licenseLevel} onChange={setLicenseLevel} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-gray-400">
                    Numéro de licence <span className="font-bold normal-case text-gray-300">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="ex: TG-2024-0182"
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-[11px] font-semibold leading-relaxed text-gray-400">
                    Personne ne vérifie ce numéro aujourd&apos;hui : il sert aux
                    organisateurs qui te contactent, pas à te valider.
                  </p>
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
                placeholder="Ta ville"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 bg-emerald-500 px-4 py-3.5 text-sm font-black text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
              Activer mon {formMeta?.space.toLowerCase()}
            </button>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
