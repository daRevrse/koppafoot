"use client";

import { useMemo, useState } from "react";
import { GitMerge, Loader2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { mergeGhostPlayer } from "@/lib/firestore";
import { useConfirmation } from "@/components/ui/socle";
import type { GhostPlayer, UserProfile } from "@/types";

// ============================================
// LE COIN FUSION : UNE COMMANDE, PAS UNE LISTE.
//
// Un club amateur inscrit ses joueurs sans smartphone comme joueurs sans
// compte : ils figurent sur les feuilles de match et accumulent une carrière.
// Le jour où l'un d'eux crée un compte et rejoint l'équipe, il repart de zéro
// pendant que son double continue d'exister à côté de lui — deux lignes pour
// un seul homme, dont une qui porte tout son passé.
//
// CE QUI CHANGE ICI. Ce bloc posait UNE CARTE PAR JOUEUR SANS COMPTE : un
// nom, un menu, un bouton, puis le même formulaire en dessous, et encore le
// même. Quatre joueurs sans compte faisaient quatre fois le même geste à
// l'écran, et un effectif de village en aligne bien plus — le bloc grandissait
// avec une liste qu'on ne vient jamais parcourir.
//
// Car on ne fusionne pas quatre joueurs : on en fusionne UN, le jour où il
// crée son compte. C'est un geste rare et ciblé, et un geste rare et ciblé se
// dit comme un virement — d'où, vers où, on valide. Le joueur sans compte se
// choisit donc dans un menu au lieu d'avoir sa propre carte, et le bloc garde
// la même taille que l'équipe compte deux joueurs sans compte ou trente.
//
// CE QUE LES CARTES DISAIENT ET QU'ON NE PERD PAS : la carrière en jeu. Elle
// s'affichait sur chacune ; elle s'affiche maintenant une fois, sous les deux
// menus, pour le joueur choisi — au moment où elle sert vraiment, c'est-à-dire
// juste avant de valider.
//
// Ce bloc n'apparaît que s'il y a matière à fusionner : des joueurs sans
// compte ET des comptes dans l'effectif. Sans les deux, il ne dit rien et ne
// s'affiche pas.
// ============================================

interface Props {
  teamId: string;
  ghostPlayers: GhostPlayer[];
  members: UserProfile[];
  /** Rechargement de l'effectif après une fusion réussie. */
  onMerged: () => void;
}

const nomDe = (p: { firstName: string; lastName: string }) =>
  `${p.firstName} ${p.lastName}`.trim();

/** « 12 matchs, 4 buts et 2 passes ». */
function carriere(g: GhostPlayer): string {
  const s = (n: number) => (n > 1 ? "s" : "");
  return (
    `${g.matchesPlayed} match${s(g.matchesPlayed)}, ` +
    `${g.goals} but${s(g.goals)} et ${g.assists} passe${s(g.assists)}`
  );
}

const CHAMP =
  "w-full min-w-0 border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-semibold " +
  "text-gray-900 outline-none transition-colors focus:border-violet-500";

const LABEL = "mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400";

export default function GhostMergeCorner({ teamId, ghostPlayers, members, onMerged }: Props) {
  const [ghostId, setGhostId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [enCours, setEnCours] = useState(false);
  const { demander, Dialogue } = useConfirmation();

  // DEUX MENUS, DONC DEUX LISTES TRIÉES. Une carte, on la parcourt du regard ;
  // un menu, on y cherche un nom précis. L'ordre de Firestore n'en est pas un.
  const fantomes = useMemo(
    () => [...ghostPlayers].sort((a, b) => nomDe(a).localeCompare(nomDe(b), "fr")),
    [ghostPlayers],
  );
  const comptes = useMemo(
    () => [...members].sort((a, b) => nomDe(a).localeCompare(nomDe(b), "fr")),
    [members],
  );

  if (ghostPlayers.length === 0 || members.length === 0) return null;

  const fantome = fantomes.find((g) => g.id === ghostId) ?? null;
  const compte = comptes.find((m) => m.uid === playerId) ?? null;
  const nomCompte = compte ? nomDe(compte) || compte.email || "ce compte" : "";

  const fusionner = async () => {
    if (!fantome || !compte) return;

    const ok = await demander({
      titre: `Fusionner ${nomDe(fantome)} ?`,
      corps: (
        <>
          Sa carrière — {carriere(fantome)} — passe sur le compte de{" "}
          <strong className="font-bold text-gray-900">{nomCompte}</strong>, les feuilles de
          match déjà jouées porteront son vrai nom, et la fiche sans compte disparaîtra.
          C&apos;est définitif.
        </>
      ),
      action: "Fusionner",
      danger: true,
    });
    if (!ok) return;

    setEnCours(true);
    try {
      const r = await mergeGhostPlayer({ teamId, ghostId: fantome.id, playerId: compte.uid });
      toast.success(`${r.nom} récupère ${r.matchs} match(s) et ${r.buts} but(s)`);
      setGhostId("");
      setPlayerId("");
      onMerged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La fusion a échoué");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="border border-gray-200/70 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3 border-b border-gray-200/70 pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-violet-50 text-violet-600">
          <GitMerge size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Fusionner un joueur</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
            Un de tes joueurs sans compte vient d&apos;en créer un ? Rattache-le à son compte :
            ses matchs, buts et passes le suivent, et les feuilles de match passées prennent
            son vrai nom.
          </p>
        </div>
      </div>

      {/* LES DEUX BOUTS DU GESTE. `items-end` pour que la flèche tombe entre
          les deux menus et non sous leurs étiquettes ; elle disparaît en
          colonne, où l'un est simplement au-dessus de l'autre et où ce sont
          les étiquettes qui disent le sens. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-2">
        <div className="min-w-0 sm:flex-1">
          <label htmlFor="fusion-fantome" className={LABEL}>
            Le joueur sans compte
          </label>
          <select
            id="fusion-fantome"
            value={ghostId}
            onChange={(e) => setGhostId(e.target.value)}
            className={CHAMP}
          >
            <option value="">Choisir le joueur…</option>
            {fantomes.map((g) => (
              <option key={g.id} value={g.id}>
                {g.squadNumber?.trim() ? `N°${g.squadNumber.trim()} · ${nomDe(g)}` : nomDe(g)}
              </option>
            ))}
          </select>
        </div>

        <ArrowRight size={16} className="hidden shrink-0 text-gray-300 sm:mb-3 sm:block" />

        <div className="min-w-0 sm:flex-1">
          <label htmlFor="fusion-compte" className={LABEL}>
            Son compte
          </label>
          <select
            id="fusion-compte"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className={CHAMP}
          >
            <option value="">Choisir le compte…</option>
            {comptes.map((m) => (
              <option key={m.uid} value={m.uid}>
                {nomDe(m) || m.email || "Compte sans nom"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CE QUI EST EN JEU, UNE FOIS. C'est ce que les cartes affichaient
          chacune de leur côté : la carrière qui va changer de fiche. Ici elle
          arrive quand un joueur est choisi, c'est-à-dire au moment de vérifier
          qu'on a bien désigné le bon. */}
      {fantome && (
        <p className="mt-3 border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-violet-700">
          <strong className="font-black">{nomDe(fantome)}</strong> apporte {carriere(fantome)}
          {compte ? (
            <>
              {" "}
              à <strong className="font-black">{nomCompte}</strong>.
            </>
          ) : (
            "."
          )}
        </p>
      )}

      <button
        onClick={fusionner}
        disabled={!fantome || !compte || enCours}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 bg-violet-600 px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-white transition-colors hover:bg-violet-700 disabled:opacity-40 sm:w-auto"
      >
        {enCours ? <Loader2 size={13} className="animate-spin" /> : <GitMerge size={13} />}
        Fusionner
      </button>

      <Dialogue />
    </div>
  );
}
