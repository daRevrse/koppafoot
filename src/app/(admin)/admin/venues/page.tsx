"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { MapPin, Search, Loader2, ExternalLink, Star } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getAllVenues } from "@/lib/admin-firestore";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import type { Venue } from "@/types";
import { formatCourt, surfaceCourte, prixHeure, aUnPrix } from "@/lib/terrains";
import { Etiquette, Fanion, LignesDeTerrain } from "@/components/venue/venue-ui";
import Image from "next/image";

// ============================================
// Les terrains référencés, vue d'administration.
//
// À NE PAS CONFONDRE AVEC /admin/terrains, qui relit les CANDIDATURES. Les
// deux pages portaient des noms si voisins qu'on ouvrait l'une pour l'autre,
// et celle-ci n'était même pas dans le menu : elle n'existait que pour qui
// tapait l'adresse. Les libellés du menu les séparent désormais —
// « Candidatures terrain » d'un côté, « Terrains référencés » de l'autre.
//
// Elle est repassée à la langue visuelle du reste du parcours : angles
// francs, filets d'un cheveu, capitales serrées. Elle était restée au style
// d'avant — coins arrondis, anneaux bleus, pastilles violettes — ce qui la
// faisait ressembler à un autre produit, et surtout la sortait du thème
// sombre, dont les règles ne connaissent que le vocabulaire commun.
//
// Elle ne MODIFIE rien : un terrain se corrige par son propriétaire, dans son
// espace. Ce qu'on fait ici, c'est vérifier ce qui est publié — et ouvrir la
// fiche pour la voir comme une équipe la voit.
//
// UNE SEULE DÉCISION S'Y PREND : mettre un terrain À LA UNE du Direct, dans
// la carte qui défile à côté des Top performances (voir lib/vitrine). Elle
// vit dans `settings/vitrine`, hors de la fiche, que son propriétaire modifie
// lui-même.
// ============================================

export default function AdminVenuesPage() {
  const { firebaseUser } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [aLaUne, setALaUne] = useState<string[]>([]);
  const [bascule, setBascule] = useState<string | null>(null);

  useEffect(() => {
    getAllVenues(300).then(setVenues).finally(() => setLoading(false));
  }, []);

  // Les terrains à la une du Direct (voir lib/vitrine).
  useEffect(() => {
    if (!firebaseUser) return;
    let vivant = true;
    firebaseUser.getIdToken()
      .then((jeton) => fetch("/api/admin/terrains-a-la-une", { headers: { Authorization: `Bearer ${jeton}` } }))
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((d: { ids?: string[] }) => { if (vivant) setALaUne(d.ids ?? []); })
      .catch(() => {});
    return () => { vivant = false; };
  }, [firebaseUser]);

  const basculerALaUne = async (v: Venue) => {
    if (!firebaseUser) return;
    const mettre = !aLaUne.includes(v.id);
    setBascule(v.id);
    try {
      const rep = await fetch("/api/admin/terrains-a-la-une", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await firebaseUser.getIdToken()}` },
        body: JSON.stringify({ venueId: v.id, aLaUne: mettre }),
      });
      const d = await rep.json().catch(() => ({}));
      if (!rep.ok) throw new Error(d.error ?? "Erreur serveur");
      setALaUne(d.ids ?? []);
      toast.success(mettre ? `${v.name} est à la une du Direct` : `${v.name} n'est plus à la une`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Modification impossible");
    } finally {
      setBascule(null);
    }
  };

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter(
      (v) => v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q),
    );
  }, [venues, recherche]);

  const { page, setPage, pages, tranche, total, parPage } = usePagination(filtres, 24);

  const ouverts = venues.filter((v) => v.available).length;
  const complets = venues.filter((v) => v.photoUrl && aUnPrix(v.pricePerHour)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-black uppercase tracking-tight text-gray-900">
          <MapPin size={22} className="text-emerald-600" />
          Terrains référencés
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {venues.length} terrain{venues.length > 1 ? "s" : ""} publié{venues.length > 1 ? "s" : ""},{" "}
          {ouverts} ouvert{ouverts > 1 ? "s" : ""} aux demandes.
        </p>
      </div>

      {/* Le chiffre qui compte pour la suite : une fiche sans photo ni tarif
          ne se choisit pas, et c'est elle qu'il faudra aller relancer. */}
      {venues.length > 0 && (
        <div className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Publiés", valeur: venues.length },
            { label: "Ouverts", valeur: ouverts },
            { label: "Fiches complètes", valeur: `${complets} / ${venues.length}` },
            { label: "À la une du Direct", valeur: aLaUne.length },
          ].map((s) => (
            <div key={s.label} className="bg-white px-5 py-4">
              <Etiquette>{s.label}</Etiquette>
              <p className="mt-1 font-display text-2xl font-black tabular-nums text-gray-900">
                {s.valeur}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="relative max-w-md">
        <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Nom ou ville…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          aria-label="Rechercher un terrain"
          className="w-full border border-gray-200/70 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-300 focus:border-gray-900 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={26} className="animate-spin text-gray-300" />
        </div>
      ) : filtres.length === 0 ? (
        <div className="border border-gray-200/70 bg-white py-16 text-center">
          <MapPin size={30} className="mx-auto text-gray-300" strokeWidth={1.5} />
          <p className="mt-4 text-sm font-bold text-gray-400">
            {venues.length === 0 ? "Aucun terrain publié" : "Rien ne correspond"}
          </p>
        </div>
      ) : (
        <div className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2 lg:grid-cols-3">
          {tranche.map((v) => (
            <article key={v.id} className="flex flex-col bg-white">
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-900">
                {v.photoUrl ? (
                  <Image
                    src={v.photoUrl}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className={`object-cover ${v.available ? "" : "grayscale"}`}
                  />
                ) : (
                  <>
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
                    <LignesDeTerrain className="text-white/15" />
                  </>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-black uppercase leading-tight tracking-tight text-gray-900">
                      {v.name}
                    </h2>
                    <p className="mt-1 truncate text-[11px] font-bold text-gray-500">
                      {[v.address, v.city].filter(Boolean).join(", ") || "Adresse non précisée"}
                    </p>
                  </div>
                  <Fanion ton={v.available ? "ok" : "refus"}>
                    {v.available ? "Ouvert" : "Fermé"}
                  </Fanion>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                  <span>{formatCourt(v.fieldSize)}</span>
                  <span>{surfaceCourte(v.fieldSurface)}</span>
                  <span className={aUnPrix(v.pricePerHour) ? "text-gray-600" : ""}>
                    {prixHeure(v.pricePerHour)}
                  </span>
                </div>

                {(!v.photoUrl || !aUnPrix(v.pricePerHour)) && (
                  <p className="mt-3 text-[11px] font-bold text-amber-700">
                    Fiche incomplète : il manque {[!v.photoUrl && "la photo", !aUnPrix(v.pricePerHour) && "le tarif"].filter(Boolean).join(" et ")}.
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-[10px] font-black uppercase tracking-[0.12em] text-gray-500">
                  <Link
                    href={`/terrains/${v.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-emerald-700"
                  >
                    Fiche publique
                    <ExternalLink size={12} />
                  </Link>
                  {/* Celui qui gère le terrain : c'est lui qu'on relance pour
                      une fiche incomplète. */}
                  {v.ownerId && (
                    <Link href={`/admin/users/${v.ownerId}`} className="transition-colors hover:text-emerald-700">
                      Son gestionnaire
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void basculerALaUne(v)}
                    disabled={bascule === v.id}
                    aria-pressed={aLaUne.includes(v.id)}
                    className={`ml-auto inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                      aLaUne.includes(v.id) ? "text-amber-600 hover:text-amber-700" : "hover:text-amber-600"
                    }`}
                  >
                    {bascule === v.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Star size={12} className={aLaUne.includes(v.id) ? "fill-current" : ""} />
                    )}
                    {aLaUne.includes(v.id) ? "À la une" : "Mettre à la une"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pagination
        page={page} pages={pages} total={total} parPage={parPage}
        onPage={setPage} nom="terrain"
      />
    </div>
  );
}
