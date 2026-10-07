"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, EyeOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { getAllCompetitions, setCompetitionValidated } from "@/lib/admin-firestore";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useATraiter } from "@/components/admin/ATraiterContext";
import {
  BOUTON_CONTOUR, BOUTON_VERT, Carte, Chargement, EnTete, Filtres, Pastille, Recherche, Vide, dateDeMatch, type Ton,
} from "@/components/admin/ui";
import type { Competition } from "@/types";

// ============================================
// Les compétitions, et la porte du public.
//
// Une compétition n'est montrée au public que publiée par son organisateur
// ET validée ici. « À valider » ne compte que celles que leur organisateur a
// publiées : un brouillon n'attend rien de l'administration, et le compter
// faisait croire à du travail en retard.
// ============================================

const STATUTS: Record<string, { label: string; ton: Ton }> = {
  draft: { label: "Brouillon", ton: "gris" },
  registration: { label: "Inscriptions", ton: "bleu" },
  registration_closed: { label: "Inscriptions closes", ton: "ambre" },
  group_stage: { label: "Phase de groupes", ton: "vert" },
  knockout: { label: "Phase finale", ton: "vert" },
  completed: { label: "Terminée", ton: "gris" },
};

type Filtre = "a_valider" | "publiques" | "brouillons" | "toutes";

const aValider = (c: Competition) => !c.isValidated && c.status !== "draft";

export default function AdminCompetitionsPage() {
  const [comps, setComps] = useState<Competition[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [enCours, setEnCours] = useState<string | null>(null);
  const { rafraichir } = useATraiter();

  const charger = useCallback(() => {
    getAllCompetitions()
      .then((c) => {
        setComps(c);
        // On ouvre sur ce qui attend, quand quelque chose attend.
        if (c.some(aValider)) setFiltre("a_valider");
      })
      .catch(() => toast.error("Lecture des compétitions impossible"))
      .finally(() => setChargement(false));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return comps.filter((c) => {
      if (filtre === "a_valider" && !aValider(c)) return false;
      if (filtre === "publiques" && !(c.isValidated && c.status !== "draft")) return false;
      if (filtre === "brouillons" && c.status !== "draft") return false;
      if (q) return `${c.name} ${c.organizerName ?? ""} ${c.venueCity ?? ""}`.toLowerCase().includes(q);
      return true;
    });
  }, [comps, recherche, filtre]);
  const { page, setPage, pages, tranche, total, parPage } = usePagination(filtrees, 25);

  const basculer = async (c: Competition) => {
    const versValide = !c.isValidated;
    if (!versValide && !window.confirm(
      `Retirer « ${c.name} » du public ?\n\nElle disparaîtra du Direct, de l'annuaire et des liens partagés. Son organisateur la garde intacte.`,
    )) return;
    setEnCours(c.id);
    try {
      await setCompetitionValidated(c.id, versValide);
      setComps((prev) => prev.map((x) => (x.id === c.id ? { ...x, isValidated: versValide } : x)));
      toast.success(versValide ? `« ${c.name} » est validée` : `« ${c.name} » retirée du public`);
      rafraichir();
    } catch {
      toast.error("L'opération a échoué");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <EnTete
        titre="Compétitions"
        sousTitre="Visible du public une fois publiée par son organisateur et validée ici."
      />
      <Filtres<Filtre>
        valeur={filtre}
        onChange={setFiltre}
        options={[
          { valeur: "a_valider", label: "À valider", compte: comps.filter(aValider).length },
          { valeur: "publiques", label: "Publiques", compte: comps.filter((c) => c.isValidated && c.status !== "draft").length },
          { valeur: "brouillons", label: "Brouillons", compte: comps.filter((c) => c.status === "draft").length },
          { valeur: "toutes", label: "Toutes", compte: comps.length },
        ]}
      />
      <Recherche valeur={recherche} onChange={setRecherche} placeholder="Nom, organisateur, ville…" />

      {chargement ? (
        <Chargement />
      ) : filtrees.length === 0 ? (
        <Vide titre="Aucune compétition" />
      ) : (
        <Carte>
          <ul className="divide-y divide-gray-200/70">
            {tranche.map((c) => {
              const st = STATUTS[c.status] ?? { label: c.status, ton: "gris" as const };
              const organisateur = c.organizerIds[0];
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* LA FICHE D'ADMINISTRATION, pas la page publique : on y
                          décide de la validation, et on y trouve qui joindre. */}
                      <Link href={`/admin/competitions/${c.id}`} className="text-sm font-black text-gray-900 hover:text-emerald-700">
                        {c.name}
                      </Link>
                      <Pastille ton={st.ton}>{st.label}</Pastille>
                      {aValider(c) && <Pastille ton="ambre">À valider</Pastille>}
                      {c.isValidated === false && c.status === "draft" && <Pastille>Pas encore publiée</Pastille>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {organisateur ? (
                        <Link href={`/admin/users/${organisateur}`} className="font-semibold hover:text-gray-900">
                          {c.organizerName ?? "Organisateur"}
                        </Link>
                      ) : (c.organizerName ?? "Sans organisateur")}
                      {c.venueCity ? ` · ${c.venueCity}` : ""}
                      {c.startDate ? ` · dès le ${dateDeMatch(c.startDate.slice(0, 10))}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => basculer(c)}
                    disabled={enCours === c.id}
                    className={c.isValidated ? BOUTON_CONTOUR : BOUTON_VERT}
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
          <Pagination page={page} pages={pages} total={total} parPage={parPage} onPage={setPage} nom="compétition" />
        </Carte>
      )}
    </div>
  );
}
