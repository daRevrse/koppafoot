"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminAction, useAdminApi } from "@/hooks/useAdminApi";
import { BOUTON_CONTOUR, BOUTON_VERT, Erreur, Modale } from "@/components/admin/ui";
import { FORMATS_AMICAL, lireAmicalAdmin } from "@/lib/amical-admin";
import type { EquipeAdmin } from "@/lib/admin-types";

// ============================================
// Programmer un amical depuis l'administration.
//
// Un manager défie un club et attend sa réponse. Ici le match est posé
// directement au calendrier des deux clubs : leurs managers sont prévenus et
// leurs joueurs convoqués (voir lib/amical-admin-server). C'est dit dans le
// formulaire, pour qu'on ne le découvre pas après coup.
//
// Les clubs ne se chargent qu'à l'ouverture : la liste des matchs n'a pas à
// payer cette lecture pour un bouton qu'on ne presse pas à chaque visite.
// ============================================

const CHAMP = "w-full border border-gray-200/70 bg-white px-2.5 py-2 text-sm outline-none focus:border-gray-900";
const LIBELLE = "mb-1 block text-xs font-semibold text-gray-500";

/** « AAAA-MM-JJ » du jour, à l'heure du navigateur : la borne du champ date. */
function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const VIDE = {
  homeTeamId: "", awayTeamId: "", awayName: "", date: "", time: "",
  venueName: "", venueCity: "", format: "11v11",
};

export default function AjouterAmical({ onDone }: { onDone: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState(VIDE);
  // L'adversaire : un club de la plateforme, ou un nom tapé.
  const [horsPlateforme, setHorsPlateforme] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const { data, erreur, chargement, recharger } = useAdminApi<{ equipes: EquipeAdmin[] }>(
    ouvert ? "/api/admin/equipes" : null,
  );
  const agir = useAdminAction();

  const clubs = useMemo(
    () => [...(data?.equipes ?? [])].sort((a, b) => a.nom.localeCompare(b.nom)),
    [data],
  );

  const fermer = () => {
    if (occupe) return;
    setOuvert(false);
    setForm(VIDE);
    setHorsPlateforme(false);
  };

  const poser = (patch: Partial<typeof VIDE>) => setForm((f) => ({ ...f, ...patch }));

  const programmer = async () => {
    const corps = horsPlateforme ? { ...form, awayTeamId: "" } : { ...form, awayName: "" };
    const lu = lireAmicalAdmin(corps, aujourdhui());
    if ("erreur" in lu) {
      toast.error(lu.erreur);
      return;
    }
    setOccupe(true);
    try {
      const { convoques } = await agir<{ id: string; convoques: number }>("/api/admin/matchs", "POST", lu.valeur);
      toast.success(
        convoques > 0
          ? `Match programmé, ${convoques} joueur${convoques > 1 ? "s" : ""} convoqué${convoques > 1 ? "s" : ""}`
          : "Match programmé",
      );
      setOuvert(false);
      setForm(VIDE);
      setHorsPlateforme(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La création du match a échoué");
    } finally {
      setOccupe(false);
    }
  };

  /** Un club sans manager ne peut pas tenir un match : proposé, mais grisé. */
  const option = (c: EquipeAdmin) => (
    <option key={c.id} value={c.id} disabled={!c.manager}>
      {c.nom}{c.ville ? `, ${c.ville}` : ""}{c.manager ? "" : " (sans manager)"}
    </option>
  );

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={BOUTON_VERT}>
        <Plus size={13} /> Ajouter un amical
      </button>

      {ouvert && (
        <Modale titre="Ajouter un amical" onFermer={fermer} largeur="max-w-lg">
          {erreur ? (
            <Erreur message={erreur} onReessayer={recharger} />
          ) : chargement ? (
            <p className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <Loader2 size={15} className="animate-spin" /> Lecture des clubs…
            </p>
          ) : (
            <div className="space-y-3">
              <p className="border border-gray-200/70 bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
                Le match est programmé tout de suite, sans défi à accepter : les managers
                des deux clubs sont prévenus et leurs joueurs convoqués.
              </p>

              <div>
                <label htmlFor="amical-domicile" className={LIBELLE}>Équipe à domicile</label>
                <select
                  id="amical-domicile"
                  className={CHAMP}
                  value={form.homeTeamId}
                  onChange={(e) => poser({
                    homeTeamId: e.target.value,
                    // Le même club des deux côtés n'est pas un match.
                    awayTeamId: e.target.value === form.awayTeamId ? "" : form.awayTeamId,
                  })}
                >
                  <option value="">Choisir un club…</option>
                  {clubs.map(option)}
                </select>
              </div>

              <div>
                <span className={LIBELLE}>Adversaire</span>
                <div className="mb-2 flex gap-4 text-sm text-gray-700">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="amical-adversaire" checked={!horsPlateforme} onChange={() => setHorsPlateforme(false)} />
                    Club KoppaFoot
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="amical-adversaire" checked={horsPlateforme} onChange={() => setHorsPlateforme(true)} />
                    Hors plateforme
                  </label>
                </div>
                {horsPlateforme ? (
                  <input
                    type="text"
                    aria-label="Nom de l'adversaire"
                    placeholder="Nom de l'équipe adverse"
                    maxLength={80}
                    className={CHAMP}
                    value={form.awayName}
                    onChange={(e) => poser({ awayName: e.target.value })}
                  />
                ) : (
                  <select
                    aria-label="Club adverse"
                    className={CHAMP}
                    value={form.awayTeamId}
                    onChange={(e) => poser({ awayTeamId: e.target.value })}
                  >
                    <option value="">Choisir un club…</option>
                    {clubs.filter((c) => c.id !== form.homeTeamId).map(option)}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="amical-date" className={LIBELLE}>Date</label>
                  <input
                    id="amical-date"
                    type="date"
                    min={aujourdhui()}
                    className={CHAMP}
                    value={form.date}
                    onChange={(e) => poser({ date: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="amical-heure" className={LIBELLE}>Heure</label>
                  <input
                    id="amical-heure"
                    type="time"
                    className={CHAMP}
                    value={form.time}
                    onChange={(e) => poser({ time: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="amical-terrain" className={LIBELLE}>Terrain</label>
                  <input
                    id="amical-terrain"
                    type="text"
                    maxLength={120}
                    className={CHAMP}
                    value={form.venueName}
                    onChange={(e) => poser({ venueName: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="amical-ville" className={LIBELLE}>Ville</label>
                  <input
                    id="amical-ville"
                    type="text"
                    maxLength={80}
                    className={CHAMP}
                    value={form.venueCity}
                    onChange={(e) => poser({ venueCity: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="amical-format" className={LIBELLE}>Format</label>
                <select
                  id="amical-format"
                  className={CHAMP}
                  value={form.format}
                  onChange={(e) => poser({ format: e.target.value })}
                >
                  {FORMATS_AMICAL.map((f) => (
                    <option key={f} value={f}>{f.split("v")[0]} contre {f.split("v")[0]}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={fermer} disabled={occupe} className={BOUTON_CONTOUR}>
                  Annuler
                </button>
                <button type="button" onClick={programmer} disabled={occupe} className={BOUTON_VERT}>
                  {occupe ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Programmer le match
                </button>
              </div>
            </div>
          )}
        </Modale>
      )}
    </>
  );
}
