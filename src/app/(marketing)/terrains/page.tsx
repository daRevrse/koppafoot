import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarCheck, Search, Wallet } from "lucide-react";

// ============================================
// MyFields, la vitrine des propriétaires de terrain.
//
// CETTE PAGE DÉMENTAIT LE PRODUIT. Elle annonçait « pas de réservation en
// ligne, pas de calendrier d'occupation » alors que le formulaire de demande
// de créneau était en ligne sur chaque fiche, que le propriétaire pouvait
// confirmer ou refuser, et que les créneaux confirmés étaient publiés. Une
// vitrine qui sous-vend une fonctionnalité livrée coûte deux fois : elle
// n'attire pas ceux que la réservation intéresse, et elle laisse ceux qui
// s'inscrivent découvrir seuls ce qu'ils ont acheté.
//
// Ce qui reste vrai, et qu'on continue de dire : la plateforme n'encaisse
// rien. On met deux parties d'accord sur un créneau, l'argent se règle entre
// elles. Le dire clairement vaut mieux que de le laisser deviner à la
// première demande.
// ============================================

export const metadata = {
  title: "Les terrains, KoppaFoot",
  description:
    "Référencez votre terrain sur KoppaFoot : être trouvé par les équipes, recevoir des demandes de créneau et y répondre.",
};

const ETAPES: { n: string; titre: string; corps: string }[] = [
  {
    n: "01",
    titre: "Votre terrain entre dans l'annuaire",
    corps:
      "Nom, ville, format, surface, équipements, tarif horaire, photo. C'est la fiche que verront les équipes qui cherchent où jouer, et c'est sur elle qu'elles choisissent.",
  },
  {
    n: "02",
    titre: "Les équipes demandent un créneau",
    corps:
      "Une date, une heure, une durée. La demande arrive dans votre espace, et vous prévient — notification, téléphone, email. Les créneaux déjà confirmés sont affichés publiquement, pour que personne ne demande un samedi déjà pris.",
  },
  {
    n: "03",
    titre: "Vous confirmez, ou vous refusez",
    corps:
      "Confirmer bloque le créneau et prévient l'équipe. Refuser le laisse libre. Rien ne se décide sans vous : le produit vérifie même qu'un créneau n'en chevauche pas un autre avant que vous ne l'acceptiez.",
  },
];

const PREUVES: { Icon: typeof Search; titre: string; corps: string }[] = [
  {
    Icon: Search,
    titre: "Trouvable",
    corps:
      "Dans l'annuaire des terrains et dans la recherche du produit, filtrable par ville, format et surface.",
  },
  {
    Icon: CalendarCheck,
    titre: "Réservable",
    corps:
      "Demande de créneau, confirmation, annulation. Les deux parties suivent l'état de la demande au même endroit.",
  },
  {
    Icon: Wallet,
    titre: "Payé entre vous",
    corps:
      "La plateforme n'encaisse rien et ne prend aucune commission. Vous annoncez votre tarif, le règlement reste votre affaire.",
  },
];

export default function TerrainsPage() {
  return (
    <>
      <section className="relative flex min-h-[88vh] items-end overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/branding/fan_terrain.png')" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />

        <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-32 sm:px-10 sm:pb-28">
          <p className="mb-6 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
            MyFields
          </p>
          <h1 className="max-w-5xl font-display text-[13vw] font-black uppercase leading-[0.86] tracking-[-0.03em] text-white sm:text-[9vw] lg:text-[7.5vw]">
            Sans pelouse,
            <br />
            pas de match
          </h1>

          <p className="mt-8 max-w-lg text-lg leading-relaxed text-white/70">
            Les équipes cherchent où jouer et repartent avec un créneau.
            Un terrain qui n&apos;est référencé nulle part reste vide les soirs
            où quelqu&apos;un le cherchait.
          </p>

          <Link
            href="/terrains/candidature"
            className="group mt-12 flex w-full items-center justify-between gap-6 bg-white px-8 py-7 text-gray-900 transition-colors hover:bg-amber-400 sm:px-12 sm:py-9"
          >
            <span className="font-display text-xl font-black uppercase tracking-tight sm:text-3xl">
              Référencer mon terrain
            </span>
            <ArrowRight
              size={32}
              strokeWidth={1.5}
              className="shrink-0 transition-transform group-hover:translate-x-2"
            />
          </Link>

          {/* L'autre public arrive aussi ici, par le menu : celui qui cherche
              un terrain, pas celui qui en possède un. Sans cette sortie, il
              lisait « référencer mon terrain » et repartait. */}
          <Link
            href="/terrains/annuaire"
            className="mt-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-white/60 transition-colors hover:text-white"
          >
            Je cherche un terrain, pas en référencer un
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <section id="etapes" className="scroll-mt-24 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <div className="grid gap-px bg-gray-200/70 lg:grid-cols-3">
            {ETAPES.map((s) => (
              <article key={s.n} className="bg-white p-8 sm:p-10">
                <p className="font-display text-5xl font-black tabular-nums text-gray-200">{s.n}</p>
                <h2 className="mt-4 font-display text-2xl font-black leading-tight tracking-tight text-gray-900">
                  {s.titre}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-gray-600">{s.corps}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Ce que ça fait, et la seule limite qui compte : l'argent.
          L'ancienne version de cette section listait trois choses que le
          produit ne faisait pas, dont deux qu'il faisait déjà. */}
      <section id="cadre" className="scroll-mt-24 border-y border-gray-200/70 bg-gray-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
            Ce que KoppaFoot fait, et ne fait pas
          </h2>

          <div className="mt-10 grid gap-px bg-gray-200/70 lg:grid-cols-3">
            {PREUVES.map((p) => (
              <article key={p.titre} className="bg-white p-8">
                <p.Icon size={26} strokeWidth={1.5} className="text-emerald-600" />
                <h3 className="mt-5 font-display text-xl font-black uppercase tracking-tight text-gray-900">
                  {p.titre}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-gray-600">{p.corps}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

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
            On la relit, puis elle entre dans l&apos;annuaire, là où les équipes
            cherchent où jouer — et d&apos;où elles vous écrivent.
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
              href="/terrains/annuaire"
              className="inline-flex items-center gap-2 border border-white/30 px-8 py-5 text-[11px] font-black uppercase tracking-[0.15em] text-white/80 transition-colors hover:border-white hover:text-white"
            >
              Voir les terrains référencés
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
