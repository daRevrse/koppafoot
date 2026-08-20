"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Loader2, Check, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isVenueOwner } from "@/lib/hats";

// ============================================
// Candidature « propriétaire de terrain ».
//
// Référencer un terrain, c'est publier une adresse et se présenter comme son
// gestionnaire. Rien n'empêche techniquement de le faire pour le terrain du
// voisin, d'où une relecture humaine, comme pour l'organisateur.
//
// La casquette qui en découle S'AJOUTE au compte : on reste joueur, manager
// ou arbitre en devenant propriétaire. C'est tout l'objet de la séparation
// entre ce qu'on est sur le terrain et ce qu'on y fait.
//
// Le formulaire porte déjà la fiche du terrain : à l'approbation, le terrain
// est créé dans la foulée, sans rien redemander.
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

const inputClass =
  "w-full border border-gray-200/70 bg-white px-4 py-3 text-sm font-semibold text-gray-900 placeholder:font-medium placeholder:text-gray-300 focus:border-gray-900 focus:outline-none transition-colors";

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
          className={`border px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
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

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-6 sm:px-10">
        <nav
          aria-label="Fil d'ariane"
          className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
        >
          <Link href="/" className="transition-colors hover:text-emerald-700">Direct</Link>
          <span aria-hidden className="text-gray-300">›</span>
          <Link href="/terrains" className="transition-colors hover:text-emerald-700">MyFields</Link>
          <span aria-hidden className="text-gray-300">›</span>
          <span className="text-gray-600">Candidature</span>
        </nav>
        {children}
      </div>
    </section>
  );
}

export default function VenueApplicationPage() {
  const { user, firebaseUser, loading } = useAuth();

  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [fieldSize, setFieldSize] = useState("11v11");
  const [fieldSurface, setFieldSurface] = useState("synthetic");
  const [phone, setPhone] = useState("");
  const [motivation, setMotivation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!user) return;
    setCity((c) => c || user.locationCity || "");
    setPhone((p) => p || user.phone || "");
  }, [user]);

  if (loading) {
    return (
      <Frame>
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      </Frame>
    );
  }

  // Déjà propriétaire : la candidature n'a plus lieu d'être, on ajoute le
  // terrain suivant depuis son espace.
  if (isVenueOwner(user)) {
    return (
      <Frame>
        <div className="border border-gray-200/70 bg-white p-8 text-center sm:p-12">
          <MapPin size={30} className="mx-auto text-emerald-600" strokeWidth={1.5} />
          <h1 className="mt-4 font-display text-xl font-black uppercase tracking-tight text-gray-900">
            Tu gères déjà des terrains
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Le terrain suivant s&apos;ajoute depuis ton espace, sans repasser par ici.
          </p>
          <Link
            href="/mes-terrains"
            className="mt-6 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
          >
            Mes terrains
            <ArrowRight size={15} />
          </Link>
        </div>
      </Frame>
    );
  }

  // Pas de compte : la connexion, avec le contexte de CETTE fonction et le
  // retour ici une fois le compte créé.
  if (!firebaseUser) {
    return (
      <Frame>
        <div className="border border-gray-200/70 bg-white p-8 sm:p-12">
          <h1 className="font-display text-3xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-4xl">
            Référencer un terrain
          </h1>
          <p className="mt-5 text-base leading-relaxed text-gray-600">
            Il faut un compte : la fiche du terrain sera rattachée au vôtre, et
            c&apos;est par lui que les équipes vous joindront.
          </p>
          <Link
            href="/login?for=terrain&next=/terrains/candidature"
            className="mt-8 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-8 py-5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
          >
            Créer mon compte
            <ArrowRight size={16} />
          </Link>
        </div>
      </Frame>
    );
  }

  if (sent) {
    return (
      <Frame>
        <div className="border border-gray-200/70 bg-white p-8 text-center sm:p-12">
          <Check size={30} className="mx-auto text-emerald-600" strokeWidth={1.5} />
          <h1 className="mt-4 font-display text-xl font-black uppercase tracking-tight text-gray-900">
            Candidature envoyée
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
            On relit la fiche et on vous répond. À l&apos;approbation, le terrain
            est publié et votre espace s&apos;ouvre, sans rien resaisir.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 transition-colors hover:text-emerald-700"
          >
            Retour au direct
          </Link>
        </div>
      </Frame>
    );
  }

  const submit = async () => {
    if (!firebaseUser) return;
    if (venueName.trim().length < 2) { toast.error("Indique le nom du terrain."); return; }
    if (city.trim().length < 2) { toast.error("Indique la ville du terrain."); return; }

    setSubmitting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/venue-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ venueName, city, address, fieldSize, fieldSurface, phone, motivation }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur lors de l'envoi."); return; }
      setSent(true);
    } catch {
      toast.error("Erreur réseau. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Frame>
      <h1 className="font-display text-3xl font-black uppercase leading-[0.95] tracking-tight text-gray-900 sm:text-4xl">
        Référencer un terrain
      </h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600">
        On relit chaque fiche avant publication : un terrain référencé engage
        celui qui le gère. Ça ne change rien à votre rôle sur le terrain, on
        reste joueur, manager ou arbitre en devenant propriétaire.
      </p>

      <div className="mt-8 space-y-5 border border-gray-200/70 bg-white p-6 sm:p-8">
        <div>
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            Nom du terrain
          </label>
          <input
            type="text" value={venueName} onChange={(e) => setVenueName(e.target.value)}
            placeholder="ex: Terrain municipal" className={inputClass}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
              Ville
            </label>
            <input
              type="text" value={city} onChange={(e) => setCity(e.target.value)}
              placeholder="Ta ville" className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
              Téléphone
            </label>
            <input
              type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="ex: 90 00 00 00" className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            Adresse <span className="font-bold normal-case text-gray-300">(optionnel)</span>
          </label>
          <input
            type="text" value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="Rue, quartier" className={inputClass}
          />
        </div>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Format</p>
          <Pills options={SIZES} value={fieldSize} onChange={setFieldSize} />
        </div>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Surface</p>
          <Pills options={SURFACES} value={fieldSurface} onChange={setFieldSurface} />
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            Votre lien avec ce terrain <span className="font-bold normal-case text-gray-300">(optionnel)</span>
          </label>
          <textarea
            value={motivation} onChange={(e) => setMotivation(e.target.value)} rows={3}
            placeholder="Propriétaire, gérant, association qui l'exploite…"
            className={`${inputClass} resize-none`}
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 border border-gray-900 bg-gray-900 px-8 py-5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700 disabled:opacity-40"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
          Envoyer ma candidature
        </button>
      </div>
    </Frame>
  );
}
