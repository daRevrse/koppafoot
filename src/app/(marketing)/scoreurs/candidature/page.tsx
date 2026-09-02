"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModal";

// ============================================
// La candidature de scoreur.
//
// Décalque de celle des organisateurs, et pour la même raison qu'au serveur :
// deux formulaires écrits séparément pour la même mécanique auraient divergé,
// et c'est l'écran le plus rarement relu du produit — personne ne repasse sur
// une page qu'on ne voit qu'une fois.
//
// LA DEMANDE DE COMPTE VIENT EN DERNIER. Un visiteur arrive ici depuis la page
// publique, convaincu ou presque : lui opposer un mur avant de lui avoir dit
// ce qu'on attend de lui, c'est dépenser sa décision contre rien.
// ============================================

interface MaCandidature {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string | null;
}

function RetourALaPage() {
  return (
    <Link
      href="/scoreurs"
      className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-gray-400 transition-colors hover:text-gray-900"
    >
      <ChevronLeft size={14} />
      Devenir scoreur
    </Link>
  );
}

export default function CandidatureScoreurPage() {
  const { user, firebaseUser, loading } = useAuth();
  const authModal = useAuthModal();

  const [existante, setExistante] = useState<MaCandidature | null>(null);
  const [verification, setVerification] = useState(true);
  const [motivation, setMotivation] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);

  const chargerLaMienne = useCallback(async () => {
    // Un visiteur n'a aucune candidature à chercher : sans cette sortie, la
    // page tournerait indéfiniment sur son chargeur.
    if (!firebaseUser) {
      setVerification(false);
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/scorer-applications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { applications: MaCandidature[] };
        const enAttente = data.applications.find((a) => a.status === "pending");
        setExistante(enAttente ?? data.applications[0] ?? null);
      }
    } catch { /* sans conséquence : on affiche le formulaire */ } finally {
      setVerification(false);
    }
  }, [firebaseUser]);

  useEffect(() => { chargerLaMienne(); }, [chargerLaMienne]);

  useEffect(() => {
    if (user) {
      setCity((c) => c || user.locationCity || "");
      setPhone((p) => p || user.phone || "");
    }
  }, [user]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    if (motivation.trim().length < 20) {
      toast.error("Dis-nous en quelques phrases pourquoi tu veux couvrir des matchs.");
      return;
    }
    setEnvoi(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/scorer-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ motivation, city, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors de l'envoi.");
        return;
      }
      setEnvoyee(true);
    } catch {
      toast.error("Erreur réseau. Réessaie.");
    } finally {
      setEnvoi(false);
    }
  };

  const champ =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-all";

  // Le visiteur : le compte est la seule chose qu'on lui demande, et on le lui
  // dit après l'avoir convaincu, pas avant.
  if (!loading && !firebaseUser) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-10">
        <RetourALaPage />
        <div className="border border-gray-200/70 bg-white p-8 text-center sm:p-12">
          <h2 className="font-display text-xl font-black text-gray-900">
            Prêt à tenir ton premier match ?
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            Il faut d&apos;abord un compte KoppaFoot, Google suffit, et tu
            reviens ici pour déposer ta candidature.
          </p>
          <button
            type="button"
            onClick={() => authModal.open("Connecte-toi pour déposer ta candidature de scoreur.")}
            className="mt-5 bg-gray-900 px-8 py-4 text-sm font-black text-white transition-colors hover:bg-emerald-700"
          >
            Créer mon compte
          </button>
        </div>
      </div>
    );
  }

  if (verification || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  if (user?.isScorer) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-10">
        <RetourALaPage />
        <div className="border border-emerald-200 bg-emerald-50 p-8 text-center sm:p-12">
          <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
          <h2 className="mt-4 font-display text-xl font-black text-emerald-900">
            Tu es déjà scoreur
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-emerald-800">
            Les amicaux qui cherchent quelqu&apos;un t&apos;attendent dans ton
            espace.
          </p>
          <Link
            href="/live-ops"
            className="mt-5 inline-block bg-emerald-700 px-8 py-4 text-sm font-black text-white transition-colors hover:bg-emerald-800"
          >
            Ouvrir la console live
          </Link>
        </div>
      </div>
    );
  }

  if (envoyee || existante?.status === "pending") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-5 py-10">
        <RetourALaPage />
        <div className="border border-gray-200/70 bg-white p-8 text-center sm:p-12">
          <Clock size={36} className="mx-auto text-amber-500" />
          <h2 className="mt-4 font-display text-xl font-black text-gray-900">
            Candidature reçue
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
            On la lit et on revient vers toi. Une seule candidature à la fois :
            inutile de la renvoyer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-5 py-10">
      <RetourALaPage />

      {existante?.status === "rejected" && (
        <div className="flex items-start gap-3 border border-gray-200/70 bg-gray-50 p-4">
          <XCircle size={18} className="mt-0.5 shrink-0 text-gray-400" />
          <p className="text-[13px] leading-relaxed text-gray-600">
            Ta précédente candidature n&apos;a pas été retenue. Tu peux en
            déposer une nouvelle.
          </p>
        </div>
      )}

      <form onSubmit={envoyer} className="space-y-5 border border-gray-200/70 bg-white p-6 sm:p-8">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight text-gray-900">
            Devenir scoreur
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Dis-nous où tu es et pourquoi ça t&apos;intéresse. C&apos;est lu par
            quelqu&apos;un, pas par un formulaire.
          </p>
        </div>

        <div>
          <label htmlFor="motivation" className="mb-1.5 block text-xs font-bold text-gray-600">
            Pourquoi veux-tu couvrir des matchs ?
          </label>
          <textarea
            id="motivation"
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            rows={5}
            placeholder="Les terrains que tu fréquentes, les équipes que tu suis, ce que tu as déjà fait autour d'un match…"
            className={champ}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ville" className="mb-1.5 block text-xs font-bold text-gray-600">
              Ville
            </label>
            <input
              id="ville" type="text" value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Lomé" className={champ}
            />
          </div>
          <div>
            <label htmlFor="tel" className="mb-1.5 block text-xs font-bold text-gray-600">
              Téléphone <span className="font-normal text-gray-400">(optionnel)</span>
            </label>
            <input
              id="tel" type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+228…" className={champ}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={envoi}
          className="w-full bg-gray-900 py-4 text-sm font-black uppercase tracking-wide text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {envoi ? "Envoi…" : "Envoyer ma candidature"}
        </button>
      </form>
    </div>
  );
}
