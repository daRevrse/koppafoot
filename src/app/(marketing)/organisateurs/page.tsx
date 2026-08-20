import Link from "next/link";
import Image from "next/image";
import {
  Radio, Trophy, BarChart3, Users, ArrowRight,
} from "lucide-react";

// ============================================
// The organizer site.
//
// Not a page of the app: no shell, no bottom bar, no sidebar. Someone lands
// here from a WhatsApp message or a conversation in a stadium car park, and
// owes KoppaFoot nothing yet. So the page argues before it asks.
//
// Editorial layout: full-bleed image sections, statements instead of section
// labels, large flat cards, bare oversized icons, and links that stay links.
// The only things shaped like buttons are the two wide CTAs.
//
// Every claim is something the product does today. No invented numbers, no
// testimonials, no logos of clubs that never said yes. Pricing is absent
// because nobody has decided it yet, better a gap than a guess.
// ============================================

export const metadata = {
  title: "Organiser une compétition, KoppaFoot",
  description:
    "Calendrier, poules, classements et scores en direct : KoppaFoot tient ta compétition et la met devant les supporters. Candidature en deux minutes.",
  openGraph: {
    title: "Organise ta compétition sur KoppaFoot",
    description:
      "Tes matchs en direct, tes classements calculés, une page d'inscription à envoyer. Tu gères le terrain, on gère le reste.",
    images: ["/branding/hero_stadium.png"],
  },
};

const CAPABILITIES = [
  {
    Icon: Radio,
    title: "Le direct depuis le bord du terrain",
    body: "Coup d'envoi, buts, passeurs, cartons, remplacements. Le score bouge en même temps sur la page publique.",
  },
  {
    Icon: Trophy,
    title: "Poules, calendrier, tableau final",
    body: "Tu choisis le format, les rencontres se génèrent, le tableau se remplit avec les qualifiés.",
  },
  {
    Icon: BarChart3,
    title: "Classements calculés seuls",
    body: "Chaque match saisi met à jour les poules, les buteurs et les passeurs. Plus de tableur, plus de contestation.",
  },
  {
    Icon: Users,
    title: "Des scoreurs à qui déléguer",
    body: "Tu invites par code. Chacun ne voit que les rencontres que tu lui confies, et rien d'autre.",
  },
];

const TUTORIAL = [
  {
    n: "01",
    title: "Crée la compétition",
    body: "Nom, format, dates, ville. Le format décide de tout le reste : une coupe n'aura pas d'écran de poules, un championnat pas de tableau final.",
  },
  {
    n: "02",
    title: "Ajoute les équipes",
    body: "À la main, ou en envoyant ton lien public : les clubs s'inscrivent eux-mêmes et tu valides. L'effectif peut suivre plus tard.",
  },
  {
    n: "03",
    title: "Compose et programme",
    body: "Répartis les poules, génère le calendrier, ajuste les dates et les terrains. Ton espace coche les étapes au fur et à mesure.",
  },
  {
    n: "04",
    title: "Confie les matchs",
    body: "Invite tes scoreurs par code, attribue-leur les rencontres du jour. Le jour J, ils ouvrent la console sur leur téléphone.",
  },
];

const QUESTIONS = [
  {
    q: "Faut-il du réseau sur le terrain ?",
    a: "Pour le direct, oui. Sans réseau, les résultats se saisissent après la rencontre : classements et statistiques se recalculent pareil.",
  },
  {
    q: "Qui peut modifier ma compétition ?",
    a: "Toi seul. Les scoreurs invités saisissent les rencontres que tu leur confies, sans toucher au calendrier, aux équipes ni au format.",
  },
  {
    q: "Et quand l'édition est finie ?",
    a: "Elle reste en ligne, résultats, classement final, statistiques. C'est l'archive de cette édition, et l'argument pour la suivante.",
  },
];

export default function OrganizersLandingPage() {
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative flex min-h-[88vh] items-end overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/branding/hero_stadium.png')" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />

        <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-32 sm:px-10 sm:pb-28">
          <p className="mb-6 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
            Koppafoot Organize
          </p>
          <h1 className="max-w-5xl font-display text-[13vw] font-black uppercase leading-[0.86] tracking-[-0.03em] text-white sm:text-[9vw] lg:text-[7.5vw]">
            Ta compétition
            <br />
            mérite mieux
            <br />
            qu&apos;un cahier
          </h1>

          <p className="mt-8 max-w-lg text-lg leading-relaxed text-white/70 sm:text-xl">
            KoppaFoot tient le calendrier, calcule les classements et diffuse
            tes matchs en direct. Toi, tu gères le terrain.
          </p>

          <Link
            href="/organisateurs/candidature"
            className="group mt-12 flex w-full items-center justify-between gap-6 bg-white px-8 py-7 text-gray-900 transition-colors hover:bg-amber-400 sm:px-12 sm:py-9"
          >
            <span className="font-display text-xl font-black uppercase tracking-tight sm:text-3xl">
              Déposer ma candidature
            </span>
            <ArrowRight
              size={32}
              strokeWidth={1.5}
              className="shrink-0 transition-transform group-hover:translate-x-2"
            />
          </Link>
        </div>
      </section>

      {/* ---------- Problem / answer, side by side ---------- */}
      <section id="methode" className="scroll-mt-24 py-28 sm:py-40">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
            <div>
              <h2 className="font-display text-4xl font-black leading-[1.02] tracking-tight text-gray-900 sm:text-6xl">
                Le terrain n&apos;est pas
                <br />
                le plus dur.
              </h2>
              <p className="mt-8 max-w-md text-lg leading-relaxed text-gray-500">
                Le plus dur, c&apos;est le classement recalculé à la main le
                dimanche soir, les résultats qui circulent en photos de feuille
                de match, et le tournoi qui se termine sans laisser de trace.
              </p>
            </div>

            <div className="lg:pt-4">
              <p className="text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">
                Tu saisis les matchs. Tout le reste en découle, classements,
                statistiques, page publique, notifications aux supporters.
              </p>
              <p className="mt-8 text-base leading-relaxed text-gray-500">
                C&apos;est le seul travail que la plateforme te demande, et
                c&apos;est un travail que tu fais déjà.
              </p>

              {/* Le public au bord du terrain, telephone en main : c'est le
                  bout de la chaine que la saisie alimente, et la raison pour
                  laquelle elle vaut la peine. */}
              <div className="relative mt-12 aspect-[4/3] w-full overflow-hidden bg-gray-100">
                <Image
                  src="/branding/fan_matchs.png"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Capabilities: flat cards, bare icons ---------- */}
      <section className="border-y border-gray-200/70">
        <div className="mx-auto grid max-w-7xl gap-px bg-gray-200/70 sm:grid-cols-2">
          {CAPABILITIES.map(({ Icon, title, body }) => (
            <div key={title} className="bg-white px-8 py-16 sm:px-14 sm:py-20">
              <Icon size={52} strokeWidth={1} className="text-gray-900" />
              <h3 className="mt-10 font-display text-2xl font-black leading-tight tracking-tight text-gray-900 sm:text-3xl">
                {title}
              </h3>
              <p className="mt-4 max-w-sm text-base leading-relaxed text-gray-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- The distribution argument, full bleed ---------- */}
      <section className="relative flex min-h-[80vh] items-center overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/branding/fan_terrain.png')" }}
        />
        <div aria-hidden className="absolute inset-0 bg-emerald-950/85" />

        <div className="relative mx-auto w-full max-w-7xl px-6 py-28 sm:px-10 sm:py-36">
          <h2 className="max-w-4xl font-display text-4xl font-black uppercase leading-[0.94] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Tes matchs passent là où
            <br className="hidden sm:block" /> les gens regardent déjà
          </h2>
          <p className="mt-10 max-w-xl text-lg leading-relaxed text-emerald-100/70">
            Une compétition créée ici n&apos;est pas rangée dans un coin
            d&apos;administration. Elle apparaît sur la page d&apos;accueil, dans
            le tableau du direct, avec les autres, devant des supporters qui ne
            connaissaient ni ton tournoi ni tes équipes.
          </p>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white">
            Tu tiens ta compétition à jour, la plateforme lui donne un public.
          </p>
        </div>
      </section>

      {/* ---------- Tutorial ---------- */}
      <section id="tutoriel" className="scroll-mt-24 py-28 sm:py-40">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <h2 className="max-w-3xl font-display text-4xl font-black leading-[1.02] tracking-tight text-gray-900 sm:text-6xl">
            Quatre écrans, et ta
            <br />
            compétition tourne.
          </h2>

          <div className="mt-20 space-y-px bg-gray-200/70">
            {TUTORIAL.map(({ n, title, body }) => (
              <div
                key={n}
                className="grid gap-6 bg-white py-12 sm:grid-cols-[auto_1fr] sm:gap-16 sm:py-16"
              >
                <span className="font-display text-5xl font-black leading-none tracking-tight text-gray-200 sm:text-7xl">
                  {n}
                </span>
                <div className="grid gap-4 lg:grid-cols-2 lg:gap-16">
                  <h3 className="font-display text-2xl font-black leading-tight tracking-tight text-gray-900 sm:text-3xl">
                    {title}
                  </h3>
                  <p className="max-w-md text-base leading-relaxed text-gray-500">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Questions, merged with the closing CTA ---------- */}
      <section id="questions" className="scroll-mt-24 border-t border-gray-200/70 py-28 sm:py-40">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
            <div className="space-y-12">
              {QUESTIONS.map(({ q, a }) => (
                <div key={q}>
                  <h3 className="font-display text-xl font-black leading-tight tracking-tight text-gray-900 sm:text-2xl">
                    {q}
                  </h3>
                  <p className="mt-3 max-w-md text-base leading-relaxed text-gray-500">{a}</p>
                </div>
              ))}
            </div>

            <div className="lg:pt-2">
              <h2 className="font-display text-4xl font-black leading-[1.02] tracking-tight text-gray-900 sm:text-5xl">
                Lance ta prochaine édition ici.
              </h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-gray-500">
                Dis-nous quelle compétition tu veux organiser. On ouvre ton
                espace, et tu montes ton calendrier dans la foulée.
              </p>

              <Link
                href="/organisateurs/candidature"
                className="group mt-12 flex w-full items-center justify-between gap-6 bg-gray-900 px-8 py-7 text-white transition-colors hover:bg-emerald-700 sm:px-10"
              >
                <span className="font-display text-xl font-black uppercase tracking-tight sm:text-2xl">
                  Candidater
                </span>
                <ArrowRight
                  size={28}
                  strokeWidth={1.5}
                  className="shrink-0 transition-transform group-hover:translate-x-2"
                />
              </Link>

              <p className="mt-5 text-sm font-bold text-gray-400">
                Deux minutes · Réponse par email
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
