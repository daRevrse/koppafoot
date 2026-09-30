"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { genreRequis, type Genre } from "@/lib/genre";
import ChoixDuGenre from "./ChoixDuGenre";

// ============================================
// « Une précision », pour les comptes à rôle d'avant le genre.
//
// Le genre se demande à l'activation d'un rôle ; mais tous ceux qui en ont
// déjà un l'ont activé sans qu'on le leur demande. Ils le disent ici, à leur
// prochaine visite, en un geste — et plus jamais ensuite.
//
// « PLUS TARD » VAUT POUR LA SESSION, pas pour toujours : la question revient
// à la visite suivante, parce que c'est une donnée dont le produit a besoin
// (accords, mercato), pas une suggestion. Mais elle ne bloque rien : on ne
// retient pas quelqu'un devant une modale quand il ouvre un match en direct.
//
// Pas sur les pages de connexion et d'inscription : elles ont leur propre
// parcours, et on n'y est pas encore « dans » le produit.
// ============================================

const T = textes(
  {
    titre: "Une précision",
    // Sans nommer le rôle : « Tu es joueur » à quelqu'un dont on demande
    // justement s'il est une femme se contredirait dès la première ligne.
    texte:
      "Pour ton rôle sur KoppaFoot : es-tu un homme ou une femme ? Ton titre, ton poste et les messages que tu reçois s'accordent, et les équipes féminines te trouvent au mercato.",
    prive: "Modifiable à tout moment dans ton profil.",
    plusTard: "Plus tard",
    enregistrer: "Enregistrer",
    merci: "C'est noté, merci.",
    erreur: "Impossible d'enregistrer. Réessaie.",
  },
  {
    titre: "One quick thing",
    texte:
      "For your role on KoppaFoot: are you a man or a woman? Women's teams can then find you in the transfer market.",
    prive: "You can change it any time in your profile.",
    plusTard: "Later",
    enregistrer: "Save",
    merci: "Saved, thanks.",
    erreur: "Couldn't save. Try again.",
  },
);

const CLE = "koppafoot:genre-plus-tard";
const PAGES_EXCLUES = ["/login", "/signup", "/forgot-password", "/verify-email", "/get-started"];

// La session : lue par useSyncExternalStore, sans effet, et donc sans écart
// entre le rendu serveur (rien à montrer) et le premier rendu du navigateur.
const abonnes = new Set<() => void>();
function abonner(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}
function repousse(): boolean {
  try {
    return sessionStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}
function repousser() {
  try {
    sessionStorage.setItem(CLE, "1");
  } catch {
    // Stockage fermé : la modale se ferme quand même pour cette page.
  }
  abonnes.forEach((f) => f());
}

export default function RappelDuGenre() {
  const { user, updateProfile } = useAuth();
  const pathname = usePathname();
  const t = useTextes(T);
  const plusTard = useSyncExternalStore(abonner, repousse, () => true);
  const [genre, setGenre] = useState<Genre | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [ferme, setFerme] = useState(false);

  if (ferme || plusTard || !genreRequis(user)) return null;
  if (PAGES_EXCLUES.some((p) => pathname?.startsWith(p))) return null;

  const enregistrer = async () => {
    if (!genre) return;
    setEnvoi(true);
    try {
      await updateProfile({ gender: genre });
      toast.success(t.merci);
      setFerme(true);
    } catch (err) {
      console.error("Enregistrement du genre :", err);
      toast.error(t.erreur);
      setEnvoi(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rappel-genre-titre"
    >
      <div className="w-full max-w-md border border-gray-200/70 bg-white p-6 sm:p-7">
        <h2 id="rappel-genre-titre" className="font-display text-xl font-black uppercase tracking-tight text-gray-900">
          {t.titre}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{t.texte}</p>
        <div className="mt-5">
          <ChoixDuGenre valeur={genre} onChange={setGenre} />
        </div>
        <p className="mt-2 text-[11px] font-semibold text-gray-400">{t.prive}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={repousser}
            className="px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-gray-500 transition-colors hover:text-gray-900"
          >
            {t.plusTard}
          </button>
          <button
            type="button"
            onClick={enregistrer}
            disabled={!genre || envoi}
            className="inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700 disabled:opacity-40"
          >
            {envoi && <Loader2 size={13} className="animate-spin" />}
            {t.enregistrer}
          </button>
        </div>
      </div>
    </div>
  );
}
