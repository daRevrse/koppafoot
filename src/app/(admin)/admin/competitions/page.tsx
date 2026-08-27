"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Trophy, Search, Loader2, CheckCircle2, EyeOff, Calendar, MapPin, User,
} from "lucide-react";
import toast from "react-hot-toast";
import { getAllCompetitions, setCompetitionValidated } from "@/lib/admin-firestore";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import type { Competition } from "@/types";

// ============================================
// Les compétitions, et la porte du public.
//
// N'importe quel organisateur publiait au Direct, dans l'annuaire et dans les
// liens de partage sans que personne n'ait rien à dire. La validation ne bloque
// RIEN de la préparation — l'organisateur inscrit ses équipes, génère son
// calendrier, tient sa console — elle décide seulement de ce qui est montré au
// public.
//
// Les compétitions créées avant ce champ sont considérées validées : les faire
// disparaître d'un coup aurait vidé le Direct.
// ============================================

const STATUTS: Record<string, { label: string; classe: string }> = {
  draft: { label: "Brouillon", classe: "bg-gray-100 text-gray-600" },
  registration: { label: "Inscriptions", classe: "bg-blue-50 text-blue-700" },
  group_stage: { label: "Phase de groupes", classe: "bg-emerald-50 text-emerald-700" },
  knockout: { label: "Phase finale", classe: "bg-amber-50 text-amber-700" },
  completed: { label: "Terminée", classe: "bg-gray-100 text-gray-500" },
};

type Filtre = "all" | "pending" | "validated";

export default function AdminCompetitionsPage() {
  const [comps, setComps] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("all");
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(() => {
    getAllCompetitions()
      .then(setComps)
      .catch(() => toast.error("Chargement impossible"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const filtrees = useMemo(() => {
    return comps.filter((c) => {
      if (filtre === "pending" && c.isValidated) return false;
      if (filtre === "validated" && !c.isValidated) return false;
      if (search) {
        const s = search.toLowerCase();
        return c.name.toLowerCase().includes(s)
          || (c.organizerName ?? "").toLowerCase().includes(s)
          || (c.venueCity ?? "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [comps, search, filtre]);

  const { page, setPage, pages, tranche, total, parPage } = usePagination(filtrees, 20);
  const enAttente = comps.filter((c) => !c.isValidated).length;

  const basculer = async (c: Competition) => {
    const versValide = !c.isValidated;
    if (!versValide && !window.confirm(
      `Retirer « ${c.name} » du public ?\n\nElle disparaîtra du Direct, de l'annuaire et des liens partagés. Son organisateur la garde intacte.`
    )) return;

    setEnCours(c.id);
    try {
      await setCompetitionValidated(c.id, versValide);
      setComps((prev) => prev.map((x) => (x.id === c.id ? { ...x, isValidated: versValide } : x)));
      toast.success(versValide ? `« ${c.name} » est publique` : `« ${c.name} » retirée du public`);
    } catch {
      toast.error("L'opération a échoué");
    } finally {
      setEnCours(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-display text-2xl font-extrabold text-gray-900"
        >
          Compétitions
        </motion.h1>
        <p className="mt-1 text-sm text-gray-500">
          {comps.length} compétition{comps.length > 1 ? "s" : ""}
          {enAttente > 0 && (
            <> · <span className="font-semibold text-amber-600">{enAttente} en attente de validation</span></>
          )}
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, organisateur, ville…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-1">
          {([
            { v: "all" as const, label: "Toutes" },
            { v: "pending" as const, label: "À valider" },
            { v: "validated" as const, label: "Publiques" },
          ]).map((f) => (
            <button
              key={f.v}
              onClick={() => setFiltre(f.v)}
              className={`rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${
                filtre === f.v ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {filtrees.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white py-16 text-gray-400">
          <Trophy size={40} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">Aucune compétition</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <ul className="divide-y divide-gray-50">
            {tranche.map((c) => {
              const st = STATUTS[c.status] ?? { label: c.status, classe: "bg-gray-100 text-gray-600" };
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={c.slug ? `/c/${c.slug}` : `/competitions`}
                        className="text-sm font-bold text-gray-900 hover:text-emerald-700 hover:underline"
                      >
                        {c.name}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.classe}`}>
                        {st.label}
                      </span>
                      {!c.isValidated && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600">
                          <EyeOff size={10} /> Hors du public
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                      {c.organizerName && (
                        <span className="flex items-center gap-1"><User size={10} /> {c.organizerName}</span>
                      )}
                      {c.venueCity && (
                        <span className="flex items-center gap-1"><MapPin size={10} /> {c.venueCity}</span>
                      )}
                      {c.startDate && (
                        <span className="flex items-center gap-1"><Calendar size={10} /> {c.startDate.slice(0, 10)}</span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => basculer(c)}
                    disabled={enCours === c.id}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50 ${
                      c.isValidated
                        ? "border border-gray-200 text-gray-500 hover:bg-gray-50"
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    }`}
                  >
                    {enCours === c.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : c.isValidated ? <EyeOff size={13} /> : <CheckCircle2 size={13} />}
                    {c.isValidated ? "Retirer du public" : "Valider"}
                  </button>
                </li>
              );
            })}
          </ul>

          <Pagination
            page={page} pages={pages} total={total} parPage={parPage}
            onPage={setPage} nom="compétition"
          />
        </div>
      )}
    </div>
  );
}
