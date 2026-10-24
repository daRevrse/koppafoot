"use client";

import { useId, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Download, Share } from "lucide-react";
import { useLangue, useT, useTextes, type Langue } from "@/i18n";
import { textes } from "@/i18n/textes";
import { VITRINES } from "@/config/vitrines";
import {
  etatInstallation, etatInstallationServeur, installer, souscrireInstallation,
} from "@/lib/pwa-install";

// ============================================
// Le pied de page, le même partout.
//
// LES PAGES S'ARRÊTAIENT NET. Le Direct, une fiche de match, une compétition
// finissaient sur leur dernière ligne, et rien ne disait qui tient le site,
// comment le joindre ni où lire ses conditions. Les vitrines avaient leur
// pied à elles ; celui-ci le remplace, et sert aussi à l'application.
//
// L'ALLURE EST CELLE DES FLYERS qu'on partage (lib/og-da) : la bande
// d'éclats verts, la carte nuit, le nom en très grand, fendu en diagonale.
// Le nom garde la police du produit (Outfit), pas l'Anton des affiches.
//
// SOMBRE DANS LES DEUX THÈMES. Ses couleurs sont écrites en dur et
// échappent donc à styles/dark.css. En thème sombre la page a déjà la
// couleur de la carte : c'est la bande d'éclats qui dit où elle finit.
//
// OÙ IL N'EST PAS : la console du direct, l'administration et la connexion
// ont leur propre cadre et ne le montent pas. Dans l'application installée
// sur l'écran d'accueil, il ne s'affiche pas non plus (`.pied-de-page`, voir
// globals.css) : on y est dans une appli, et lui proposer de s'installer
// n'aurait pas de sens. C'est une requête média, pas un test en JavaScript,
// pour que le premier rendu soit déjà le bon.
// ============================================

const T = textes(
  {
    accroche: "Le football amateur en temps réel.",
    sur: (reseau: string) => `KoppaFoot sur ${reseau}`,
    whatsapp: "Suivre KoppaFoot sur WhatsApp",
    aide: "Aide",
    tutoriels: "Tutoriels",
    questions: "Questions fréquentes",
    questionsCourt: "Questions",
    ecrire: "Nous écrire",
    cadre: "Le cadre",
    conditions: "Conditions d'utilisation",
    conditionsCourt: "Conditions",
    confidentialite: "Confidentialité",
    appli: "L'appli KoppaFoot",
    bientot: "Bientôt sur Android et iPhone",
    enAttendant:
      "En attendant, installe la version web : elle s'ouvre depuis ton écran d'accueil, comme une appli, avec les notifications de tes matchs.",
    commentInstaller: "Comment installer ?",
    langue: "Langue",
  },
  {
    accroche: "Amateur football in real time.",
    sur: (reseau: string) => `KoppaFoot on ${reseau}`,
    whatsapp: "Follow KoppaFoot on WhatsApp",
    aide: "Help",
    tutoriels: "Tutorials",
    questions: "FAQ",
    questionsCourt: "FAQ",
    ecrire: "Contact us",
    cadre: "Legal",
    conditions: "Terms of use",
    conditionsCourt: "Terms",
    confidentialite: "Privacy",
    appli: "The KoppaFoot app",
    bientot: "Coming soon to Android and iPhone",
    enAttendant:
      "Meanwhile, install the web version: it opens from your home screen like an app, with notifications for your matches.",
    commentInstaller: "How to install?",
    langue: "Language",
  },
);

// ---- La bande d'éclats -------------------------------------------------------

/**
 * Un carreau d'éclats qui se répète sans couture, posé en image de fond.
 *
 * Tiré comme le cadre des flyers (lib/og-da, `motifEclats`) : même graine,
 * mêmes verts, même pointe de flèche. Les éclats d'une couleur tiennent dans
 * un seul tracé, et ce qui déborde d'un bord revient par l'autre : la bande
 * se répète sur toute la largeur de l'écran sans qu'on voie où.
 *
 * Calculé une fois au chargement du module. Le calcul est déterministe et
 * arrondi au pixel, le serveur et le navigateur produisent donc la même
 * chaîne, et l'hydratation ne voit aucune différence.
 */
const BANDE_ECLATS = (() => {
  const L = 360;
  const H = 58;
  let graine = 11;
  const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
  const couleurs = ["#10b981", "#10b981", "#34d399", "#047857", "#022c22"];
  const angles = [-60, -30, 30, 60, 120, 150];
  const traces = new Map<string, string>();

  for (let y = -40; y < H + 10; y += 26) {
    for (let x = 0; x < L; x += 30) {
      if (hasard() < 0.2) continue;
      const long = 50 + hasard() * 60;
      const large = 15 + hasard() * 16;
      const a = (angles[Math.floor(hasard() * angles.length)] * Math.PI) / 180;
      const couleur = couleurs[Math.floor(hasard() * couleurs.length)];
      // La pointe : large à l'arrière, effilée devant, encochée.
      const forme = [[0, 0], [long, large / 2], [0, large], [long * 0.28, large / 2]].map(
        ([px, py]) => [x + px * Math.cos(a) - py * Math.sin(a), y + px * Math.sin(a) + py * Math.cos(a)],
      );
      const xs = forme.map(([px]) => px);
      const decalages = [0];
      if (Math.min(...xs) < 0) decalages.push(L);
      if (Math.max(...xs) > L) decalages.push(-L);
      for (const dx of decalages) {
        const [p0, ...reste] = forme.map(([px, py]) => `${Math.round(px + dx)} ${Math.round(py)}`);
        traces.set(couleur, `${traces.get(couleur) ?? ""}M${p0}L${reste.join(" ")}Z`);
      }
    }
  }

  const chemins = [...traces].map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">` +
    `<rect width="${L}" height="${H}" fill="#064e3b"/>${chemins}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

// ---- Les réseaux -------------------------------------------------------------

/** Les tracés viennent de Simple Icons (CC0), sur une grille de 24. */
const RESEAUX = [
  {
    nom: "TikTok",
    href: "https://www.tiktok.com/@koppafoot",
    d: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  },
  {
    nom: "YouTube",
    href: "https://www.youtube.com/@koppafoot",
    d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  {
    nom: "WhatsApp",
    href: "https://whatsapp.com/channel/0029Va8kl5sEVccGod2PLz1c",
    d: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
  },
];

// ---- Les drapeaux ------------------------------------------------------------

/**
 * Dessinés, et non en emoji : Windows n'a pas les drapeaux, il y écrit « FR »
 * en deux lettres. `uid` rend unique l'identifiant du découpage anglais.
 */
function Drapeau({ langue, uid }: { langue: Langue; uid: string }) {
  const classe = "h-3.5 w-5 shrink-0 ring-1 ring-white/20";
  if (langue === "fr") {
    return (
      <svg viewBox="0 0 3 2" preserveAspectRatio="none" aria-hidden className={classe}>
        <path fill="#002654" d="M0 0h1v2H0z" />
        <path fill="#fff" d="M1 0h1v2H1z" />
        <path fill="#ce1126" d="M2 0h1v2H2z" />
      </svg>
    );
  }
  const decoupe = `${uid}-uk`;
  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden className={classe}>
      <clipPath id={decoupe}>
        <path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z" />
      </clipPath>
      <path d="M0,0v30h60v-30z" fill="#012169" />
      <path d="M0,0L60,30M60,0L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0L60,30M60,0L0,30" clipPath={`url(#${decoupe})`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0v30M0,15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0v30M0,15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

const LANGUES: { langue: Langue; nom: string }[] = [
  { langue: "fr", nom: "Français" },
  { langue: "en", nom: "English" },
];

// ---- Le pied -----------------------------------------------------------------

/** Un lien de colonne : son nom en entier sur ordinateur, court sur téléphone. */
type LienColonne = { href: string; label: string; court?: string };

function Colonne({ titre, liens }: { titre: string; liens: LienColonne[] }) {
  return (
    <div>
      <p className="mb-3.5 font-display text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400">
        {titre}
      </p>
      <ul className="space-y-1.5">
        {liens.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="font-display text-base font-bold text-white/65 transition-colors hover:text-white lg:text-[17px]"
            >
              {l.court ? (
                <>
                  <span className="lg:hidden">{l.court}</span>
                  <span className="hidden lg:inline">{l.label}</span>
                </>
              ) : (
                l.label
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * L'installation de la version web, selon l'appareil : un bouton quand le
 * navigateur nous donne la main, la marche à suivre sur iPhone, rien quand
 * c'est déjà fait ou impossible. Le tutoriel reste proposé dans tous les cas.
 * L'état vient de lib/pwa-install, comme dans le menu du compte.
 */
function Installation() {
  const etat = useSyncExternalStore(souscrireInstallation, etatInstallation, etatInstallationServeur);
  const t = useTextes(T);
  const trad = useT();

  return (
    <div className="flex flex-col items-start gap-3 lg:items-end">
      {etat === "possible" && (
        <button
          type="button"
          onClick={() => installer()}
          className="flex items-center gap-2.5 bg-emerald-400 px-5 py-3.5 font-display text-[11px] font-black uppercase tracking-[0.16em] text-[#04130d] transition-colors hover:bg-emerald-300"
        >
          <Download size={15} strokeWidth={2.5} />
          {trad("install.action")}
        </button>
      )}
      {etat === "ios-manuel" && (
        <p className="flex max-w-sm items-start gap-2.5 text-xs font-semibold leading-relaxed text-white/60 lg:text-right">
          <Share size={15} className="mt-0.5 shrink-0 text-emerald-400" />
          {trad("install.ios")}
        </p>
      )}
      <Link
        href="/aide/tutoriels/installation"
        className="border-b border-white/25 pb-px font-display text-xs font-bold text-white/60 transition-colors hover:border-white hover:text-white"
      >
        {t.commentInstaller}
      </Link>
    </div>
  );
}

export default function PiedDePage() {
  const t = useTextes(T);
  const { langue, setLangue } = useLangue();
  // Sans ses deux-points ou guillemets : l'identifiant finit dans un `url(#…)`.
  const uid = useId().replace(/[^\w-]/g, "");

  const colonnes: { titre: string; liens: LienColonne[] }[] = [
    {
      // Le nom du menu du haut, que les deux portent : « Koppa Links ».
      titre: "Koppa Links",
      liens: VITRINES.filter((v) => v.dansKoppaLinks).map((v) => ({
        href: v.chemin,
        label: v.nom,
        court: v.nom.replace(/^Koppafoot\s+/i, ""),
      })),
    },
    {
      titre: t.aide,
      liens: [
        { href: "/aide/tutoriels", label: t.tutoriels },
        { href: "/aide", label: t.questions, court: t.questionsCourt },
        { href: "/aide#retour", label: t.ecrire },
      ],
    },
    {
      titre: t.cadre,
      liens: [
        { href: "/conditions", label: t.conditions, court: t.conditionsCourt },
        { href: "/confidentialite", label: t.confidentialite },
      ],
    },
  ];

  return (
    <footer className="pied-de-page relative overflow-hidden bg-[#080d0b] text-white">
      <div
        aria-hidden
        className="h-[38px] bg-[#064e3b] bg-repeat-x lg:h-[58px]"
        style={{ backgroundImage: BANDE_ECLATS, backgroundSize: "auto 100%" }}
      />

      {/* La largeur et les marges de la barre du haut (ScoreHeader) : le
          contenu du pied s'aligne sur elle. */}
      <div className="mx-auto max-w-[1600px] px-4 lg:px-5 xl:px-8">
        {/* Trois blocs, deux ordres. Sur téléphone, la marque, l'appli puis
            les liens ; sur ordinateur, la marque et les liens côte à côte,
            l'appli dessous sur toute la largeur. */}
        <div className="flex flex-col pt-9 lg:flex-row lg:flex-wrap lg:justify-between lg:gap-x-12 lg:pt-14">
          <div className="order-1">
            <Link href="/" className="inline-block">
              <Image
                src="/branding/logo_full_name.png"
                alt="KoppaFoot"
                width={148}
                height={74}
                className="h-[58px] w-auto lg:h-[74px]"
              />
            </Link>
            <p className="mt-4 font-display text-lg font-extrabold leading-tight text-white/90 lg:text-xl">
              {t.accroche}
            </p>
            <ul className="mt-5 flex gap-2.5">
              {RESEAUX.map((r) => (
                <li key={r.nom}>
                  <a
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={r.nom === "WhatsApp" ? t.whatsapp : t.sur(r.nom)}
                    title={r.nom}
                    className="flex h-10 w-10 items-center justify-center border border-white/15 text-white/80 transition-colors hover:border-emerald-400 hover:bg-emerald-400/10 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-[17px] w-[17px]">
                      <path d={r.d} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav
            aria-label="KoppaFoot"
            className="order-3 mt-9 grid grid-cols-2 gap-x-5 gap-y-8 lg:order-2 lg:mt-0 lg:grid-cols-3 lg:gap-x-16"
          >
            {colonnes.map((c) => (
              <Colonne key={c.titre} titre={c.titre} liens={c.liens} />
            ))}
          </nav>

          <div className="order-2 mt-8 border border-white/10 bg-white/[0.025] p-5 lg:order-3 lg:mt-12 lg:flex lg:w-full lg:items-center lg:gap-8 lg:px-6">
            <div className="min-w-0">
              <p className="font-display text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                {t.appli}
              </p>
              <p className="mt-1.5 font-display text-xl font-black leading-tight lg:text-[21px]">{t.bientot}</p>
              <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-white/55">{t.enAttendant}</p>
            </div>
            <div className="mt-5 shrink-0 lg:ml-auto lg:mt-0">
              <Installation />
            </div>
          </div>
        </div>

        {/* Le nom en très grand, fendu comme le titre des flyers : deux fois
            le même mot, chacun rogné d'un côté de la coupe, le second décalé.
            La taille suit la largeur du conteneur (`cqw`), le mot la remplit
            donc d'un bord à l'autre à toutes les tailles d'écran. */}
        <div aria-hidden className="@container mt-10 select-none lg:mt-16">
          <p className="relative h-[0.8em] whitespace-nowrap font-display text-[16.2cqw] font-black leading-[0.8] tracking-[-0.03em]">
            <span className="absolute left-0 top-0 [clip-path:polygon(0_0,100%_0,100%_12%,0_82%)]">KOPPAFOOT</span>
            <span className="absolute left-[0.025em] top-[0.03em] [clip-path:polygon(0_88%,100%_18%,100%_100%,0_100%)]">
              KOPPAFOOT
            </span>
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse items-start gap-3 border-t border-white/[0.08] py-4 font-display text-xs font-bold text-white/45 lg:mt-8 lg:flex-row lg:items-center lg:justify-between">
          <p>© {new Date().getFullYear()} KoppaFoot</p>
          <div role="group" aria-label={t.langue} className="flex gap-1.5">
            {LANGUES.map((l) => (
              <button
                key={l.langue}
                type="button"
                lang={l.langue}
                onClick={() => setLangue(l.langue)}
                aria-pressed={langue === l.langue}
                className={`flex items-center gap-2 border px-2.5 py-1.5 transition-colors ${langue === l.langue
                    ? "border-white/20 text-white"
                    : "border-transparent text-white/55 hover:text-white"
                  }`}
              >
                <Drapeau langue={l.langue} uid={uid} />
                {l.nom}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
