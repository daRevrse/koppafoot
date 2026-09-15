"use client";

import { motion } from "motion/react";
import { X } from "lucide-react";
import { disposerSurTerrain, rayonPastille, INTERLIGNE } from "@/lib/terrain";
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

function Pelouse({
  titulaires, jaunes, onJoueur,
}: {
  titulaires: LineupEntry[];
  jaunes: Set<string>;
  onJoueur: (entry: LineupEntry) => void;
}) {
  const { places, ecart, rayonMax } = disposerSurTerrain(titulaires);
  // Aussi gros que les rangs le permettent : ici on ne lit pas, on VISE. Le
  // plafond ne vient pas du goût mais de la géométrie — au-delà, la pastille
  // recouvre le nom du rang précédent. La vraie cible du doigt est le cercle
  // transparent posé par-dessus, plus large que la pastille.
  // Le plafond vient de la disposition, qui seule sait quel axe porte les
  // noms — voir lib/terrain. Debout il vaut ce qu'il a toujours valu.
  const r = rayonPastille(ecart, rayonMax);

  return (
    <svg
      // LE TERRAIN EST RECADRÉ, il ne rétrécit pas.
      //
      // Il dessinait un terrain ENTIER dans un cadre carré, alors qu'une
      // équipe n'occupe que la bande y 26→90 : les vingt-trois premières
      // unités étaient la surface adverse, où par construction il n'y a
      // personne à toucher. Un quart de la hauteur d'un terrain de console
      // pour du gazon décoratif, sur l'écran où tout se joue.
      //
      // La fenêtre commence donc à 15, juste au-dessus des attaquants. Les
      // pastilles gardent leur rayon — ici on ne lit pas, on VISE, et les
      // rétrécir aurait payé la hauteur avec la précision du doigt.
      viewBox="0 15 100 89"
      role="group"
      aria-label="Terrain, touche un joueur"
      className="w-full select-none"
    >
      <rect x="0" y="15" width="100" height="89" fill="#15803d" />
      <g stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.5" fill="none">
        {/* TROIS CÔTÉS, PAS QUATRE. Une ligne en travers du bord supérieur se
            lirait comme une ligne de but ; le terrain continue hors du cadre,
            et ne rien tracer est la seule façon honnête de le dire. La surface
            adverse et son but sortent du champ avec elle. */}
        <path d="M3 15 V101 H97 V15" />
        <line x1="3" y1="52" x2="97" y2="52" />
        <circle cx="50" cy="52" r="11" />
        <rect x="26" y="85" width="48" height="16" />
        <rect x="38" y="95" width="24" height="6" />
      </g>
      <circle cx="50" cy="52" r="1.2" fill="#ffffff" fillOpacity="0.35" />

      {places.map((place, i) => {
        const joueur = place.entry;
        if (!joueur) {
          // Un emplacement vide n'existe que dans le repli 4-3-3, quand la
          // feuille compte moins de onze titulaires. Il garde sa lettre, pour
          // dire qu'il manque un joueur et non que le terrain est cassé.
          return (
            <g key={`vide-${i}`}>
              <circle
                cx={place.x} cy={place.y} r={r}
                fill="none" stroke="#ffffff" strokeOpacity="0.4"
                strokeWidth="0.6" strokeDasharray="1.8 1.4"
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
                invisible. Deux unités de marge : au-delà, deux cibles
                voisines se recouvriraient et le doigt tomberait sur le
                mauvais joueur. */}
            <circle cx={place.x} cy={place.y} r={r + 2} fill="transparent" />
            <circle
              cx={place.x} cy={place.y} r={r}
              fill="#ffffff" stroke="#052e16" strokeWidth="0.5"
            />
            <text
              x={place.x} y={place.y + r * 0.36} textAnchor="middle"
              className="font-black pointer-events-none"
              style={{ fontSize: `${(r * 0.85).toFixed(2)}px` }}
              fill="#111827"
            >
              {joueur.number || place.etiquette}
            </text>
            {/* Le jaune déjà pris : le suivant expulse, et le scoreur doit le
                voir avant de toucher, pas après. */}
            {jaunes.has(joueur.playerId) && (
              <rect
                x={place.x + r * 0.6} y={place.y - r * 1.07} width="2.6" height="3.6"
                fill="#facc15" stroke="#a16207" strokeWidth="0.3"
                className="pointer-events-none"
              />
            )}
            <text
              // Les pastilles des ailes sont proches du bord : un nom centré
              // dessus sortirait du cadre. On ramène l'ancre vers l'intérieur.
              x={Math.min(Math.max(place.x, 13), 87)}
              y={place.y + r + INTERLIGNE}
              textAnchor="middle"
              className="font-bold pointer-events-none"
              style={{ fontSize: "3.2px" }}
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

export default function TerrainConsole({
  home, away, cote, onCote, jaunes, ballon, parts, ballonActif, onBallon, barreActions, onJoueur,
}: {
  home: CoteTerrain;
  away: CoteTerrain;
  cote: Cote;
  onCote: (c: Cote) => void;
  /** Les joueurs qui ont déjà un carton jaune. */
  jaunes: Set<string>;
  /** Le camp qui tient le ballon, `null` quand personne. */
  ballon: Cote | null;
  /** Les parts de possession à l'instant, `null` tant que rien n'est mesuré. */
  parts: { home: number; away: number } | null;
  /** Faux quand le chrono ne tourne pas : rien ne s'accumule, la pastille le dit. */
  ballonActif: boolean;
  onBallon: (c: Cote | null) => void;
  /**
   * Ce qui n'appartient a personne : corner, coup franc, touche, penalty.
   *
   * Rendu ENTRE les onglets et la pelouse. Il vivait sous le terrain, donc
   * sous quatre cents pixels de pelouse : pour poser un corner il fallait
   * faire defiler, et pendant qu'on defile on rate l'action suivante. Tout ce
   * qui concerne le camp affiche tient maintenant au-dessus de lui.
   */
  barreActions?: React.ReactNode;
  onJoueur: (cote: Cote, entry: LineupEntry) => void;
}) {
  const equipe = cote === "home" ? home : away;

  return (
    <div className="overflow-hidden border border-gray-200/70 bg-white">
      {/*
        LES ONGLETS PORTENT AUSSI LE BALLON.
        La possession avait sa propre rangée, juste au-dessus : deux boutons,
        les deux mêmes noms d'équipe, soixante pixels de plus avant d'atteindre
        le terrain. Sur un téléphone, la console faisait défiler trois panneaux
        avant la seule chose qu'on touche.

        Une seule rangée, deux gestes distincts et tous les deux larges :
        — la pastille au bord extérieur donne le ballon à ce camp ;
        — le reste de l'onglet affiche son terrain.

        Ils sont SÉPARÉS À DESSEIN. Le ballon est à l'attaque, mais l'arrêt,
        la faute et le carton sont pour la défense : lier les deux obligerait
        à rendre le ballon à l'adversaire pour noter son gardien.
      */}
      <div className="grid grid-cols-2 divide-x divide-gray-200/70 border-b border-gray-200/70">
        {(["home", "away"] as const).map((k) => {
          const e = k === "home" ? home : away;
          const actif = cote === k;
          const aLeBallon = ballon === k;
          const part = parts ? (k === "home" ? parts.home : parts.away) : null;
          return (
            <div
              key={k}
              // LE CAMP AFFICHÉ SE RECONNAÎT À SON TRAIT VERT, pas à son fond.
              // Il ne tenait qu'au `bg-gray-900` : en thème sombre ce gris
              // (#111827) tombe sur le fond de carte (#101714), les deux
              // onglets deviennent identiques et on ne sait plus quel camp on
              // regarde. Le trait, lui, est vert dans les deux thèmes.
              // `data-onglet-actif` sert au thème sombre, voir styles/dark.css.
              data-onglet-actif={actif ? "" : undefined}
              className={`flex items-stretch border-t-[3px] ${k === "away" ? "flex-row-reverse" : ""} ${
                actif ? "border-emerald-500 bg-gray-900" : "border-transparent bg-white"
              }`}
            >
              {/* Le ballon. Rappuyer dessus le rend à personne — un ballon
                  sorti en touche appartient encore à quelqu'un une seconde
                  plus tard, et cette seconde ne mérite pas un bouton à elle. */}
              <button
                type="button"
                aria-pressed={aLeBallon}
                aria-label={`Donner le ballon à ${e.name}`}
                // ELLE N'EST JAMAIS DÉSACTIVÉE. Elle l'était tant que le chrono
                // ne tournait pas — donc avant le coup d'envoi, à la mi-temps et
                // sur chaque pause : on appuyait, il ne se passait rien, et rien
                // ne disait pourquoi. Or `basculer` sait déjà tenir un chrono
                // arrêté : il RETIENT le camp sans rien lui compter, et le
                // décompte reprend tout seul au coup de sifflet.
                onClick={() => onBallon(aLeBallon ? null : k)}
                className={`flex w-[62px] shrink-0 flex-col items-center justify-center gap-0.5 transition-colors ${
                  aLeBallon
                    ? "bg-emerald-600 text-white"
                    : actif ? "bg-white/10 text-white/60 hover:text-white" : "bg-gray-100 text-gray-500 hover:text-gray-900"
                }`}
              >
                <span aria-hidden className="text-sm leading-none">⚽</span>
                {/* CE QU'ELLE DIT DÉPEND DE CE QU'IL Y A À DIRE. Elle affichait
                    un tiret tant que la mesure était trop courte — dix secondes
                    de tiret après un appui se lisent comme un bouton cassé. Elle
                    se nomme donc tant qu'elle n'a pas de chiffre, et le chiffre
                    arrive dès la première seconde. */}
                <span className="text-[9px] font-black uppercase leading-none tracking-tight tabular-nums">
                  {part !== null ? `${part}%` : aLeBallon ? "a le ballon" : "ballon"}
                </span>
                {!ballonActif && aLeBallon && (
                  <span className="text-[8px] font-bold uppercase leading-none opacity-70">en pause</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onCote(k)}
                aria-pressed={actif}
                className={`min-w-0 flex-1 px-2 py-3 text-left text-[11px] font-black uppercase tracking-wide transition-colors ${
                  k === "away" ? "text-right" : ""
                } ${actif ? "text-white" : "text-gray-400 hover:text-gray-900"}`}
              >
                <span className="block text-[9px] font-black tracking-[0.15em] opacity-60">
                  {k === "home" ? "Domicile" : "Extérieur"}
                </span>
                <span className="block truncate">{e.name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {barreActions}

      {equipe.surLeTerrain.length === 0 ? (
        <p className="bg-gray-50/50 py-12 text-center text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
          Personne sur le terrain
        </p>
      ) : (
        <div className="mx-auto w-full max-w-sm">
          <Pelouse
            titulaires={equipe.surLeTerrain}
            jaunes={jaunes}
            onJoueur={(entry) => onJoueur(cote, entry)}
          />
        </div>
      )}

      {/* Le banc, en pastilles touchables : un remplaçant prend un carton
          comme les autres, et c'est par lui qu'on le fait entrer. */}
      {equipe.banc.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-200/70 px-3 py-2.5">
          <span className="mr-1 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
            Banc
          </span>
          {equipe.banc.map((r) => (
            <button
              key={r.playerId}
              type="button"
              onClick={() => onJoueur(cote, r)}
              className="flex items-center gap-1.5 border border-gray-200/70 px-2 py-1 text-[11px] font-bold text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900"
            >
              <span className="tabular-nums text-gray-400">{r.number || "–"}</span>
              {nomCourt(r.name)}
              {jaunes.has(r.playerId) && (
                <span className="h-2.5 w-1.5 shrink-0 border border-amber-500/30 bg-amber-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- La modale d'actions ------------------------------------------------------

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

        <div className="grid grid-cols-2 gap-2">
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
