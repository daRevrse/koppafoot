"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Download } from "lucide-react";
import { useLangue, useT, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { tutoriel, videoDe } from "@/lib/tutoriels";
import CartesTutoriels from "@/components/aide/CartesTutoriels";
import VideoYoutube from "@/components/aide/VideoYoutube";

// ============================================
// Une fiche de tutoriel : l'essentiel d'un profil en quelques étapes, chacune
// avec le bouton qui mène à l'écran dont elle parle, et le guide complet en
// PDF quand il existe.
//
// Numérotée, parce que l'ordre compte : on ne recrute pas avant d'avoir créé
// son équipe. Mais chaque étape se lit seule, pour qui revient chercher UN
// geste.
//
// La vidéo, quand il y en a une, ouvre la fiche : qui préfère regarder n'a
// pas à lire d'abord. L'ancre #video y mène depuis « Pour bien démarrer ».
// ============================================

const T = textes(
  {
    fil: "Tutoriels",
    pdf: "Télécharger le guide complet (PDF)",
    enFrancais: "",
    autres: "Les autres tutoriels",
    introuvable: "Ce tutoriel n'existe pas.",
    retour: "Tous les tutoriels",
  },
  {
    fil: "Guides",
    pdf: "Download the full guide (PDF, in French)",
    enFrancais: "This guide is in French, like the tools it describes.",
    autres: "Other guides",
    introuvable: "This guide doesn't exist.",
    retour: "All guides",
  },
);

export default function TutorielPage() {
  const { slug } = useParams<{ slug: string }>();
  const { langue } = useLangue();
  const t = useTextes(T);
  const trad = useT();
  const tuto = tutoriel(slug);

  if (!tuto) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-sm font-bold text-gray-500">{t.introuvable}</p>
        <Link href="/aide/tutoriels" className="mt-4 inline-block text-sm font-black text-emerald-700 underline">
          {t.retour}
        </Link>
      </div>
    );
  }

  const etapes = (langue === "en" ? tuto.etapes.en : null) ?? tuto.etapes.fr;
  const enFrancais = langue === "en" && !tuto.etapes.en;
  const video = videoDe(tuto, langue);

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <nav
        aria-label="Fil d'ariane"
        className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        <Link href="/aide" className="transition-colors hover:text-emerald-700">{trad("aide.fil")}</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <Link href="/aide/tutoriels" className="transition-colors hover:text-emerald-700">{t.fil}</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <span className="text-gray-600">{tuto.titre[langue]}</span>
      </nav>

      <header className="border border-gray-200/70 bg-gray-900 p-5 text-white sm:p-8">
        <h1 className="font-display text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
          {tuto.titre[langue]}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">{tuto.pourQui[langue]}</p>
        {video && (
          <div id="video" className="mt-6 scroll-mt-24">
            <VideoYoutube
              video={video.video}
              titre={tuto.titre[langue]}
              enFrancais={video.enFrancais}
              sombre
              sizes="(min-width: 768px) 704px, 100vw"
            />
          </div>
        )}
        {tuto.pdf && (
          <a
            href={tuto.pdf}
            download
            className="mt-5 inline-flex items-center gap-2 border border-white/20 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-emerald-400 hover:text-emerald-300"
          >
            <Download size={14} /> {t.pdf}
          </a>
        )}
      </header>

      {enFrancais && (
        <p className="mt-4 border border-amber-100 bg-amber-50/70 px-4 py-2.5 text-xs font-semibold text-amber-900">
          {t.enFrancais}
        </p>
      )}

      <ol className="mt-6 space-y-px border border-gray-200/70 bg-gray-200/70">
        {etapes.map((e, i) => (
          <li key={e.titre} className="flex gap-4 bg-white p-4 sm:p-5">
            <span className="font-display text-2xl font-black leading-none tabular-nums text-gray-200">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-gray-900">{e.titre}</h2>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{e.texte}</p>
              {e.lien && (
                <Link
                  href={e.lien.href}
                  className="mt-2.5 inline-flex items-center gap-1.5 bg-emerald-500 px-3.5 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-600"
                >
                  {e.lien.label}
                  <ArrowRight size={13} />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-10">
        <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">{t.autres}</h2>
        <CartesTutoriels sauf={tuto.slug} />
      </section>
    </div>
  );
}
