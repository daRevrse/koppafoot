"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUp, Goal, Star } from "lucide-react";
import TerrainCompo, { nomCourt } from "@/components/match/TerrainCompo";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import { useMedia } from "@/hooks/useMedia";
import type { MarquesJoueur } from "@/lib/recit-du-match";
import type { LineupEntry } from "@/types";

// ============================================
// La composition, sur un terrain.
//
// Elle s'affichait en deux colonnes de texte côte à côte — deux listes de
// noms numérotés. Une liste ne dit pas qui joue derrière qui : c'est
// exactement l'information qu'une composition porte, et la seule qu'un
// tableau perdait. Sur un téléphone, les deux colonnes tombaient de surcroît
// à 160px de large et forçaient un écran de défilement par équipe.
//
// UN SEUL TERRAIN, DEUX BOUTONS, SUR TÉLÉPHONE. Afficher les deux camps sur
// un même terrain demanderait deux fois onze pastilles dans la hauteur d'un
// écran : illisible. On montre une équipe à la fois, et on bascule. Le
// terrain garde la même place quel que soit le camp regardé, donc rien ne
// saute sous le doigt. Sur grand écran, les deux terrains se font face.
//
// LA COMPOSITION RACONTE LE MATCH, une fois qu'il est joué : buts, cartons,
// sorties et homme du match autour des pastilles, entrées sur le banc (voir
// lib/recit-du-match).
//
// Le placement suit le POSTE, désormais porté par la feuille de match (voir
// lib/postes), et choisi match par match par le manager. Le dessin lui-même
// vit dans TerrainCompo, partagé avec l'éditeur de feuille : un joueur doit
// se trouver au même endroit qu'on lise le match ou qu'on le compose.
//
// LE MANAGER FERME LA FEUILLE, sous le banc, comme sur une feuille de match
// imprimée. Lui seul, pas le staff : voir /api/public/team/[id]/manager.
// ============================================

/** Le manager d'un camp, tel que le publie /api/public/team/[id]/manager. */
interface ManagerPublic {
  uid: string;
  nom: string;
  photo: string | null;
}

/**
 * Une requête par club et par visite : basculer d'onglet démonte ce
 * composant, et revenir sur la composition ne doit pas refaire l'appel.
 */
const managersDejaDemandes = new Map<string, Promise<ManagerPublic | null>>();

function managerDuClub(clubId: string): Promise<ManagerPublic | null> {
  let p = managersDejaDemandes.get(clubId);
  if (!p) {
    p = fetch(`/api/public/team/${encodeURIComponent(clubId)}/manager`)
      // « Pas de manager » répond 200 ; tout le reste est un échec.
      .then((r) => {
        if (!r.ok) throw new Error(`manager ${r.status}`);
        return r.json();
      })
      .then((j: { manager?: ManagerPublic | null }) => j.manager ?? null)
      .catch(() => {
        // Un échec ne se garde pas : la visite suivante retentera.
        managersDejaDemandes.delete(clubId);
        return null;
      });
    managersDejaDemandes.set(clubId, p);
  }
  return p;
}

/**
 * Les marques d'un remplaçant, à la suite de son nom : son entrée et sa
 * minute, puis ses buts et ses cartons. Le terrain les porte autour des
 * pastilles ; le banc n'a qu'une ligne de texte, elles s'y écrivent.
 */
function MarquesDuBanc({ m, homme }: { m: MarquesJoueur | undefined; homme: boolean }) {
  if (!m && !homme) return null;
  return (
    <span className="ml-1 inline-flex items-center gap-1 align-middle">
      {m?.entreeA != null && (
        <span className="inline-flex items-center text-[10px] font-black tabular-nums text-emerald-600">
          <ArrowUp size={10} strokeWidth={3} aria-label="Entré" />
          {m.entreeA > 0 && `${m.entreeA}'`}
        </span>
      )}
      {m && m.buts > 0 && (
        <span className="inline-flex items-center text-[10px] font-black text-gray-700" title={`${m.buts} but${m.buts > 1 ? "s" : ""}`}>
          <Goal size={10} aria-label="But" />
          {m.buts > 1 && `×${m.buts}`}
        </span>
      )}
      {m && (m.rouge || m.jaunes > 0) && (
        <span
          role="img"
          aria-label={m.rouge ? "Carton rouge" : "Carton jaune"}
          className={`inline-block h-2.5 w-[7px] ${m.rouge ? "bg-red-500" : "bg-amber-400"}`}
        />
      )}
      {homme && <Star size={10} className="fill-amber-400 text-amber-400" aria-label="Homme du match" />}
    </span>
  );
}

type CampDeCompo = {
  name: string;
  entries: LineupEntry[];
  formation?: string | null;
  clubId?: string | null;
};

/**
 * Une équipe : son terrain, son banc, son manager. La même sur téléphone, où
 * l'on bascule de l'une à l'autre, et sur grand écran, où elles se font face.
 */
function Compo({ equipe, manager, photos, marques, homme, aVenir, avecTitre, avecCadre }: {
  equipe: CampDeCompo;
  manager: ManagerPublic | null;
  photos?: Record<string, string | null | undefined>;
  marques?: Record<string, MarquesJoueur>;
  homme?: string | null;
  aVenir: boolean;
  /** Le nom de l'équipe au-dessus, quand aucun bouton ne le porte. */
  avecTitre: boolean;
  /** Collé sous les boutons de bascule, il en prolonge la bordure. */
  avecCadre: boolean;
}) {
  // Tous les titulaires, sans plafond a onze : une competition se joue en NvN
  // (voir lib/terrain), et couper a onze aurait fait disparaitre des joueurs
  // d'un match a quatorze autant qu'il inventait des trous dans un 5v5.
  const titulaires = equipe.entries.filter((e) => e.role === "starter");
  const remplacants = equipe.entries.filter((e) => e.role === "substitute");
  const cadre = avecCadre ? "border border-t-0 border-gray-200/70" : "border border-gray-200/70";

  return (
    <div className="min-w-0">
      {avecTitre && (
        <p className="mb-2 truncate text-[11px] font-black uppercase tracking-wide text-gray-900">
          {equipe.name}
          {equipe.formation && (
            <span className="ml-1.5 tabular-nums text-gray-400">{equipe.formation}</span>
          )}
        </p>
      )}

      {titulaires.length === 0 ? (
        // « Pas de compo » ne disait pas si elle viendrait. Avant le match,
        // elle vient : c'est le manager qui la publie.
        <div className={`${cadre} bg-gray-50/50 px-4 py-10 text-center`}>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
            {aVenir ? "Composition à venir" : "Pas de composition"}
          </p>
          <p className="mt-1.5 text-[12px] font-semibold text-gray-400">
            {aVenir
              ? "Le manager la publie avant le coup d'envoi."
              : "Personne ne l'a saisie pour ce match."}
          </p>
        </div>
      ) : (
        <>
          {/* Le terrain garde le ratio d'un terrain, donc sa hauteur suit sa
              largeur. Sans plafond il occuperait 900px sur un écran large,
              pour onze pastilles qui n'ont rien à y gagner. */}
          <div className={cadre}>
            <div className="mx-auto w-full max-w-sm">
              <TerrainCompo
                titulaires={titulaires}
                formation={equipe.formation}
                photos={photos}
                marques={marques}
                homme={homme}
              />
            </div>
          </div>

          {/* Les remplaçants, en une ligne de noms. Ils tiennent en deux
              lignes de texte là où une seconde colonne aurait coûté un écran.
              Le nom ENTIER, ou presque : « M. Hounkpa… » était coupé à la
              largeur d'une pastille de terrain, qu'une ligne de texte n'a pas. */}
          {remplacants.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
                Banc
              </span>
              {remplacants.map((r) => (
                <span key={r.playerId} className="text-[11px] font-bold text-gray-600">
                  <span className="mr-1 tabular-nums text-gray-400">{r.number || "–"}</span>
                  {nomCourt(r.name, 24)}
                  <MarquesDuBanc m={marques?.[r.playerId]} homme={!!homme && homme === r.playerId} />
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {manager && (
        <div className="mt-3 flex min-w-0 items-center gap-2.5">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
            Manager
          </span>
          <Link
            href={`/profile/${manager.uid}`}
            className="flex min-w-0 items-center gap-2 text-[12px] font-black text-gray-700 hover:text-emerald-700"
          >
            <PlayerAvatar name={manager.nom} photo={manager.photo} size={24} />
            <span className="truncate">{manager.nom}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MatchLineups({
  home, away, photos, marques, homme, aVenir = false,
}: {
  /**
   * `formation` : « 4-3-3 » quand le manager en a annoncé une.
   * `clubId` : l'équipe KoppaFoot du camp, d'où l'on tire son manager.
   * Absent pour un adversaire hors KoppaFoot, qui n'en a pas chez nous.
   */
  home: CampDeCompo;
  away: CampDeCompo;
  /**
   * Le visage des joueurs, par identifiant de ligne de feuille.
   *
   * Les DEUX camps dans la même table : un identifiant de feuille est unique,
   * et séparer les deux aurait obligé l'appelant à savoir de quel côté il
   * parle pour une information qui ne dépend pas du camp.
   */
  photos?: Record<string, string | null | undefined>;
  /** Ce que le match a fait de chacun, par identifiant de ligne (voir lib/recit-du-match). */
  marques?: Record<string, MarquesJoueur>;
  /** L'identifiant de ligne de l'homme du match. */
  homme?: string | null;
  /** Le match n'a pas commencé : une composition absente est encore à venir. */
  aVenir?: boolean;
}) {
  // On ouvre sur le camp qui a une compo, s'il n'y en a qu'un : basculer pour
  // découvrir que l'autre côté est vide est un geste pour rien.
  const [cote, setCote] = useState<"home" | "away">(
    home.entries.length === 0 && away.entries.length > 0 ? "away" : "home",
  );
  // SUR GRAND ÉCRAN, LES DEUX ÉQUIPES SE FONT FACE. La bascule existe parce
  // qu'un téléphone ne tient pas deux terrains dans sa largeur ; un écran
  // d'ordinateur, si, et il laissait deux bandes vides autour d'un seul.
  const grandEcran = useMedia("(min-width: 1024px)");

  // Les deux managers d'un coup, à l'ouverture : la bascule reste instantanée.
  const [managers, setManagers] = useState<{ home: ManagerPublic | null; away: ManagerPublic | null }>({
    home: null, away: null,
  });
  const clubDomicile = home.clubId ?? null;
  const clubExterieur = away.clubId ?? null;
  useEffect(() => {
    let annule = false;
    Promise.all([
      clubDomicile ? managerDuClub(clubDomicile) : null,
      clubExterieur ? managerDuClub(clubExterieur) : null,
    ]).then(([h, a]) => {
      if (!annule) setManagers({ home: h, away: a });
    });
    return () => { annule = true; };
  }, [clubDomicile, clubExterieur]);

  const commun = { photos, marques, homme, aVenir };

  if (grandEcran) {
    return (
      <div className="grid grid-cols-2 gap-6">
        <Compo equipe={home} manager={managers.home} avecTitre avecCadre={false} {...commun} />
        <Compo equipe={away} manager={managers.away} avecTitre avecCadre={false} {...commun} />
      </div>
    );
  }

  return (
    <div>
      {/* Les deux boutons de bascule. Segmentés plutôt qu'empilés : ils sont
          exclusifs, et le geste est un aller-retour. */}
      <div className="grid grid-cols-2 divide-x divide-gray-200/70 border border-gray-200/70">
        {(["home", "away"] as const).map((k) => {
          const e = k === "home" ? home : away;
          const on = cote === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setCote(k)}
              aria-pressed={on}
              className={`truncate px-3 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors ${
                on ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:text-gray-900"
              }`}
            >
              {e.name}
              {/* LA FORME, SOUS LE NOM. Elle ne se lit nulle part ailleurs sur
                  la fiche, et c'est pourtant la premiere chose qu'on cherche
                  en ouvrant une compo. */}
              {e.formation && (
                <span className={`ml-1.5 tabular-nums ${on ? "text-white/50" : "text-gray-300"}`}>
                  {e.formation}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Compo
        equipe={cote === "home" ? home : away}
        manager={managers[cote]}
        avecTitre={false}
        avecCadre
        {...commun}
      />
    </div>
  );
}
