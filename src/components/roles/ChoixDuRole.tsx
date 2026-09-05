"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, Briefcase, Check, Flag, Loader2, Rocket, User } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { roleDepuisURL } from "@/lib/onboarding";
import type { EvolutionRole, FirestoreUser } from "@/types";

// ============================================
// CHOISIR SON RÔLE, SUR LA VITRINE.
//
// Ce geste vivait derrière la porte, sur /evolution, dans le mobilier de
// l'application. Deux conséquences : la page qui EXPLIQUE les rôles ne
// recevait personne, puisqu'elle se contentait de renvoyer ailleurs ; et on
// décidait ce qu'on veut devenir sur un écran qui ne le racontait plus, la
// démonstration étant restée une page en arrière.
//
// Il se fait donc ici, sous les trois affiches qui viennent de dire ce que
// chaque rôle donne. On lit, on choisit, on active, et on repart sur le
// direct — c'est-à-dire dans le produit, pas sur un écran de félicitations.
//
// SANS COMPTE, on n'active rien : on envoie vers l'inscription en emportant
// le rôle choisi (`?role=`), que le formulaire d'inscription repose de
// l'autre côté. Un visiteur ne doit pas découvrir qu'il lui faut un compte
// APRÈS avoir rempli un formulaire.
// ============================================

const ROLES: {
  role: EvolutionRole;
  titre: string;
  Icone: typeof User;
  phrase: string;
  /** Le nom de l'espace, tel qu'on l'annonce en l'activant. */
  espace: string;
  /** Ce que le formulaire d'activation demande, dit en une ligne. */
  formulaire: string;
}[] = [
  {
    role: "player",
    titre: "Joueur",
    Icone: User,
    phrase: "Tu joues dans une équipe, ou tu veux en rejoindre une.",
    espace: "Espace joueur",
    formulaire: "Ton profil sportif",
  },
  {
    role: "manager",
    titre: "Manager",
    Icone: Briefcase,
    phrase: "Tu diriges une équipe et son effectif.",
    espace: "Espace manager",
    formulaire: "Ton profil de manager",
  },
  {
    role: "referee",
    titre: "Arbitre",
    Icone: Flag,
    phrase: "Tu tiens le sifflet.",
    espace: "Espace arbitre",
    formulaire: "Ta fiche d'arbitre",
  },
];

const POSTES = [
  { value: "goalkeeper", label: "Gardien" },
  { value: "defender", label: "Défenseur" },
  { value: "midfielder", label: "Milieu" },
  { value: "forward", label: "Attaquant" },
];

const PIEDS = [
  { value: "right", label: "Droit" },
  { value: "left", label: "Gauche" },
  { value: "both", label: "Les deux" },
];

// Les MÊMES valeurs qu'avant le déménagement, à la lettre : ce sont celles
// que le profil, la recherche et les fiches d'arbitre savent relire.
const LICENCES = [
  { value: "trainee", label: "Stagiaire" },
  { value: "regional", label: "Régional" },
  { value: "national", label: "National" },
  { value: "international", label: "International" },
];

const classeChamp =
  "w-full border border-gray-200/70 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-900";

function Pastilles({
  options,
  valeur,
  onChange,
}: {
  options: { value: string; label: string }[];
  valeur: string;
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
            valeur === o.value
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

export default function ChoixDuRole() {
  const { user, loading, updateProfile } = useAuth();
  const router = useRouter();

  const [envoi, setEnvoi] = useState(false);

  /**
   * LES CHAMPS SONT DÉRIVÉS, PAS RECOPIÉS.
   *
   * `null` veut dire « personne n'y a touché » : la valeur affichée est alors
   * celle du profil. Recopier le profil dans l'état aurait demandé un effet,
   * et un effet qui appelle `setState` déclenche une cascade de rendus — la
   * règle `react-hooks/set-state-in-effect` le refuse, à raison : le profil
   * arrive après le premier rendu, et il aurait fallu se garder d'écraser ce
   * que quelqu'un est en train de taper.
   */
  const [poste, setPoste] = useState<string | null>(null);
  const [pied, setPied] = useState<string | null>(null);
  const [equipe, setEquipe] = useState<string | null>(null);
  const [niveauLicence, setNiveauLicence] = useState<string | null>(null);
  const [numeroLicence, setNumeroLicence] = useState<string | null>(null);
  const [ville, setVille] = useState<string | null>(null);

  const vPoste = poste ?? user?.position ?? "";
  const vPied = pied ?? user?.strongFoot ?? "";
  const vEquipe = equipe ?? user?.teamName ?? "";
  const vNiveauLicence = niveauLicence ?? user?.licenseLevel ?? "";
  const vNumeroLicence = numeroLicence ?? user?.licenseNumber ?? "";
  const vVille = ville ?? user?.locationCity ?? "";

  /**
   * Le rôle repris de l'adresse, quand on arrive en `?role=`.
   *
   * Le cas vient de l'inscription : elle emmène ici en emportant le rôle
   * choisi, et par Google elle crée le compte sans passer par notre
   * formulaire, où le rôle aurait pu être posé. On ouvre directement son
   * activation plutôt que de reposer la question à quelqu'un qui vient d'y
   * répondre.
   *
   * Lu UNE FOIS, à l'initialisation, et jamais dans un effet : c'est une
   * valeur d'entrée, pas une synchronisation. Côté serveur la fonction rend
   * `null`, et le premier rendu client n'a pas encore de profil — il montre
   * donc les mêmes cartes que le serveur, sans écart d'hydratation.
   */
  const [roleDeLURL] = useState<EvolutionRole | null>(() => roleDepuisURL());

  /**
   * `null` = on n'a encore rien cliqué, donc l'adresse décide ; « aucun » =
   * on est revenu à la liste, et l'adresse ne doit plus rouvrir le formulaire
   * qu'on vient de fermer.
   */
  const [choix, setChoix] = useState<EvolutionRole | "aucun" | null>(null);

  const actif = user?.evolutionRole ?? null;
  // L'adresse ne vaut que sur un compte qui n'a pas encore de rôle : revenir
  // ici plus tard avec la même en favori ne doit pas rouvrir un formulaire
  // qu'on n'a pas demandé.
  const choisi =
    choix === "aucun" ? null : choix ?? (user && !actif ? roleDeLURL : null);
  const meta = choisi ? ROLES.find((r) => r.role === choisi) ?? null : null;

  const activer = async (role: EvolutionRole) => {
    setEnvoi(true);
    try {
      const patch: Partial<FirestoreUser> = {
        evolution_role: role,
        location_city: vVille.trim() || user?.locationCity || "",
      };
      // LE TYPE SUIT TOUJOURS LE RÔLE ACTIVÉ, sans exception. Les casquettes
      // vivent dans des drapeaux à côté, donc activer un rôle ne peut plus
      // rien détruire.
      patch.user_type = role;
      if (role === "player") {
        if (vPoste) patch.position = vPoste;
        if (vPied) patch.strong_foot = vPied as FirestoreUser["strong_foot"];
      } else if (role === "referee") {
        if (vNiveauLicence) patch.license_level = vNiveauLicence;
        if (vNumeroLicence.trim()) patch.license_number = vNumeroLicence.trim();
      } else if (vEquipe.trim()) {
        patch.team_name = vEquipe.trim();
      }
      await updateProfile(patch);

      toast.success(`${ROLES.find((r) => r.role === role)?.espace} activé !`);
      // ON REPART SUR LE DIRECT, pas sur un écran de félicitations. Le direct
      // EST la racine du produit — « / », l'entrée `HOME` de la barre de
      // navigation — et c'est là que la liste « pour bien démarrer » attend
      // celui qui vient de choisir. Écrit en clair plutôt qu'importé de
      // ScoreHeader : ce composant vit sur la vitrine, et faire entrer toute
      // la barre de l'application dans son paquet pour une constante d'un
      // caractère serait cher payé.
      router.push("/");
    } catch (err) {
      console.error("Activation du rôle :", err);
      toast.error("Une erreur est survenue");
      setEnvoi(false);
    }
  };

  // ── Le temps de savoir qui regarde ────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center border border-gray-200/70 bg-white">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    );
  }

  // ── Sans compte : on ne demande rien, on emmène à l'inscription ────
  if (!user) {
    return (
      <div className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-3">
        {ROLES.map(({ role, titre, Icone, phrase }) => (
          <Link
            key={role}
            href={`/signup?role=${role}`}
            className="group flex flex-col bg-white p-7 transition-colors hover:bg-gray-50"
          >
            <Icone size={24} className="text-emerald-600" />
            <p className="mt-5 font-display text-2xl font-black uppercase tracking-tight text-gray-900">
              {titre}
            </p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">{phrase}</p>
            <span className="mt-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-emerald-700">
              Devenir {titre.toLowerCase()}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    );
  }

  // ── Le formulaire du rôle choisi ──────────────────────────────────
  if (choisi && meta) {
    return (
      <div className="max-w-lg">
        <button
          type="button"
          onClick={() => setChoix("aucun")}
          className="mb-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 transition-colors hover:text-gray-900"
        >
          <ArrowLeft size={14} />
          Changer de rôle
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={choisi}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="border border-gray-200/70 bg-white p-6 sm:p-8"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-emerald-50 text-emerald-600">
                <meta.Icone size={20} />
              </div>
              <div>
                <h3 className="font-display text-xl font-black uppercase tracking-tight text-gray-900">
                  {meta.formulaire}
                </h3>
                <p className="text-xs font-semibold text-gray-400">
                  Tout est modifiable plus tard dans ton profil.
                </p>
              </div>
            </div>

            <form
              className="mt-6 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                activer(choisi);
              }}
            >
              {choisi === "player" ? (
                <>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                      Ton poste
                    </label>
                    <Pastilles options={POSTES} valeur={vPoste} onChange={setPoste} />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                      Pied fort
                    </label>
                    <Pastilles options={PIEDS} valeur={vPied} onChange={setPied} />
                  </div>
                </>
              ) : choisi === "referee" ? (
                <>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                      Ton niveau de licence
                    </label>
                    <Pastilles options={LICENCES} valeur={vNiveauLicence} onChange={setNiveauLicence} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                      Numéro de licence{" "}
                      <span className="font-bold normal-case tracking-normal text-gray-300">(optionnel)</span>
                    </label>
                    <input
                      type="text"
                      value={vNumeroLicence}
                      onChange={(e) => setNumeroLicence(e.target.value)}
                      placeholder="ex : TG-2024-0182"
                      className={classeChamp}
                    />
                    <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                      Personne ne vérifie ce numéro aujourd&apos;hui : il sert aux
                      organisateurs qui te contactent, pas à te valider.
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                    Nom de ton équipe{" "}
                    <span className="font-bold normal-case tracking-normal text-gray-300">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={vEquipe}
                    onChange={(e) => setEquipe(e.target.value)}
                    placeholder="ex : FC Étoile"
                    className={classeChamp}
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                    Pas d&apos;équipe ? Un organisateur pourra t&apos;inviter à gérer une
                    équipe de sa compétition.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                  Ta ville
                </label>
                <input
                  type="text"
                  value={vVille}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="Ta ville"
                  className={classeChamp}
                />
              </div>

              <button
                type="submit"
                disabled={envoi}
                className="flex w-full items-center justify-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700 disabled:opacity-60"
              >
                {envoi ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
                Activer mon {meta.espace.toLowerCase()}
              </button>
            </form>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // ── Le choix, pour un compte connecté ─────────────────────────────
  return (
    <div className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-3">
      {ROLES.map(({ role, titre, Icone, phrase }) => (
        <button
          key={role}
          type="button"
          onClick={() => setChoix(role)}
          className="group flex flex-col bg-white p-7 text-left transition-colors hover:bg-gray-50"
        >
          <div className="flex items-start justify-between gap-3">
            <Icone size={24} className="text-emerald-600" />
            {actif === role && (
              <span className="border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                Actif
              </span>
            )}
          </div>
          <p className="mt-5 font-display text-2xl font-black uppercase tracking-tight text-gray-900">
            {titre}
          </p>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">{phrase}</p>
          <span className="mt-6 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-emerald-700">
            {actif === role ? (
              <>
                <Check size={14} />
                Mettre à jour
              </>
            ) : (
              <>
                {actif ? "Basculer" : "Choisir"}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
