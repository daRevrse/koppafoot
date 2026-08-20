import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

// ============================================
// Les terrains — la page des propriétaires de terrain.
//
// Ce que la plateforme sait faire aujourd'hui pour un terrain : le référencer
// et le rendre trouvable dans la recherche (il y est une catégorie à part
// entière, au même titre que les équipes et les arbitres). Ce qu'elle ne sait
// PAS faire : réserver un créneau, tenir un calendrier d'occupation,
// encaisser. La page le dit au lieu de le laisser supposer — une vitrine qui
// promet une réservation inexistante fabrique des déçus, pas des inscrits.
//
// Le formulaire d'inscription d'un terrain n'existe pas encore : le seul
// chemin réel est de créer un compte et de nous écrire. C'est ce qui est
// proposé, tel quel.
// ============================================

export const metadata = {
  title: "Les terrains — KoppaFoot",
  description:
    "Référencez votre terrain sur KoppaFoot : être trouvé par les équipes et les organisateurs qui cherchent où jouer.",
};

const STEPS: { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Le terrain entre dans la base",
    body:
      "Nom, ville, surface, ce qui existe autour. C'est la fiche que verront les équipes qui cherchent où jouer.",
  },
  {
    n: "02",
    title: "Il devient trouvable",
    body:
      "La recherche du produit a une catégorie « terrains » : un manager qui cherche un lieu pour un amical, un organisateur qui monte une compétition, tombent dessus au même endroit que les équipes et les arbitres.",
  },
  {
    n: "03",
    title: "Les compétitions ont besoin de lieux",
    body:
      "Une compétition, c'est un calendrier de matchs qui doivent se jouer quelque part. Être référencé, c'est être dans la liste au moment où quelqu'un cherche.",
  },
];

export default function TerrainsPage() {
  return (
    <>
      <section className="border-b border-gray-200/70 py-24 sm:py-36">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
                MyFields
              </p>
              <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
                Propriétaires de terrain
              </p>
              <h1 className="mt-6 font-display text-5xl font-black uppercase leading-[0.9] tracking-[-0.02em] text-gray-900 sm:text-7xl">
                Sans pelouse, pas de match
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-gray-600">
                Les équipes et les compétitions cherchent des lieux où jouer. Un
                terrain qui n&apos;est référencé nulle part reste vide les jours où
                quelqu&apos;un le cherchait.
              </p>
            </div>

            {/* Le proprietaire devant son installation : c'est a lui que la
                page parle, et le montrer vaut mieux que le nommer. */}
            <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
              <Image
                src="/branding/role_proprietaire.png"
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="grid gap-px bg-gray-200/70 lg:grid-cols-3">
            {STEPS.map((s) => (
              <article key={s.n} className="bg-white p-8 sm:p-10">
                <p className="font-display text-5xl font-black tabular-nums text-gray-200">{s.n}</p>
                <h2 className="mt-4 font-display text-2xl font-black leading-tight tracking-tight text-gray-900">
                  {s.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-gray-600">{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Ce que ça ne fait pas. Une vitrine qui laisse croire à une
          réservation en ligne fabrique des déçus le jour de l'inscription. */}
      <section className="border-y border-gray-200/70 bg-gray-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
            Ce que la plateforme ne fait pas encore
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-600">
            Pas de réservation en ligne, pas de calendrier d&apos;occupation, pas
            d&apos;encaissement. Aujourd&apos;hui, KoppaFoot vous rend{" "}
            <strong className="font-black text-gray-900">trouvable</strong> — la suite
            se règle entre vous et l&apos;équipe, comme aujourd&apos;hui, mais avec
            l&apos;équipe qui sait que vous existez.
          </p>
        </div>
      </section>

      {/* Un terrain eclaire un soir de semaine : l'image de ce que la page
          vend — des creneaux remplis plutot qu'une pelouse vide. */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div aria-hidden className="absolute inset-0">
          <Image
            src="/branding/fan_terrain.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div aria-hidden className="absolute inset-0 bg-gray-950/85" />

        <div className="relative mx-auto max-w-7xl px-6 sm:px-10">
          <h2 className="max-w-3xl font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl">
            Référencer un terrain
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            Déposez la fiche de votre terrain : nom, ville, format, surface.
            On la relit, puis elle entre dans la recherche — là où les équipes
            cherchent où jouer.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/terrains/candidature"
              className="inline-flex items-center gap-2 border border-white bg-white px-8 py-5 text-[11px] font-black uppercase tracking-[0.15em] text-gray-900 transition-colors hover:border-emerald-400 hover:bg-emerald-400"
            >
              Référencer mon terrain
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/roles"
              className="inline-flex items-center gap-2 border border-white/30 px-8 py-5 text-[11px] font-black uppercase tracking-[0.15em] text-white/80 transition-colors hover:border-white hover:text-white"
            >
              Voir tous les rôles
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
