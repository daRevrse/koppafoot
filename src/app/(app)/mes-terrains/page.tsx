"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Plus, Trash2, Loader2, Pencil, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  onVenuesByOwner, createVenue, updateVenue, deleteVenue,
  onBookingsByOwner, updateBookingStatus,
} from "@/lib/firestore";
import type { Venue, Booking } from "@/types";
import { isVenueOwner } from "@/lib/hats";

// ============================================
// Mes terrains, la gestion, côté propriétaire.
//
// Un propriétaire peut en avoir plusieurs : c'est pour ça que le terrain est
// un document à part et non trois champs sur son compte, comme la recherche
// le supposait jusqu'ici.
//
// Ce que cette page NE fait pas, et la page publique /terrains le dit dans
// les mêmes termes : pas de réservation, pas de calendrier d'occupation, pas
// d'encaissement. Référencer et être trouvé, c'est tout, promettre le reste
// fabriquerait des déçus le jour de la première demande de créneau.
// ============================================

const SIZES = [
  { value: "5v5", label: "5 contre 5" },
  { value: "7v7", label: "7 contre 7" },
  { value: "11v11", label: "11 contre 11" },
  { value: "futsal", label: "Futsal" },
];

const SURFACES = [
  { value: "natural_grass", label: "Pelouse" },
  { value: "synthetic", label: "Synthétique" },
  { value: "hybrid", label: "Hybride" },
  { value: "indoor", label: "Intérieur" },
];

/** « samedi 23 août », la date d'un créneau, telle qu'on la dit. */
function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

const label = (list: { value: string; label: string }[], v: string) =>
  list.find((x) => x.value === v)?.label ?? v;

const inputClass =
  "w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-300 focus:border-gray-900 focus:outline-none";

interface Draft {
  name: string;
  address: string;
  city: string;
  fieldSize: string;
  fieldSurface: string;
  available: boolean;
}

const emptyDraft = (city: string): Draft => ({
  name: "", address: "", city, fieldSize: "11v11", fieldSurface: "synthetic", available: true,
});

function Pills({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
            value === o.value
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function VenueForm({ draft, setDraft, onSubmit, onCancel, busy, submitLabel }: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4 border border-gray-200/70 bg-white p-5">
      <div>
        <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
          Nom du terrain
        </label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="ex: Terrain municipal"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            Ville
          </label>
          <input
            type="text"
            value={draft.city}
            onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            placeholder="Ta ville"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            Adresse <span className="font-bold normal-case text-gray-300">(optionnel)</span>
          </label>
          <input
            type="text"
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            placeholder="Rue, quartier"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
          Format
        </label>
        <Pills options={SIZES} value={draft.fieldSize} onChange={(v) => setDraft({ ...draft, fieldSize: v })} />
      </div>

      <div>
        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
          Surface
        </label>
        <Pills options={SURFACES} value={draft.fieldSurface} onChange={(v) => setDraft({ ...draft, fieldSurface: v })} />
      </div>

      {/* Un terrain fermé pour travaux reste référencé mais cesse d'être
          proposé : le retirer et le ressaisir ensuite serait une punition. */}
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={draft.available}
          onChange={(e) => setDraft({ ...draft, available: e.target.checked })}
          className="h-4 w-4 accent-emerald-600"
        />
        <span className="text-[11px] font-bold text-gray-600">
          Disponible, décoche si le terrain est fermé pour le moment
        </span>
      </label>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !draft.name.trim()}
          className="flex items-center gap-2 border border-gray-900 bg-gray-900 px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700 disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 border border-gray-200/70 px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
        >
          <X size={14} />
          Annuler
        </button>
      </div>
    </div>
  );
}

export default function MyVenuesPage() {
  const { user, loading: authLoading } = useAuth();
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft(""));
  const [busy, setBusy] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = onVenuesByOwner(user.uid, setVenues);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onBookingsByOwner(user.uid, setBookings);
    return unsub;
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (!user) return null;

  // La casquette s'obtient par candidature. Sans elle, cette page n'a rien a
  // gerer, on renvoie la ou on peut la demander plutot que d'afficher un
  // espace vide qui laisse croire a une panne.
  if (!isVenueOwner(user)) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="border border-gray-200/70 bg-white p-8 text-center sm:p-12">
          <MapPin size={30} className="mx-auto text-gray-300" strokeWidth={1.5} />
          <h1 className="mt-4 font-display text-xl font-black uppercase tracking-tight text-gray-900">
            Pas encore de terrain
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
            Referencer un terrain passe par une candidature : on relit la fiche
            avant de la publier. Ca ne change rien a votre role sur le terrain.
          </p>
          <Link
            href="/terrains/candidature"
            className="mt-6 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
          >
            Referencer mon terrain
          </Link>
        </div>
      </div>
    );
  }

  // Le passe ne demande plus rien : une demande pour hier n'a pas a occuper
  // la boite de reception.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((b) => b.date >= today);
  const pending = upcoming.filter((b) => b.status === "pending");
  const confirmed = upcoming
    .filter((b) => b.status === "confirmed")
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const startAdd = () => {
    setDraft(emptyDraft(user.locationCity ?? ""));
    setEditing(null);
    setAdding(true);
  };

  const startEdit = (v: Venue) => {
    setDraft({
      name: v.name, address: v.address, city: v.city,
      fieldSize: v.fieldSize, fieldSurface: v.fieldSurface, available: v.available,
    });
    setAdding(false);
    setEditing(v.id);
  };

  const save = async () => {
    setBusy(true);
    try {
      const common = {
        name: draft.name.trim(),
        address: draft.address.trim(),
        city: draft.city.trim(),
        fieldSize: draft.fieldSize as Venue["fieldSize"],
        fieldSurface: draft.fieldSurface as Venue["fieldSurface"],
        fieldType: (draft.fieldSurface === "indoor" ? "indoor" : "outdoor") as Venue["fieldType"],
        available: draft.available,
      };
      if (editing) {
        await updateVenue(editing, common);
        toast.success("Terrain mis à jour");
      } else {
        await createVenue({ ...common, ownerId: user.uid, pricePerHour: 0, amenities: [], photoUrl: null });
        toast.success("Terrain référencé");
      }
      setAdding(false);
      setEditing(null);
    } catch (err) {
      console.error("Venue save failed:", err);
      toast.error("L'enregistrement a échoué");
    } finally {
      setBusy(false);
    }
  };

  const answer = async (b: Booking, status: "confirmed" | "cancelled") => {
    try {
      await updateBookingStatus(b.id, status);
      toast.success(status === "confirmed" ? "Créneau confirmé" : "Demande refusée");
    } catch (err) {
      console.error("Booking answer failed:", err);
      toast.error("L'enregistrement a échoué");
    }
  };

  const remove = async (v: Venue) => {
    if (!confirm(`Retirer « ${v.name} » de la plateforme ? Les équipes ne le trouveront plus.`)) return;
    try {
      await deleteVenue(v.id);
      toast.success("Terrain retiré");
    } catch {
      toast.error("La suppression a échoué");
    }
  };

  return (
    <div className="mx-auto max-w-4xl pb-24">
      <nav
        aria-label="Fil d'ariane"
        className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        <Link href="/" className="transition-colors hover:text-emerald-700">Direct</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <Link href="/evolution" className="transition-colors hover:text-emerald-700">Mon rôle</Link>
        <span aria-hidden className="text-gray-300">›</span>
        <span className="text-gray-600">Mes terrains</span>
      </nav>

      <section className="sticky top-[var(--header-h,72px)] z-30 -mx-3 overflow-hidden bg-gray-900 text-white lg:-mx-5">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
        <div className="relative mx-auto max-w-4xl px-5 py-6 sm:px-8 sm:py-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
            Espace terrain
          </p>
          <h1 className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            Mes terrains
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
            Un terrain référencé est un terrain que les équipes et les
            organisateurs trouvent dans la recherche. La réservation en ligne
            n&apos;existe pas encore : la suite se règle entre vous et
            l&apos;équipe.
          </p>
        </div>
      </section>

      {/* Les demandes d'abord : c'est ce qui attend une reponse. La liste des
          terrains, elle, ne bouge pas d'un jour a l'autre. */}
      {pending.length > 0 && (
        <section className="mt-6">
          <h2 className="border-b border-gray-200/70 pb-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
            Demandes en attente ({pending.length})
          </h2>
          <ul className="divide-y divide-gray-200/70 border-x border-b border-gray-200/70 bg-white">
            {pending.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">{b.userName || "Un joueur"}</p>
                  <p className="mt-1 text-[11px] font-bold text-gray-500">
                    {b.venueName} · {longDate(b.date)} à {b.time} · {b.duration} h
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => answer(b, "confirmed")}
                    className="flex items-center gap-1.5 border border-gray-900 bg-gray-900 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
                  >
                    <Check size={13} /> Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => answer(b, "cancelled")}
                    className="flex items-center gap-1.5 border border-gray-200/70 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-500 transition-colors hover:border-red-500 hover:text-red-500"
                  >
                    <X size={13} /> Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirmed.length > 0 && (
        <section className="mt-8">
          <h2 className="border-b border-gray-200/70 pb-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
            Créneaux confirmés
          </h2>
          <ul className="divide-y divide-gray-200/70 border-x border-b border-gray-200/70 bg-white">
            {confirmed.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                <p className="text-[11px] font-bold text-gray-600">
                  <span className="text-gray-900">{b.userName || "Un joueur"}</span>
                  {" · "}{b.venueName} · {longDate(b.date)} à {b.time} · {b.duration} h
                </p>
                <button
                  type="button"
                  onClick={() => answer(b, "cancelled")}
                  className="shrink-0 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-red-500"
                >
                  Annuler
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 space-y-4">
        {!adding && !editing && (
          <button
            type="button"
            onClick={startAdd}
            className="flex items-center gap-2 border border-gray-900 bg-gray-900 px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
          >
            <Plus size={14} />
            Ajouter un terrain
          </button>
        )}

        {adding && (
          <VenueForm
            draft={draft} setDraft={setDraft} onSubmit={save}
            onCancel={() => setAdding(false)} busy={busy} submitLabel="Référencer"
          />
        )}

        {venues === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
          </div>
        ) : venues.length === 0 && !adding ? (
          <div className="border border-gray-200/70 bg-white py-16 text-center">
            <MapPin size={30} className="mx-auto text-gray-300" strokeWidth={1.5} />
            <p className="mt-4 font-display text-lg font-black text-gray-900">Aucun terrain</p>
            <p className="mt-1 text-sm text-gray-500">
              Référence ton premier terrain pour qu&apos;on te trouve.
            </p>
          </div>
        ) : (
          venues.map((v) =>
            editing === v.id ? (
              <VenueForm
                key={v.id}
                draft={draft} setDraft={setDraft} onSubmit={save}
                onCancel={() => setEditing(null)} busy={busy} submitLabel="Enregistrer"
              />
            ) : (
              <article key={v.id} className="border border-gray-200/70 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-black uppercase tracking-tight text-gray-900">
                      {v.name}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                      <MapPin size={12} />
                      {[v.address, v.city].filter(Boolean).join(", ") || "Adresse non précisée"}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/terrains/${v.id}`}
                      className="border border-gray-200/70 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
                    >
                      Voir la fiche
                    </Link>
                    <button
                      type="button"
                      onClick={() => startEdit(v)}
                      aria-label="Modifier"
                      className="border border-gray-200/70 p-2 text-gray-400 transition-colors hover:border-gray-900 hover:text-gray-900"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(v)}
                      aria-label="Retirer"
                      className="border border-gray-200/70 p-2 text-gray-400 transition-colors hover:border-red-500 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                  <span>{label(SIZES, v.fieldSize)}</span>
                  <span>{label(SURFACES, v.fieldSurface)}</span>
                  <span className={v.available ? "text-emerald-700" : "text-red-500"}>
                    {v.available ? "Disponible" : "Fermé"}
                  </span>
                </div>
              </article>
            ),
          )
        )}
      </div>
    </div>
  );
}
