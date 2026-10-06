"use client";

import Link from "next/link";
import { ArrowRight, FileText, PlayCircle } from "lucide-react";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { TUTORIELS, videoDe } from "@/lib/tutoriels";

// ============================================
// Les tutoriels, en cartes : une par profil, avec pour qui elle est écrite.
//
// Sur la page d'aide et sur le centre de tutoriels. On choisit sa carte à ce
// qu'on FAIT (« Tu diriges une équipe »), pas au nom d'un rôle qu'on ne
// connaît pas encore.
//
// Ce qui accompagne la fiche est dit en bas de carte : une vidéo, un PDF. La
// vidéo elle-même se lit sur la fiche ; une miniature dans une carte sur
// deux rendrait la grille bancale.
// ============================================

const T = textes({ video: "Vidéo" }, { video: "Video" });

export default function CartesTutoriels({ sauf }: { sauf?: string }) {
  const { langue } = useLangue();
  const t = useTextes(T);
  return (
    <ul className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2">
      {TUTORIELS.filter((tuto) => tuto.slug !== sauf).map((tuto) => {
        const video = videoDe(tuto, langue)?.video;
        return (
          <li key={tuto.slug} className="bg-white">
            <Link
              href={`/aide/tutoriels/${tuto.slug}`}
              className="group flex h-full flex-col gap-1.5 p-4 transition-colors hover:bg-gray-50 sm:p-5"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-display text-base font-black uppercase tracking-tight text-gray-900">
                  {tuto.titre[langue]}
                </span>
                <ArrowRight size={15} className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-700" />
              </span>
              <span className="text-xs leading-relaxed text-gray-500">{tuto.pourQui[langue]}</span>
              {(video || tuto.pdf) && (
                <span className="mt-auto flex items-center gap-3 pt-1 text-[10px] font-black uppercase tracking-[0.12em]">
                  {video && (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <PlayCircle size={11} /> {t.video}
                      {video.duree && <span className="tabular-nums text-gray-400">{video.duree}</span>}
                    </span>
                  )}
                  {tuto.pdf && (
                    <span className="inline-flex items-center gap-1 text-gray-400">
                      <FileText size={11} /> PDF
                    </span>
                  )}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
