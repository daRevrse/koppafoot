"use client";

import Link from "next/link";
import {
  Award, Building2, Cake, Flag, Footprints, Ruler, Shirt, Star, Users, Weight,
  type LucideIcon,
} from "lucide-react";
import { BadgeCondition, BadgeForme, FriseDesNotes } from "@/components/forme/badges";
import { conditionEnVigueur, MATCHS_NOTES_MINIMUM, type FormeJoueur } from "@/lib/etat-de-forme";
import { isVenueOwner } from "@/lib/hats";
import type { UserProfile } from "@/types";
import { useLocale, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { accorder, type Genre } from "@/lib/genre";

// ============================================
// La fiche publique en une carte.
//
// IL Y AVAIT UN ONGLET « APERÇU » SOUS CETTE CARTE, et il répétait surtout
// ce qu'elle disait déjà : le taux de victoire du manager en plus grand,
// l'« équipe principale » que les écussons montrent, quatre tuiles pour
// quatre mensurations, une carte d'état de forme de deux colonnes. Tout ce
// qui compte tient ici, rangé par ordre de lecture :
//
//   1. qui il représente et comment il va — les écussons, la forme ;
//   2. ses chiffres — trois cases, les mêmes pour chaque rôle ;
//   3. le reste en une ligne — niveau, pied, taille, licence…
//
// UNE CARTE PAR RÔLE, UN SEUL DESSIN. Le rôle choisi dans Évolution décide
// des chiffres ; un compte qui en tient un second (un manager qui joue) le
// voit résumé dans la ligne du bas, plutôt qu'une deuxième carte.
// ============================================

/**
 * Une équipe telle que /api/public/profile/[uid] la projette : ce qui
 * s'affiche, et rien de plus.
 */
export interface EquipePubliee {
  id: string;
  name: string;
  city: string | null;
  /** Une CLÉ de palette (« emerald », « blue »…), jamais une couleur CSS. */
  color: string | null;
  logoUrl: string | null;
  wins: number;
  draws: number;
  losses: number;
  matchesPlayed: number;
  /** Ce joueur dirige-t-il cette équipe ? Calculé par l'endpoint. */
  isManager?: boolean;
}

/** Le bilan d'un arbitre, calculé par /api/public/profile/[uid]. */
export interface BilanArbitre {
  matchs: number;
  note: number | null;
  avis: number;
  /** Son corps arbitral, s'il en a un : nom, et s'il le dirige. */
  corps?: { nom: string; chef: boolean; membres: number } | null;
}

type Role = "player" | "manager" | "referee";

const T = textes(
  {
    niveau: (n: string) => ({ beginner: "Débutant", amateur: "Amateur", intermediate: "Intermédiaire", advanced: "Confirmé" } as Record<string, string>)[n] ?? n,
    licence: (l: string) => {
      const nom = ({ trainee: "Stagiaire", regional: "Régionale", national: "Nationale", international: "Internationale" } as Record<string, string>)[l] ?? l;
      return `Licence ${nom.toLowerCase()}`;
    },
    pied: (p: string) => ({ left: "Pied gauche", right: "Pied droit", both: "Deux pieds" } as Record<string, string>)[p] ?? p,
    equipes: "Équipes",
    forme: "Forme",
    pasDeMatchNote: "Pas encore de match noté",
    ilFaut: (n: number) => `Il faut ${n} matchs notés pour la calculer`,
    matchs: "Matchs",
    buts: "Buts",
    passesDec: "Passes déc.",
    pourcentVict: "% vict.",
    victoiresSur: (v: number, n: number) => `${v} V sur ${n}`,
    matchsArbitres: "Matchs arbitrés",
    noteSur5: "Note /5",
    avis: (n: number) => `${n} avis`,
    pasEncoreNote: "pas encore noté",
    experience: (n: number) => (n > 1 ? "Ans d'expérience" : "An d'expérience"),
    ans: (n: number) => `${n} ans`,
    corps: (chef: boolean, nom: string) => `${chef ? "Dirige" : "Membre de"} « ${nom} »`,
    joueurSecond: (n: number, genre: Genre | null | undefined) =>
      `${accorder(genre, "Joueur", "Joueuse")} · ${n} match${n > 1 ? "s" : ""}`,
    managerSecond: (pct: number, n: number) => `Manager · ${pct} % de victoires sur ${n} match${n > 1 ? "s" : ""}`,
    manager: "Manager",
    arbitreSecond: (n: number) => `Arbitre · ${n} match${n > 1 ? "s" : ""} arbitré${n > 1 ? "s" : ""}`,
    arbitre: "Arbitre",
  },
  {
    niveau: (n: string) => ({ beginner: "Beginner", amateur: "Amateur", intermediate: "Intermediate", advanced: "Experienced" } as Record<string, string>)[n] ?? n,
    licence: (l: string) => {
      const nom = ({ trainee: "Trainee", regional: "Regional", national: "National", international: "International" } as Record<string, string>)[l] ?? l;
      return `${nom} licence`;
    },
    pied: (p: string) => ({ left: "Left-footed", right: "Right-footed", both: "Two-footed" } as Record<string, string>)[p] ?? p,
    equipes: "Teams",
    forme: "Form",
    pasDeMatchNote: "No rated match yet",
    ilFaut: (n: number) => `${n} rated matches needed to calculate it`,
    matchs: "Matches",
    buts: "Goals",
    passesDec: "Assists",
    pourcentVict: "Win %",
    victoiresSur: (v: number, n: number) => `${v} W out of ${n}`,
    matchsArbitres: "Matches refereed",
    noteSur5: "Rating /5",
    avis: (n: number) => `${n} review${n === 1 ? "" : "s"}`,
    pasEncoreNote: "not rated yet",
    experience: (n: number) => (n === 1 ? "Year of experience" : "Years of experience"),
    ans: (n: number) => `${n} years old`,
    corps: (chef: boolean, nom: string) => `${chef ? "Leads" : "Member of"} “${nom}”`,
    joueurSecond: (n: number) => `Player · ${n} match${n === 1 ? "" : "es"}`,
    managerSecond: (pct: number, n: number) => `Manager · ${pct}% wins over ${n} match${n === 1 ? "" : "es"}`,
    manager: "Manager",
    arbitreSecond: (n: number) => `Referee · ${n} match${n === 1 ? "" : "es"} refereed`,
    arbitre: "Referee",
  },
);

function age(dateDeNaissance: string | null | undefined): number | null {
  if (!dateDeNaissance) return null;
  const naissance = new Date(dateDeNaissance);
  if (Number.isNaN(naissance.getTime())) return null;
  const auj = new Date();
  let a = auj.getFullYear() - naissance.getFullYear();
  const m = auj.getMonth() - naissance.getMonth();
  if (m < 0 || (m === 0 && auj.getDate() < naissance.getDate())) a--;
  return a;
}


/**
 * Les rôles tenus, le principal d'abord.
 *
 * Deux signaux, comme partout sur la fiche : le rôle Évolution quand il
 * existe, le type de compte pour les comptes anciens qui n'en ont jamais
 * choisi. Un organisateur qui joue est un joueur.
 */
export function rolesDuProfil(profile: UserProfile): Role[] {
  const tient = (r: Role) => profile.evolutionRole === r || profile.userType === r;
  const tous = (["player", "manager", "referee"] as const).filter(tient);
  const principal = profile.evolutionRole ?? profile.userType;
  return [...tous].sort((a, b) => Number(b === principal) - Number(a === principal));
}

// ─── Les briques ────────────────────────────────────────────────────────

function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
      {children}
    </span>
  );
}

/**
 * LES ÉCUSSONS. On reconnaît un joueur à ses couleurs avant de lire ses
 * chiffres. Quatre au plus, et le reste en nombre : au-delà, la rangée ne
 * tient plus sur un téléphone.
 *
 * CHAQUE ÉCUSSON EST UN LIEN : c'est le seul chemin de la fiche vers le club.
 */
function CaseEquipes({ teams }: { teams: EquipePubliee[] }) {
  const t = useTextes(T);
  const montres = teams.slice(0, 4);
  const reste = teams.length - montres.length;
  return (
    <div className="flex w-full min-w-0 items-center gap-3 px-5 py-4 sm:w-auto sm:shrink-0">
      <Etiquette>{t.equipes}</Etiquette>
      {/* `hover:z-10` pour que celui qu'on survole passe devant ses voisins,
          qui le chevauchent. */}
      <div className="flex items-center -space-x-2">
        {montres.map((e) => (
          <Link
            key={e.id}
            href={`/teams/${e.id}`}
            title={e.name}
            aria-label={e.name}
            className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gray-100 text-[10px] font-black text-gray-500 transition-transform hover:z-10 hover:scale-110"
          >
            {e.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              e.name.slice(0, 2).toUpperCase()
            )}
          </Link>
        ))}
        {reste > 0 && (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gray-900 text-[10px] font-black text-white">
            +{reste}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * LA FORME, EN UNE CASE : la condition déclarée, la forme calculée, et les
 * notes des derniers matchs, chacune menant au match qu'elle résume. Le
 * détail — depuis quand, jusqu'à quand — est dans l'infobulle des pastilles.
 *
 * La condition n'apparaît qu'aux connectés : elle vit sur `users`, fermé aux
 * visiteurs, et la projection publique ne la porte pas.
 */
function CaseForme({
  forme, formeChargee, condition,
}: {
  forme: FormeJoueur | null;
  formeChargee: boolean;
  condition: UserProfile["condition"];
}) {
  const t = useTextes(T);
  const matchs = forme?.matchs ?? [];
  const aDire = Boolean(conditionEnVigueur(condition) || forme?.niveau);
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <Etiquette>{t.forme}</Etiquette>
        {aDire ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <BadgeCondition condition={condition} apte />
            <BadgeForme forme={forme} />
          </span>
        ) : formeChargee ? (
          <span className="text-[11px] font-bold text-gray-400">
            {matchs.length === 0 ? t.pasDeMatchNote : t.ilFaut(MATCHS_NOTES_MINIMUM)}
          </span>
        ) : null}
      </div>
      {matchs.length > 0 && <FriseDesNotes matchs={matchs} className="sm:ml-auto" />}
    </div>
  );
}

function CaseChiffre({
  label, valeur, suffixe, detail,
}: {
  label: string;
  valeur: number | string;
  suffixe?: string;
  /** Ce qui fonde le chiffre, en petit dessous : « 20 V sur 39 ». */
  detail?: string | null;
}) {
  return (
    <div className="px-3 py-5 text-center">
      <span className="block font-display text-3xl font-black tabular-nums leading-none text-gray-900 sm:text-4xl">
        {valeur}{suffixe}
      </span>
      <span className="mt-2 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
        {label}
      </span>
      {detail && (
        <span className="mt-1 block text-[10px] font-bold tabular-nums text-gray-400">{detail}</span>
      )}
    </div>
  );
}

interface Attribut {
  Icone: LucideIcon;
  texte: string;
  /** L'attribut qui dit le niveau : il se détache du reste. */
  fort?: boolean;
}

// ─── La carte ───────────────────────────────────────────────────────────

export default function BilanDuProfil({
  profile, teams, arbitrage, forme, formeChargee,
}: {
  profile: UserProfile;
  teams: EquipePubliee[];
  arbitrage: BilanArbitre | null;
  forme: FormeJoueur | null;
  formeChargee: boolean;
}) {
  const t = useTextes(T);
  const locale = useLocale();
  const virgule = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const roles = rolesDuProfil(profile);
  const principal = roles[0] ?? null;

  // Le bilan d'un manager se lit sur ses équipes, pas sur `users` : ce sont
  // elles qui le portent, et la projection publique les sert déjà.
  const matchsDiriges = teams.reduce((n, e) => n + e.matchesPlayed, 0);
  const victoires = teams.reduce((n, e) => n + e.wins, 0);
  const pourcent = matchsDiriges > 0 ? Math.round((victoires / matchsDiriges) * 100) : 0;

  // ─── 2. Les chiffres du rôle principal ───
  let chiffres: React.ReactNode = null;
  if (principal === "player") {
    chiffres = (
      <div className="grid grid-cols-3 divide-x divide-gray-200/70">
        <CaseChiffre label={t.matchs} valeur={profile.matchesPlayed ?? 0} />
        <CaseChiffre label={t.buts} valeur={profile.goals ?? 0} />
        <CaseChiffre label={t.passesDec} valeur={profile.assists ?? 0} />
      </div>
    );
  } else if (principal === "manager") {
    chiffres = (
      <div className="grid grid-cols-3 divide-x divide-gray-200/70">
        <CaseChiffre label={t.equipes} valeur={teams.length} />
        <CaseChiffre label={t.matchs} valeur={matchsDiriges} />
        <CaseChiffre
          label={t.pourcentVict}
          valeur={pourcent}
          suffixe="%"
          detail={matchsDiriges > 0 ? t.victoiresSur(victoires, matchsDiriges) : null}
        />
      </div>
    );
  } else if (principal === "referee" && arbitrage) {
    const experience = typeof profile.experienceYears === "number" ? profile.experienceYears : null;
    chiffres = (
      <div className={`grid divide-x divide-gray-200/70 ${experience !== null ? "grid-cols-3" : "grid-cols-2"}`}>
        <CaseChiffre label={t.matchsArbitres} valeur={arbitrage.matchs} />
        <CaseChiffre
          label={t.noteSur5}
          valeur={arbitrage.note !== null ? virgule(arbitrage.note) : "–"}
          detail={arbitrage.note !== null ? t.avis(arbitrage.avis) : t.pasEncoreNote}
        />
        {experience !== null && (
          <CaseChiffre label={t.experience(experience)} valeur={experience} />
        )}
      </div>
    );
  }

  // ─── 3. Le reste, en une ligne ───
  const attributs: Attribut[] = [];
  if (principal === "player") {
    const niveau = profile.skillLevel ? t.niveau(profile.skillLevel) : null;
    const ans = age(profile.dateOfBirth);
    if (niveau) attributs.push({ Icone: Star, texte: niveau, fort: true });
    if (profile.strongFoot) attributs.push({ Icone: Footprints, texte: t.pied(profile.strongFoot) });
    if (profile.height) attributs.push({ Icone: Ruler, texte: `${profile.height} cm` });
    if (profile.weight) attributs.push({ Icone: Weight, texte: `${profile.weight} kg` });
    if (ans !== null) attributs.push({ Icone: Cake, texte: t.ans(ans) });
  }
  if (principal === "referee") {
    if (profile.licenseLevel) attributs.push({ Icone: Award, texte: t.licence(profile.licenseLevel), fort: true });
    if (arbitrage?.corps) {
      attributs.push({
        Icone: Users,
        texte: t.corps(arbitrage.corps.chef, arbitrage.corps.nom),
      });
    }
  }
  // Le rôle second, résumé : il n'a pas sa carte, il a sa ligne.
  for (const r of roles.slice(1)) {
    if (r === "player") {
      attributs.push({ Icone: Shirt, texte: t.joueurSecond(profile.matchesPlayed ?? 0, profile.gender) });
    } else if (r === "manager" && matchsDiriges > 0) {
      attributs.push({ Icone: Users, texte: t.managerSecond(pourcent, matchsDiriges) });
    } else if (r === "manager") {
      attributs.push({ Icone: Users, texte: t.manager });
    } else if (r === "referee") {
      attributs.push({
        Icone: Flag,
        texte: arbitrage ? t.arbitreSecond(arbitrage.matchs) : t.arbitre,
      });
    }
  }
  if (isVenueOwner(profile) && profile.companyName) {
    attributs.push({ Icone: Building2, texte: profile.companyName });
  }

  // ─── 1. Les écussons et la forme ───
  // La forme d'un joueur, toujours ; celle d'un rôle second seulement quand
  // il a joué : « pas encore de match noté » sur un manager, c'est du bruit.
  const avecForme = principal === "player"
    || (roles.includes("player") && (forme?.matchs.length ?? 0) > 0);
  const hautDeCarte = teams.length > 0 || avecForme;

  if (!hautDeCarte && !chiffres && attributs.length === 0) return null;

  return (
    <section className="mt-6 divide-y divide-gray-200/70 border border-gray-200/70 bg-white">
      {hautDeCarte && (
        // Sur un téléphone, les écussons et la forme s'empilent ; au-delà,
        // ils partagent la rangée.
        <div className="flex flex-wrap items-stretch divide-y divide-gray-200/70 sm:flex-nowrap sm:divide-x sm:divide-y-0">
          {teams.length > 0 && <CaseEquipes teams={teams} />}
          {avecForme && <CaseForme forme={forme} formeChargee={formeChargee} condition={profile.condition} />}
        </div>
      )}

      {chiffres}

      {attributs.length > 0 && (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3">
          {attributs.map(({ Icone, texte, fort }) => (
            <li
              key={texte}
              className={`flex items-center gap-1.5 text-[12px] font-bold ${fort ? "text-amber-700" : "text-gray-600"}`}
            >
              <Icone size={14} className={fort ? "text-amber-500" : "text-gray-300"} />
              {texte}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
