"use client";

import { motion } from "motion/react";
import { X } from "lucide-react";
import { disposerSurTerrain, rayonPastille, CADRE, INTERLIGNE, type SensDAttaque } from "@/lib/terrain";
import { versFormation } from "@/lib/formations";
import {
  COULEURS_PAR_DEFAUT, maillotsTropProches, type CouleursEquipe,
} from "@/lib/couleurs-equipe";
import { LIBELLE_POSTE, normaliserPoste } from "@/lib/postes";
import { formaterNote, tonNote, type NoteJoueur } from "@/lib/notes";
import type { LineupEntry } from "@/types";

// ============================================
// Le terrain de la console : on touche un joueur, on dit ce qu'il vient de
// faire.
//
// LA CONSOLE PARTAIT DE L'ACTION, elle part maintenant du JOUEUR. Elle
// affichait deux cartes d'équipe côte à côte, chacune avec ses quatre boutons
// — BUT, jaune, rouge, remplacement — et chaque bouton ouvrait une liste où
// retrouver le joueur. Deux gestes, et une liste de quinze noms à lire pendant
// que le match continue.
//
// Le sens est inversé : on touche le joueur, on choisit l'action. C'est
// l'ordre dans lequel la chose s'est produite sur le terrain, et l'ordre dans
// lequel un scoreur la raconte — « le 9 a marqué », jamais « il y a eu un but,
// et c'était le 9 ». Ça permet surtout de donner à CHAQUE joueur les actions
// qui le concernent : l'arrêt n'a de sens que pour un gardien, et il n'avait
// aucune place dans une carte d'équipe.
//
// UN SEUL CAMP À LA FOIS, en onglets. Deux terrains côte à côte, ou l'un
// sous l'autre, sortent de l'écran d'un téléphone — et une console qu'on doit
// faire défiler pendant qu'une action se joue est une console qui rate
// l'action. Le terrain garde la même place quel que soit le camp regardé,
// donc rien ne saute sous le doigt.
// ============================================

type Cote = "home" | "away";

export interface CoteTerrain {
  name: string;
  /** Les onze (ou moins) qui sont sur la pelouse en ce moment. */
  surLeTerrain: LineupEntry[];
  banc: LineupEntry[];
  /** Absent tant que l'équipe n'a rien déclaré : voir COULEURS_PAR_DEFAUT. */
  couleurs?: CouleursEquipe;
  /**
   * « 4-3-3 », la forme annoncée sur la feuille de match.
   *
   * UN JOUEUR EXPULSÉ LAISSE SA PLACE VIDE, et c'est ce qu'on veut : la
   * formation compte onze places, le terrain n'en garnit que dix, et le trou
   * se voit. C'est même la seule façon de lire d'un coup d'œil qu'une équipe
   * joue en infériorité.
   */
  formation?: string | null;
}

/**
 * « Jean-Baptiste Mensah » → « J. Mensah ». Un nom entier ne tient pas sous
 * une pastille, et un texte SVG ne se tronque pas tout seul : il déborde sur
 * son voisin.
 */
function nomCourt(nom: string, max = 11): string {
  const bouts = nom.trim().split(/\s+/).filter(Boolean);
  if (bouts.length === 0) return "";
  const court = bouts.length === 1
    ? bouts[0]
    : `${bouts[0][0]}. ${bouts[bouts.length - 1]}`;
  return court.length > max ? `${court.slice(0, max - 1)}…` : court;
}

/**
 * Le tracé du terrain, pour un sens de jeu.
 *
 * TROIS CÔTÉS, JAMAIS QUATRE. Le quatrième bord est celui par où le terrain
 * continue — le milieu de terrain debout, la ligne médiane couchée — et y
 * tracer un trait le ferait lire comme une ligne de but. Ne rien tracer est
 * la seule façon honnête de dire que ça ne s'arrête pas là.
 */
function Lignes({ sens }: { sens: SensDAttaque }) {
  const traits = { stroke: "#ffffff", strokeOpacity: 0.35, fill: "none" };

  if (sens === "haut") {
    return (
      <g {...traits} strokeWidth="0.5">
        <path d="M3 15 V101 H97 V15" />
        <line x1="3" y1="52" x2="97" y2="52" />
        <circle cx="50" cy="52" r="11" />
        <rect x="26" y="85" width="48" height="16" />
        <rect x="38" y="95" width="24" height="6" />
      </g>
    );
  }

  // Couché, le but est au bord EXTÉRIEUR et le jeu va vers le milieu de
  // l'écran. `gauche` est le miroir exact de `droite`, obtenu par un
  // retournement du repère plutôt que par un second tracé à tenir à jour.
  return (
    <g
      {...traits}
      strokeWidth="0.9"
      transform={sens === "gauche" ? "translate(200,0) scale(-1,1)" : undefined}
    >
      <path d="M200 2 H4 V114 H200" />
      <rect x="4" y="30" width="36" height="56" />
      <rect x="4" y="45" width="14" height="26" />
      {/* La médiane, et le rond central posé dessus : le terrain de l'autre
          camp commence ici, et c'est l'autre moitié de l'écran. */}
      <line x1="112" y1="2" x2="112" y2="114" />
      <circle cx="112" cy="58" r="13" />
    </g>
  );
}

function Pelouse({
  titulaires, jaunes, onJoueur, sens, couleurs, formation, contour,
}: {
  titulaires: LineupEntry[];
  jaunes: Set<string>;
  onJoueur: (entry: LineupEntry) => void;
  sens: SensDAttaque;
  couleurs: CouleursEquipe;
  formation: string | null;
  /**
   * Un liseré, quand les deux équipes jouent dans le même ton.
   *
   * ON NE RECOLORE PAS UNE ÉQUIPE POUR ARRANGER L'AFFICHAGE : le produit ne
   * connaît qu'un maillot par club, il n'a pas de tenue extérieure, et peindre
   * l'un des deux camps d'une couleur qu'il ne porte pas serait mentir sur ce
   * qui est sur le terrain. On ajoute donc un trait, qui ne prétend rien de la
   * tenue et sépare quand même les deux moitiés d'écran.
   */
  contour?: string;
}) {
  const { places, ecart, rayonMax } = disposerSurTerrain(
    titulaires, titulaires.length, sens, versFormation(formation),
  );
  // Aussi gros que les rangs le permettent : ici on ne lit pas, on VISE. Le
  // plafond ne vient pas du goût mais de la géométrie — au-delà, la pastille
  // recouvre le nom du rang précédent. La vraie cible du doigt est le cercle
  // transparent posé par-dessus, plus large que la pastille.
  const r = rayonPastille(ecart, rayonMax);
  const c = CADRE[sens];
  // Ce qui doit garder sa taille à l'écran quel que soit le cadre. Voir
  // `Cadre.echelle`.
  const corpsDuNom = 3.2 * c.echelle;
  const carton = { l: 2.6 * c.echelle, h: 3.6 * c.echelle };

  return (
    <svg
      viewBox={`${c.x} ${c.y} ${c.l} ${c.h}`}
      role="group"
      aria-label="Terrain, touche un joueur"
      className="h-full w-full select-none"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={c.x} y={c.y} width={c.l} height={c.h} fill="#15803d" />
      <Lignes sens={sens} />

      {places.map((place, i) => {
        const joueur = place.entry;
        if (!joueur) {
          // Un emplacement vide n'existe que dans le repli, quand la feuille
          // compte moins de titulaires qu'annoncé. Il garde sa lettre, pour
          // dire qu'il manque un joueur et non que le terrain est cassé.
          return (
            <g key={`vide-${i}`}>
              <circle
                cx={place.x} cy={place.y} r={r}
                fill="none" stroke="#ffffff" strokeOpacity="0.4"
                strokeWidth={0.6 * c.echelle} strokeDasharray={`${1.8 * c.echelle} ${1.4 * c.echelle}`}
              />
              <text
                x={place.x} y={place.y + r * 0.36} textAnchor="middle"
                className="font-black" style={{ fontSize: `${(r * 0.85).toFixed(2)}px` }}
                fill="#ffffff" fillOpacity="0.5"
              >
                {place.etiquette}
              </text>
            </g>
          );
        }

        const gardien = place.etiquette === "G";
        const fond = gardien ? couleurs.gardien : couleurs.maillot;
        const encre = gardien ? couleurs.texteGardien : couleurs.texte;

        return (
          <g
            key={joueur.playerId}
            onClick={() => onJoueur(joueur)}
            role="button"
            tabIndex={0}
            aria-label={`${joueur.name}, actions`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onJoueur(joueur);
              }
            }}
            className="cursor-pointer outline-none"
          >
            {/* La cible du doigt, un peu plus large que la pastille et
                invisible. La marge suit le cadre : deux unités debout, quatre
                couché, c'est la même distance sous le doigt. Au-delà, deux
                cibles voisines se recouvriraient. */}
            <circle cx={place.x} cy={place.y} r={r + 2 * c.echelle} fill="transparent" />
            {/* LE TRAIT SVG EST CENTRÉ SUR LE CERCLE : il déborde donc de la
                moitié de son épaisseur VERS L'EXTÉRIEUR. Un liseré épais
                mordait sur le nom du joueur du rang précédent, dont la ligne
                de base est calée au bord exact de la pastille (voir
                lib/terrain). On rétrécit le cercle d'autant : le bord
                extérieur du trait retombe précisément sur `r`, et la géométrie
                reste celle que la disposition a calculée. */}
            <circle
              cx={place.x} cy={place.y} r={r - (contour ? 0.7 * c.echelle : 0)}
              fill={fond}
              stroke={contour ?? "#052e16"}
              strokeWidth={(contour ? 1.4 : 0.5) * c.echelle}
            />
            <text
              x={place.x} y={place.y + r * 0.36} textAnchor="middle"
              className="font-black pointer-events-none"
              style={{ fontSize: `${(r * 0.85).toFixed(2)}px` }}
              fill={encre}
            >
              {joueur.number || place.etiquette}
            </text>
            {/* Le jaune déjà pris : le suivant expulse, et le scoreur doit le
                voir avant de toucher, pas après. */}
            {jaunes.has(joueur.playerId) && (
              <rect
                x={place.x + r * 0.6} y={place.y - r * 1.07}
                width={carton.l} height={carton.h}
                fill="#facc15" stroke="#a16207" strokeWidth={0.3 * c.echelle}
                className="pointer-events-none"
              />
            )}
            <text
              x={Math.min(Math.max(place.x, c.nomMin), c.nomMax)}
              y={place.y + r + INTERLIGNE}
              textAnchor="middle"
              className="font-bold pointer-events-none"
              style={{ fontSize: `${corpsDuNom}px` }}
              fill="#ffffff"
            >
              {nomCourt(joueur.name)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * LES DEUX CAMPS, FACE A FACE.
 *
 * LES ONGLETS ONT DISPARU, et ce n'est pas une simplification cosmetique :
 * c'est le probleme qu'ils reglaient qui n'existe plus. Ils existaient parce
 * que deux terrains ne tenaient pas l'un sous l'autre sur un telephone debout
 * — on n'en montrait qu'un, et il fallait donc dire lequel. Couche, l'ecran
 * est deux fois plus large que haut, c'est-a-dire la forme d'un terrain : les
 * deux camps y tiennent cote a cote.
 *
 * CE QUE CA SUPPRIME, dans l'ordre d'importance :
 *
 *   — LE MODE. Toucher le 9 de gauche saisit pour l'equipe de gauche. La
 *     question « sur quel camp suis-je ? » ne se pose plus, et la faute de
 *     saisie qu'elle produisait disparait avec elle. C'etait la faute la plus
 *     couteuse de la console : elle credite un but au mauvais club.
 *
 *   — LE GESTE EN TROP. Poser un corner pour l'equipe qu'on ne regardait pas
 *     demandait deux appuis, dont un qui ne dit rien du match. Les quatre
 *     boutons d'equipe sont maintenant dupliques, un jeu par camp, lus dans
 *     le sens de leur equipe.
 *
 *   — LE DEFILEMENT. Tout tient dans un ecran, sans exception : pendant qu'on
 *     fait defiler, on rate l'action suivante.
 *
 * LE BALLON GARDE SON GESTE PROPRE, et c'est delibere. On pourrait croire que
 * toucher un camp devrait lui donner le ballon — c'etait la demande. Mais on
 * regarde la defense PRECISEMENT quand on n'a pas le ballon, pour noter
 * l'arret de son gardien : lier les deux obligerait a rendre le ballon a
 * l'adversaire pour noter le sien. La pastille reste donc a part — mais elle
 * ne coute plus qu'un appui, puisqu'il n'y a plus de camp a rejoindre avant.
 */
export default function TerrainsFaceAFace({
  home, away, jaunes, ballon, parts, ballonActif, onBallon, onJoueur, actions,
}: {
  home: CoteTerrain;
  away: CoteTerrain;
  /** Les joueurs qui ont déjà un carton jaune. */
  jaunes: Set<string>;
  /** Le camp qui tient le ballon, `null` quand personne. */
  ballon: Cote | null;
  /** Les parts de possession à l'instant, `null` tant que rien n'est mesuré. */
  parts: { home: number; away: number } | null;
  /** Faux quand le chrono ne tourne pas : rien ne s'accumule, la pastille le dit. */
  ballonActif: boolean;
  onBallon: (c: Cote | null) => void;
  onJoueur: (cote: Cote, entry: LineupEntry) => void;
  /** Corner, coup franc, touche, penalty — rendus une fois PAR CAMP. */
  actions: (cote: Cote) => React.ReactNode;
}) {
  const tenueHome = home.couleurs ?? COULEURS_PAR_DEFAUT;
  const tenueAway = away.couleurs ?? COULEURS_PAR_DEFAUT;
  /**
   * DEUX ÉQUIPES DANS LE MÊME TON, et c'est le cas qui vide la couleur de son
   * intérêt. On marque le camp EXTÉRIEUR d'un liseré clair — un seul des deux,
   * sans quoi le liseré ne distingue rien non plus — et l'usage du football
   * veut que ce soit le visiteur qui s'adapte.
   */
  const memeTon = maillotsTropProches(tenueHome, tenueAway);

  return (
    <div
      // `w-full` : ce bloc est un ELEMENT d'une rangee flex, et un element de
      // rangee se dimensionne sur son CONTENU. Sans lui, les deux camps
      // s'arretaient aux deux tiers de l'ecran, le dernier tiers restant noir.
      className="flex h-full min-h-0 w-full"
    >
      {(["home", "away"] as const).map((k) => {
        const e = k === "home" ? home : away;
        const miroir = k === "away";
        const aLeBallon = ballon === k;
        const part = parts ? (k === "home" ? parts.home : parts.away) : null;

        return (
          <section
            key={k}
            aria-label={e.name}
            className={`flex min-h-0 min-w-0 flex-1 flex-col ${
              miroir ? "" : "border-r border-white/10"
            }`}
          >
            {/* Le bandeau du camp : son ballon au bord EXTERIEUR, son nom vers
                le milieu. Les deux camps sont donc en miroir l'un de l'autre,
                et chaque pouce trouve sa pastille sur son propre bord. */}
            <div className={`flex items-stretch bg-white/[0.06] ${miroir ? "flex-row-reverse" : ""}`}>
              <button
                type="button"
                aria-pressed={aLeBallon}
                aria-label={`Donner le ballon à ${e.name}`}
                // JAMAIS DESACTIVEE, meme chrono arrete : `basculer` sait
                // retenir le camp sans rien lui compter, et le decompte
                // reprend au coup de sifflet. Desactivee, elle ne faisait
                // rien sans dire pourquoi.
                onClick={() => onBallon(aLeBallon ? null : k)}
                className={`flex shrink-0 items-center gap-1 px-2.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                  aLeBallon ? "bg-emerald-600 text-white" : "text-white/40 hover:text-white/80"
                }`}
              >
                <span aria-hidden className="text-xs leading-none">⚽</span>
                {/* Elle se NOMME tant qu'elle n'a pas de chiffre : un tiret
                    apres un appui se lit comme un bouton casse. */}
                <span className="tabular-nums">
                  {part !== null ? `${part}%` : aLeBallon ? "balle" : "ballon"}
                </span>
                {!ballonActif && aLeBallon && <span className="opacity-60">⏸</span>}
              </button>

              {/* SUR UN SEUL RANG. « Domicile » vivait au-dessus du nom, et
                  coutait vingt pixels de terrain pour un mot qu'on lit une
                  fois — alors que la hauteur est ici la ressource rare. */}
              <div
                className={`flex min-w-0 flex-1 items-baseline gap-1.5 px-2 py-1 ${
                  miroir ? "flex-row-reverse" : ""
                }`}
              >
                <span className="shrink-0 text-[8px] font-black uppercase tracking-[0.18em] text-white/35">
                  {k === "home" ? "Dom." : "Ext."}
                </span>
                <span className="min-w-0 truncate text-[11px] font-black uppercase tracking-wide text-white">
                  {e.name}
                </span>
              </div>
            </div>

            {/* LE MEME ORDRE DES DEUX COTES, et c'est un choix contre la
                symetrie. Le bandeau du camp et son banc sont en miroir, parce
                qu'ils appartiennent a leur bord — mais les quatre actions
                sont des GESTES qu'on apprend par leur place. Les inverser
                d'un camp a l'autre ferait que « le premier bouton » designe
                le corner a gauche et le penalty a droite, et un scoreur qui
                va vite se tromperait exactement la ou l'erreur coute cher. */}
            {actions(k)}

            {e.surLeTerrain.length === 0 ? (
              <p className="flex flex-1 items-center justify-center bg-black/20 text-center text-[10px] font-black uppercase tracking-[0.15em] text-white/30">
                Personne sur le terrain
              </p>
            ) : (
              // `min-h-0` : sans lui, le SVG impose sa hauteur intrinseque et
              // la colonne deborde de l'ecran — dans une console qui tient
              // par principe en un seul ecran.
              <div className="min-h-0 flex-1">
                <Pelouse
                  titulaires={e.surLeTerrain}
                  jaunes={jaunes}
                  onJoueur={(entry) => onJoueur(k, entry)}
                  // Chacun defend son bord et attaque vers le milieu de
                  // l'ecran : c'est la disposition d'une affiche de match.
                  sens={k === "home" ? "droite" : "gauche"}
                  couleurs={k === "home" ? tenueHome : tenueAway}
                  formation={e.formation ?? null}
                  contour={memeTon && miroir ? "#f8fafc" : undefined}
                />
              </div>
            )}

            {/* Le banc, en pastilles touchables : un remplaçant prend un carton
                comme les autres, et c'est par lui qu'on le fait entrer. */}
            {e.banc.length > 0 && (
              <div
                className={`flex items-center gap-1 overflow-x-auto border-t border-white/10 px-2 py-1 ${
                  miroir ? "flex-row-reverse" : ""
                }`}
              >
                <span className="shrink-0 text-[8px] font-black uppercase tracking-[0.15em] text-white/30">
                  Banc
                </span>
                {e.banc.map((r) => (
                  <button
                    key={r.playerId}
                    type="button"
                    onClick={() => onJoueur(k, r)}
                    className="shrink-0 border border-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white/70 transition-colors hover:border-white/40 hover:text-white"
                  >
                    {r.number && <span className="font-black text-emerald-400">{r.number} </span>}
                    {nomCourt(r.name, 9)}
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export interface ActionJoueur {
  cle: string;
  libelle: string;
  emoji: string;
  /** Le ton du bouton. « rouge » sert aussi bien au carton qu'à une sortie. */
  ton?: "neutre" | "vert" | "jaune" | "rouge";
  /**
   * Verrouillée, avec la raison sous le libellé.
   *
   * Sert au jeu mort qui suit un but : voir `SECONDES_JEU_MORT` dans la
   * console. Le bouton reste VISIBLE et à sa place — le faire disparaître
   * déplacerait tous les autres sous le doigt au pire moment.
   */
  desactive?: string | null;
  onClick: () => void;
}

/**
 * Le fond d'une note.
 *
 * LA NOTE VIT ICI, ET NULLE PART AILLEURS. Elle s'affichait aussi en pastille
 * sur chaque joueur du terrain : onze chiffres de plus sur une image qui sert
 * à VISER, pas à lire, et qui recouvraient ce qu'on y cherche — le numéro.
 * Elle appartient au joueur, donc à l'écran qui ne parle que de lui.
 */
const FOND_NOTE_MODALE: Record<ReturnType<typeof tonNote>, string> = {
  absente: "bg-gray-200 text-gray-500",
  faible: "bg-red-500 text-white",
  moyenne: "bg-gray-500 text-white",
  bonne: "bg-emerald-600 text-white",
  excellente: "bg-emerald-500 text-white",
};

const TONS: Record<NonNullable<ActionJoueur["ton"]>, string> = {
  neutre: "border-gray-200/70 bg-gray-50/50 hover:border-gray-900 hover:bg-white",
  vert: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-600",
  jaune: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-500",
  rouge: "border-red-200 bg-red-50 text-red-700 hover:border-red-500",
};

/**
 * Ce qu'un joueur peut avoir fait.
 *
 * La liste vient de l'appelant, pas d'ici : elle dépend du poste (l'arrêt),
 * de l'endroit où le joueur se trouve (sur le terrain ou sur le banc) et de
 * ce que le match autorise encore (les remplacements sont comptés). La modale
 * ne fait que présenter, et elle tient sans défilement — c'est tout l'intérêt
 * de ne montrer que les actions qui s'appliquent.
 */
export function ModaleActionsJoueur({
  entry, teamName, minute, isSubmitting, actions, note, onClose,
}: {
  entry: LineupEntry;
  teamName: string;
  minute: number;
  isSubmitting: boolean;
  actions: ActionJoueur[];
  /** Sa note à cet instant. Absente quand rien ne la fonde encore. */
  note?: NoteJoueur;
  onClose: () => void;
}) {
  const poste = normaliserPoste(entry.position);

  return (
    <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-white p-5 shadow-2xl sm:p-7"
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-gray-900 text-base font-black text-white">
            {entry.number || entry.name[0]?.toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-black text-gray-900">{entry.name}</span>
            <span className="block truncate text-[11px] font-bold uppercase tracking-tight text-gray-400">
              {teamName}
              {poste && ` · ${LIBELLE_POSTE[poste]}`}
            </span>
          </span>
          {/* SA NOTE, EN GRAND, à droite de son nom. Le scoreur voit ce que
              ses gestes précédents ont produit au moment même où il en pose un
              nouveau — c'est le seul endroit où elle apparaît, et le seul
              moment où elle sert à quelque chose.

              LE NOMBRE DE FAITS EST DESSOUS, toujours. Une note calculée sur
              rien vaut 6,0 comme celle d'un joueur qui a tout fait bien : sans
              ce chiffre, les deux se ressemblent et la première ment. Reste
              muette tant qu'il n'a pas assez joué pour qu'on le note. */}
          {note && note.note !== null && (
            <span className="shrink-0 text-center">
              <span
                className={`flex h-11 w-14 items-center justify-center text-lg font-black tabular-nums ${FOND_NOTE_MODALE[tonNote(note.note)]}`}
                aria-label={`Note ${formaterNote(note.note)}, sur ${note.faits} fait${note.faits > 1 ? "s" : ""}`}
              >
                {formaterNote(note.note)}
              </span>
              <span className="mt-0.5 block text-[9px] font-black uppercase tracking-wide text-gray-400">
                {note.faits === 0 ? "rien noté" : `${note.faits} fait${note.faits > 1 ? "s" : ""}`}
              </span>
            </span>
          )}
        </div>

        <p className="mb-4 mt-3 text-xs font-bold uppercase tracking-tight text-gray-400 italic">
          {minute}&apos; · Qu&apos;est-ce qu&apos;il vient de faire ?
        </p>

        {/* `content-start` par precaution : une grille dont le conteneur a une
            hauteur definie etire ses rangees pour la remplir, et la console
            couchee contraint desormais la hauteur de ses modales. */}
        <div className="grid grid-cols-2 content-start gap-2">
          {actions.map((a) => (
            <button
              key={a.cle}
              type="button"
              disabled={isSubmitting || !!a.desactive}
              onClick={a.onClick}
              className={`flex items-center gap-2 border px-3 py-2.5 text-left text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${TONS[a.ton ?? "neutre"]}`}
            >
              <span aria-hidden className="text-base leading-none">{a.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{a.libelle}</span>
                {a.desactive && (
                  <span className="block truncate text-[9px] font-black uppercase tracking-wide opacity-60">
                    {a.desactive}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
