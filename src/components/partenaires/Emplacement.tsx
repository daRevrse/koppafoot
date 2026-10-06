"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { useSansPub } from "@/hooks/useSansPub";
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
//
// UN EMPLACEMENT, PLUSIEURS PLACES. Le bandeau du Direct est posé en trois
// endroits, chacun visible à une largeur d'écran (voir DirectHomeV2 et le rail
// de droite) : la demande est partagée, une seule par page, et les trois
// montrent la même marque. Seul l'endroit visible compte une vue.
//
// RIEN POUR QUI A PAYÉ POUR NE RIEN VOIR : le Pro et l'option sans pub
// (hooks/useSansPub).
// ============================================

/** Une demande par emplacement et par page, partagée, rafraîchie après cinq minutes comme le cache du serveur. */
const demandes = new Map<string, { depuis: number; partenaire: Promise<PartenaireAffiche | null> }>();

function partenaireDe(emplacement: EmplacementPartenaire, cid: string | null): Promise<PartenaireAffiche | null> {
  const cle = `${emplacement}|${cid ?? ""}`;
  const deja = demandes.get(cle);
  if (deja && Date.now() - deja.depuis < 5 * 60_000) return deja.partenaire;
  const params = new URLSearchParams({ emplacement });
  if (cid) params.set("cid", cid);
  const partenaire = fetch(`/api/partenaires?${params}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.partenaire ?? null) as PartenaireAffiche | null)
    .catch(() => null);
  demandes.set(cle, { depuis: Date.now(), partenaire });
  return partenaire;
}

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

export default function Emplacement({ emplacement, cid = null, variante = "horizontale", className = "" }: {
  emplacement: EmplacementPartenaire;
  /** La compétition de la page : son propre partenaire passe en premier. */
  cid?: string | null;
  /**
   * `verticale` : le rail de droite. Le visuel 1:2 de la bannière s'il y en
   * a un ; sinon la bannière 4:1 ou l'encadré, qui tiennent dans le rail.
   */
  variante?: "horizontale" | "verticale";
  className?: string;
}) {
  const t = useTextes(T);
  const sansPub = useSansPub();
  const [partenaire, setPartenaire] = useState<PartenaireAffiche | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // On attend de savoir : `null`, c'est peut-être un compte sans pub.
    if (sansPub !== false) return;
    let vivant = true;
    void partenaireDe(emplacement, cid).then((p) => { if (vivant) setPartenaire(p); });
    return () => { vivant = false; };
  }, [emplacement, cid, sansPub]);

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

  if (!partenaire || sansPub !== false) return null;

  const mention = partenaire.deLaCompetition ? t.presentePar : t.partenaire;

  // LA BANNIÈRE : l'image de la marque, en 4:1 (voir lib/partenaires), la
  // mention et le nom au-dessus, en petit. L'image porte déjà son message ;
  // l'accroche sert de texte de remplacement aux lecteurs d'écran.
  // Recadrée au centre si la marque n'a pas respecté le format :
  // l'administration l'en prévient à l'envoi, aperçu à l'appui.
  //
  // En variante verticale, avec un visuel 1:2 : la même chose debout, 300 px
  // de large au plus (300 × 600, le format que les marques connaissent).
  if (partenaire.format === "banniere" && partenaire.imageUrl) {
    const debout = variante === "verticale" && partenaire.imageVerticaleUrl ? partenaire.imageVerticaleUrl : null;
    const banniere = (
      <>
        <span className="mb-1.5 flex items-baseline gap-2">
          <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{mention}</span>
          <span className="min-w-0 truncate text-xs font-bold text-gray-600">{partenaire.annonceur}</span>
          {partenaire.cliquable && (
            <span className="ml-auto hidden shrink-0 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700 @md:block">
              {t.voir} →
            </span>
          )}
        </span>
        <span className={`relative block w-full overflow-hidden border border-gray-200/70 bg-gray-50 transition-colors group-hover:border-gray-400 ${debout ? "aspect-[1/2]" : "aspect-[4/1]"}`}>
          <Image
            src={debout ?? partenaire.imageUrl}
            alt={partenaire.accroche ? `${partenaire.annonceur} : ${partenaire.accroche}` : partenaire.annonceur}
            fill
            sizes={debout ? "300px" : "(min-width: 800px) 768px, 100vw"}
            className="object-cover"
          />
        </span>
      </>
    );
    return (
      <div
        ref={ref}
        data-emplacement={emplacement}
        data-variante={debout ? "verticale" : "horizontale"}
        className={`@container mx-auto w-full ${debout ? "max-w-[300px]" : "max-w-3xl"} ${className}`}
      >
        {partenaire.cliquable ? (
          <a
            href={`/api/partenaires/clic?id=${encodeURIComponent(partenaire.id)}`}
            target="_blank"
            rel="sponsored noopener"
            className="group block"
          >
            {banniere}
          </a>
        ) : (
          <div>{banniere}</div>
        )}
      </div>
    );
  }

  const contenu = (
    <>
      {partenaire.imageUrl && (
        <span className="relative h-12 w-24 shrink-0 @md:h-14 @md:w-32">
          <Image src={partenaire.imageUrl} alt="" fill sizes="128px" className="object-contain" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
          {mention}
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
