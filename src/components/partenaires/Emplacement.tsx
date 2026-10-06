"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import type { EmplacementPartenaire, PartenaireAffiche } from "@/lib/partenaires";

// ============================================
// Un emplacement de partenaire.
//
// RIEN QUAND IL N'Y A PERSONNE. Pas de cadre vide, pas de « votre publicité
// ici » : sans partenaire à l'affiche, l'emplacement n'occupe pas un pixel.
// C'est aussi là que viendra, un jour, une régie publicitaire pour les
// emplacements invendus (voir lib/partenaires).
//
// TOUJOURS SIGNALÉ. Le mot « Partenaire » coiffe chaque visuel : les
// conditions d'utilisation le promettent, et une marque mêlée au contenu
// sans le dire abîmerait la confiance qu'on vend justement aux marques.
//
// LÉGER. Le visuel ne se charge qu'une fois la réponse arrivée, la vue ne se
// compte qu'à moitié à l'écran, une fois par affichage : rien ne ralentit la
// page autour, et rien ne coûte de données à qui ne voit pas l'emplacement.
// ============================================

const T = textes(
  {
    partenaire: "Partenaire",
    presentePar: "Présenté par",
    voir: "Voir le site",
  },
  {
    partenaire: "Partner",
    presentePar: "Presented by",
    voir: "Visit website",
  },
);

export default function Emplacement({ emplacement, cid = null, className = "" }: {
  emplacement: EmplacementPartenaire;
  /** La compétition de la page : son propre partenaire passe en premier. */
  cid?: string | null;
  className?: string;
}) {
  const t = useTextes(T);
  const [partenaire, setPartenaire] = useState<PartenaireAffiche | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivant = true;
    const params = new URLSearchParams({ emplacement });
    if (cid) params.set("cid", cid);
    fetch(`/api/partenaires?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivant) setPartenaire(d?.partenaire ?? null); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [emplacement, cid]);

  // Une vue : le visuel à moitié à l'écran, une fois par affichage.
  useEffect(() => {
    const el = ref.current;
    if (!partenaire || !el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entrees) => {
      if (!entrees.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      fetch("/api/partenaires/vue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: partenaire.id }),
        keepalive: true,
      }).catch(() => {});
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [partenaire]);

  if (!partenaire) return null;

  const contenu = (
    <>
      {partenaire.imageUrl && (
        <span className="relative h-12 w-24 shrink-0 @md:h-14 @md:w-32">
          <Image src={partenaire.imageUrl} alt="" fill sizes="128px" className="object-contain" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
          {partenaire.deLaCompetition ? t.presentePar : t.partenaire}
        </span>
        <span className="mt-0.5 block truncate font-display text-base font-black tracking-tight text-gray-900">
          {partenaire.annonceur}
        </span>
        {partenaire.accroche && (
          <span className="mt-0.5 block text-xs leading-snug text-gray-500">{partenaire.accroche}</span>
        )}
      </span>
      {partenaire.cliquable && (
        <span className="hidden shrink-0 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700 @md:block">
          {t.voir} →
        </span>
      )}
    </>
  );

  // Réglé sur la largeur de SA colonne, pas de l'écran : dans le rail de
  // l'accueil Direct (320 à 420 px), même sur un grand écran, le visuel
  // rétrécit et « Voir le site » s'efface, l'encadré entier restant cliquable.
  const classe = `flex items-center gap-4 border border-gray-200/70 bg-white px-4 py-3 ${className}`;
  return (
    <div ref={ref} data-emplacement={emplacement} className="@container">
      {partenaire.cliquable ? (
        // Le clic passe par le serveur, qui le compte et connaît seul la
        // destination. « sponsored » : les moteurs de recherche savent que
        // ce lien est payé.
        <a
          href={`/api/partenaires/clic?id=${encodeURIComponent(partenaire.id)}`}
          target="_blank"
          rel="sponsored noopener"
          className={`${classe} transition-colors hover:border-gray-400`}
        >
          {contenu}
        </a>
      ) : (
        <div className={classe}>{contenu}</div>
      )}
    </div>
  );
}
