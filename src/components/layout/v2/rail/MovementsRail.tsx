"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Shield } from "lucide-react";
import type { Movement } from "@/lib/mercato-admin";

// ============================================
// Mouvements confirmés — module de rail.
//
// Un transfert entre clubs n'existe pas encore dans le produit : il n'y a pas
// de collection qui dise « ce joueur quitte A pour B ». Ce qu'on sait dire,
// c'est qu'un joueur a REJOINT un club. D'où la flèche à sens unique plutôt
// qu'un aller-retour qui laisserait croire à un marché entre clubs.
//
// Les deux visages sont montrés — celui qui arrive et celui qui accueille —
// parce que c'est ça, l'information : qui, chez qui. Le détour par lequel
// l'accord s'est fait (le club a appelé / le joueur a candidaté) a été
// retiré : dans une colonne de 320px il pesait une ligne par entrée pour un
// détail de procédure, alors que les visages se lisent d'un coup d'œil.
//
// Lit /api/mercato/mouvements : lecture serveur avec le SDK admin, donc rien
// de privé ne transite — seuls les dossiers acceptés sortent.
// ============================================

export default function MovementsRail({ max = 8 }: { max?: number }) {
  const [movements, setMovements] = useState<Movement[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/mercato/mouvements")
      .then((r) => (r.ok ? r.json() : { movements: [] }))
      .then((d) => { if (alive) setMovements(d.movements ?? []); })
      .catch(() => { if (alive) setMovements([]); });
    return () => { alive = false; };
  }, []);

  // Le rail n'a pas de place pour une liste longue : elle deviendrait une
  // deuxième page à côté de la page.
  const shown = movements?.slice(0, max) ?? null;

  return (
    <section aria-labelledby="rail-mouvements">
      <h2
        id="rail-mouvements"
        className="border-b border-gray-200/70 pb-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400"
      >
        Mouvements confirmés
      </h2>

      {shown === null ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      ) : shown.length === 0 ? (
        <p className="py-8 text-sm font-bold leading-relaxed text-gray-400">
          Aucune arrivée confirmée pour l&apos;instant.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200/70">
          {shown.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-4">
              {/* Le joueur qui arrive. */}
              {m.playerPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.playerPhoto} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-black text-gray-400">
                  {m.playerName.slice(0, 2).toUpperCase()}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{m.playerName}</p>
                {m.playerPosition && (
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                    {m.playerPosition}
                  </p>
                )}
              </div>

              <span aria-hidden className="shrink-0 text-base font-black text-gray-300">→</span>

              {/* Le club qui accueille. */}
              {m.teamId ? (
                <Link
                  href={`/teams/${m.teamId}?from=mercato`}
                  title={m.teamName}
                  className="shrink-0 transition-opacity hover:opacity-70"
                >
                  <TeamBadge name={m.teamName} logo={m.teamLogo} />
                </Link>
              ) : (
                <TeamBadge name={m.teamName} logo={m.teamLogo} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Le blason du club, ou son écusson par défaut quand il n'a pas de logo. */
function TeamBadge({ name, logo }: { name: string; logo: string | null }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logo} alt={name} className="h-10 w-10 shrink-0 object-cover" />
    );
  }
  return (
    <span
      aria-label={name}
      className="flex h-10 w-10 shrink-0 items-center justify-center bg-gray-100 text-gray-400"
    >
      <Shield size={18} strokeWidth={1.6} />
    </span>
  );
}
