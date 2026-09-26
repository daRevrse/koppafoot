"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TerrainCompo, { nomCourt } from "@/components/match/TerrainCompo";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
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
// UN SEUL TERRAIN, DEUX BOUTONS. Afficher les deux camps sur un même terrain
// demanderait deux fois onze pastilles dans la hauteur d'un écran : illisible.
// On montre une équipe à la fois, et on bascule. Le terrain garde la même
// place quel que soit le camp regardé, donc rien ne saute sous le doigt.
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

export default function MatchLineups({
  home, away, photos,
}: {
  /**
   * `formation` : « 4-3-3 » quand le manager en a annoncé une.
   * `clubId` : l'équipe KoppaFoot du camp, d'où l'on tire son manager.
   * Absent pour un adversaire hors KoppaFoot, qui n'en a pas chez nous.
   */
  home: { name: string; entries: LineupEntry[]; formation?: string | null; clubId?: string | null };
  away: { name: string; entries: LineupEntry[]; formation?: string | null; clubId?: string | null };
  /**
   * Le visage des joueurs, par identifiant de ligne de feuille.
   *
   * Les DEUX camps dans la même table : un identifiant de feuille est unique,
   * et séparer les deux aurait obligé l'appelant à savoir de quel côté il
   * parle pour une information qui ne dépend pas du camp.
   */
  photos?: Record<string, string | null | undefined>;
}) {
  // On ouvre sur le camp qui a une compo, s'il n'y en a qu'un : basculer pour
  // découvrir que l'autre côté est vide est un geste pour rien.
  const [cote, setCote] = useState<"home" | "away">(
    home.entries.length === 0 && away.entries.length > 0 ? "away" : "home",
  );

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

  const equipe = cote === "home" ? home : away;
  const manager = managers[cote];
  // Tous les titulaires, sans plafond a onze : une competition se joue en NvN
  // (voir lib/terrain), et couper a onze aurait fait disparaitre des joueurs
  // d'un match a quatorze autant qu'il inventait des trous dans un 5v5.
  const titulaires = equipe.entries.filter((e) => e.role === "starter");
  const remplacants = equipe.entries.filter((e) => e.role === "substitute");

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

      {titulaires.length === 0 ? (
        <p className="border border-t-0 border-gray-200/70 bg-gray-50/50 py-10 text-center text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
          Pas de compo
        </p>
      ) : (
        <>
          {/* Le terrain garde le ratio d'un terrain, donc sa hauteur suit sa
              largeur. Sans plafond il occuperait 900px sur un écran large,
              pour onze pastilles qui n'ont rien à y gagner. */}
          <div className="border border-t-0 border-gray-200/70">
            <div className="mx-auto w-full max-w-sm">
              <TerrainCompo titulaires={titulaires} formation={equipe.formation} photos={photos} />
            </div>
          </div>

          {/* Les remplaçants, en une ligne de pastilles. Ils tiennent en deux
              lignes de texte là où une seconde colonne aurait coûté un écran. */}
          {remplacants.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
                Banc
              </span>
              {remplacants.map((r) => (
                <span key={r.playerId} className="text-[11px] font-bold text-gray-600">
                  <span className="mr-1 tabular-nums text-gray-400">{r.number || "–"}</span>
                  {nomCourt(r.name)}
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
