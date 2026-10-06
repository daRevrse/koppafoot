"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { useSansPub } from "@/hooks/useSansPub";
import {
  DUREE_ANNONCE_MS, melanger, type EmplacementPartenaire, type PartenaireAffiche,
} from "@/lib/partenaires";

// ============================================
// Un emplacement de partenaire, ou d'annonces.
//
// RIEN QUAND IL N'Y A PERSONNE. Pas de cadre vide, pas de « votre publicité
// ici » : sans marque à l'affiche, l'emplacement n'occupe pas un pixel.
// C'est aussi là que viendra, un jour, une régie publicitaire pour les
// emplacements invendus (voir lib/partenaires).
//
// TOUJOURS SIGNALÉ. « Partenaire » (ou « Présenté par ») ou « Annonce »
// coiffe chaque visuel : les conditions d'utilisation le promettent, et une
// marque mêlée au contenu sans le dire abîmerait la confiance qu'on vend
// justement aux marques.
//
// UN PARTENAIRE EST SEUL ; LES ANNONCES SE RELAIENT. Le partenaire a payé
// l'exclusivité : il reste. Les annonces partagent l'emplacement : une toutes
// les huit secondes, dans un ordre tiré à chaque affichage, en fondu. Le
// défilement s'arrête quand on survole ou qu'on parcourt l'emplacement au
// clavier, quand il sort de l'écran ou que l'onglet est caché, et chez qui a
// demandé à réduire les animations (on choisit alors aux points). Chaque
// annonce compte sa vue quand elle paraît, une fois par affichage.
//
// LÉGER. Les visuels ne se chargent qu'une fois la réponse arrivée, une vue
// ne se compte qu'à moitié à l'écran : rien ne ralentit la page autour, et
// rien ne coûte de données à qui ne voit pas l'emplacement.
//
// UN EMPLACEMENT, PLUSIEURS PLACES. Le bandeau du Direct est posé en trois
// endroits, chacun visible à une largeur d'écran (voir DirectHomeV2 et le rail
// de droite) : la demande est partagée, une seule par page. Seul l'endroit
// visible compte des vues.
//
// RIEN POUR QUI A PAYÉ POUR NE RIEN VOIR : le Pro et l'option sans pub
// (hooks/useSansPub).
// ============================================

interface Reponse {
  partenaire: PartenaireAffiche | null;
  annonces: PartenaireAffiche[];
}

/** Une demande par emplacement et par page, partagée, rafraîchie après cinq minutes comme le cache du serveur. */
const demandes = new Map<string, { depuis: number; reponse: Promise<Reponse> }>();

function affichesDe(emplacement: EmplacementPartenaire, cid: string | null): Promise<Reponse> {
  const cle = `${emplacement}|${cid ?? ""}`;
  const deja = demandes.get(cle);
  if (deja && Date.now() - deja.depuis < 5 * 60_000) return deja.reponse;
  const params = new URLSearchParams({ emplacement });
  if (cid) params.set("cid", cid);
  const reponse = fetch(`/api/partenaires?${params}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => ({ partenaire: d?.partenaire ?? null, annonces: Array.isArray(d?.annonces) ? d.annonces : [] }) as Reponse)
    .catch(() => ({ partenaire: null, annonces: [] }));
  demandes.set(cle, { depuis: Date.now(), reponse });
  return reponse;
}

function compterVue(id: string) {
  fetch("/api/partenaires/vue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
    keepalive: true,
  }).catch(() => {});
}

const T = textes(
  {
    partenaire: "Partenaire",
    presentePar: "Présenté par",
    annonce: "Annonce",
    annonces: "Annonces",
    voir: "Voir le site",
    laquelle: (n: number, total: number, nom: string) => `Annonce ${n} sur ${total} : ${nom}`,
  },
  {
    partenaire: "Partner",
    presentePar: "Presented by",
    annonce: "Ad",
    annonces: "Ads",
    voir: "Visit website",
    laquelle: (n: number, total: number, nom: string) => `Ad ${n} of ${total}: ${nom}`,
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
  // Un partenaire seul, ou les annonces dans l'ordre tiré pour cet affichage.
  const [affiches, setAffiches] = useState<PartenaireAffiche[]>([]);
  const [indice, setIndice] = useState(0);
  const [visible, setVisible] = useState(false);
  const [survol, setSurvol] = useState(false);
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const vues = useRef(new Set<string>());
  const presentes = affiches.length > 0;

  useEffect(() => {
    // On attend de savoir : `null`, c'est peut-être un compte sans pub.
    if (sansPub !== false) return;
    let vivant = true;
    void affichesDe(emplacement, cid).then((r) => {
      if (!vivant) return;
      setAffiches(r.partenaire ? [r.partenaire] : melanger(r.annonces));
      setIndice(0);
    });
    return () => { vivant = false; };
  }, [emplacement, cid, sansPub]);

  // À l'écran (à moitié au moins) ou pas : les vues et le défilement en dépendent.
  useEffect(() => {
    const el = ref.current;
    if (!presentes || !el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [presentes]);

  // Une vue par marque réellement vue, une fois par affichage.
  const courante = affiches[indice] ?? affiches[0];
  useEffect(() => {
    if (!visible || !courante || vues.current.has(courante.id)) return;
    vues.current.add(courante.id);
    compterVue(courante.id);
  }, [visible, courante]);

  // Le défilement des annonces. `indice` dans les dépendances : un point
  // choisi à la main garde ses huit secondes entières.
  useEffect(() => {
    if (affiches.length < 2 || !visible || survol || focus) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const minuteur = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setIndice((i) => (i + 1) % affiches.length);
    }, DUREE_ANNONCE_MS);
    return () => window.clearInterval(minuteur);
  }, [affiches.length, visible, survol, focus, indice]);

  if (!courante || sansPub !== false) return null;

  const mention = courante.type === "annonce" ? t.annonce : courante.deLaCompetition ? t.presentePar : t.partenaire;
  const lien = (a: PartenaireAffiche) => `/api/partenaires/clic?id=${encodeURIComponent(a.id)}`;

  // LA BANNIÈRE : l'image de la marque, en 4:1 (voir lib/partenaires), la
  // mention et le nom au-dessus, en petit. L'image porte déjà son message ;
  // l'accroche sert de texte de remplacement aux lecteurs d'écran.
  // Recadrée au centre si la marque n'a pas respecté le format :
  // l'administration l'en prévient à l'envoi, aperçu à l'appui.
  //
  // En variante verticale : debout, 300 px de large au plus (300 × 600, le
  // format que les marques connaissent) — si TOUTES les annonces du
  // défilement ont leur visuel vertical. Sinon toutes en 4:1 : un visuel
  // debout suivi d'un couché ferait sauter le rail à chaque relève.
  if (courante.format === "banniere" && courante.imageUrl) {
    const debout = variante === "verticale" && affiches.every((a) => a.imageVerticaleUrl);
    const enRotation = affiches.length > 1;
    const banniere = (
      <>
        <span className="mb-1.5 flex items-baseline gap-2">
          <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{mention}</span>
          <span className="min-w-0 truncate text-xs font-bold text-gray-600">{courante.annonceur}</span>
          {courante.cliquable && (
            <span className="ml-auto hidden shrink-0 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700 @md:block">
              {t.voir} →
            </span>
          )}
        </span>
        <span
          aria-live={enRotation ? "off" : undefined}
          className={`relative block w-full overflow-hidden border border-gray-200/70 bg-gray-50 transition-colors group-hover:border-gray-400 ${debout ? "aspect-[1/2]" : "aspect-[4/1]"}`}
        >
          {/* Toutes les annonces superposées, une seule à pleine opacité :
              un fondu de l'une à l'autre, sans saut de mise en page. */}
          {affiches.map((a, i) => (
            <span
              key={a.id}
              aria-hidden={i === indice ? undefined : true}
              className={`absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none ${i === indice ? "opacity-100" : "opacity-0"}`}
            >
              <Image
                src={(debout ? a.imageVerticaleUrl : null) ?? a.imageUrl ?? ""}
                alt={a.accroche ? `${a.annonceur} : ${a.accroche}` : a.annonceur}
                fill
                sizes={debout ? "300px" : "(min-width: 800px) 768px, 100vw"}
                className="object-cover"
              />
            </span>
          ))}
        </span>
      </>
    );
    return (
      <div
        ref={ref}
        data-emplacement={emplacement}
        data-variante={debout ? "verticale" : "horizontale"}
        data-type={courante.type}
        data-affiche={courante.id}
        role={enRotation ? "region" : undefined}
        aria-roledescription={enRotation ? "carrousel" : undefined}
        aria-label={enRotation ? t.annonces : undefined}
        onMouseEnter={() => setSurvol(true)}
        onMouseLeave={() => setSurvol(false)}
        onFocus={() => setFocus(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false); }}
        className={`@container mx-auto w-full ${debout ? "max-w-[300px]" : "max-w-3xl"} ${className}`}
      >
        {courante.cliquable ? (
          // Le clic passe par le serveur, qui le compte et connaît seul la
          // destination. « sponsored » : les moteurs de recherche savent que
          // ce lien est payé.
          <a href={lien(courante)} target="_blank" rel="sponsored noopener" className="group block">
            {banniere}
          </a>
        ) : (
          <div>{banniere}</div>
        )}
        {enRotation && (
          <div className="mt-1 flex justify-center">
            {affiches.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setIndice(i)}
                aria-label={t.laquelle(i + 1, affiches.length, a.annonceur)}
                aria-current={i === indice ? "true" : undefined}
                className="flex h-6 w-6 items-center justify-center"
              >
                <span
                  className={`block h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out motion-reduce:transition-none ${
                    i === indice ? "w-4 bg-gray-700" : "w-1.5 bg-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // L'ENCADRÉ : un partenaire au format logo (une annonce est toujours une bannière).
  const contenu = (
    <>
      {courante.imageUrl && (
        <span className="relative h-12 w-24 shrink-0 @md:h-14 @md:w-32">
          <Image src={courante.imageUrl} alt="" fill sizes="128px" className="object-contain" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
          {mention}
        </span>
        <span className="mt-0.5 block truncate font-display text-base font-black tracking-tight text-gray-900">
          {courante.annonceur}
        </span>
        {courante.accroche && (
          <span className="mt-0.5 block text-xs leading-snug text-gray-500">{courante.accroche}</span>
        )}
      </span>
      {courante.cliquable && (
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
    <div ref={ref} data-emplacement={emplacement} data-type={courante.type} data-affiche={courante.id} className="@container">
      {courante.cliquable ? (
        <a href={lien(courante)} target="_blank" rel="sponsored noopener" className={`${classe} transition-colors hover:border-gray-400`}>
          {contenu}
        </a>
      ) : (
        <div className={classe}>{contenu}</div>
      )}
    </div>
  );
}
