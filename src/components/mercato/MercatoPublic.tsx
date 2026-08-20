"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Loader2, ChevronRight } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModal";
import type { Movement } from "@/lib/mercato-admin";

// ============================================
// The mercato as a visitor sees it.
//
// Before, a guest landing on /mercato got `return null`, a blank page,
// which reads as a broken site rather than as a closed door. The market has
// something to show without an account: who actually moved. The rest of the
// page (searching, shortlisting, sending offers) stays behind the account,
// because those are actions, not information.
// ============================================

export default function MercatoPublic() {
  const { open } = useAuthModal();
  const [movements, setMovements] = useState<Movement[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/mercato/mouvements")
      .then((r) => (r.ok ? r.json() : { movements: [] }))
      .then((d) => { if (alive) setMovements(d.movements ?? []); })
      .catch(() => { if (alive) setMovements([]); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-12 pb-24 pt-4">
      <header>
        {/* Pas de titre : la barre du haut dit deja « Mercato ». */}
        <p className="max-w-lg text-base leading-relaxed text-gray-500">
          Les arrivées confirmées du football amateur. Pour recruter ou trouver
          une équipe, il faut un compte.
        </p>

        <button
          onClick={() => open("Crée ton compte pour entrer sur le marché.")}
          className="mt-7 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
        >
          Entrer sur le marché
          <ChevronRight size={15} />
        </button>
      </header>

      <section className="space-y-5">
        <div className="flex items-center gap-3 border-b border-gray-200/70 pb-3">
          <ArrowLeftRight size={24} strokeWidth={1.4} className="text-gray-400" />
          <h2 className="font-display text-2xl font-black tracking-tight text-gray-900">
            Mouvements confirmés
          </h2>
        </div>

        {movements === null ? (
          <div className="flex justify-center py-16">
            <Loader2 size={26} className="animate-spin text-gray-300" />
          </div>
        ) : movements.length === 0 ? (
          <p className="border border-gray-200/70 bg-white px-6 py-16 text-center text-base font-bold text-gray-400">
            Aucun mouvement confirmé pour l&apos;instant.
          </p>
        ) : (
          <div className="divide-y divide-gray-200/70 border border-gray-200/70 bg-white">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                {m.playerPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.playerPhoto} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-black text-gray-400">
                    {m.playerName.slice(0, 2).toUpperCase()}
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold text-gray-900">
                    {m.playerName}
                  </span>
                  <span className="block truncate text-xs font-bold text-gray-400">
                    {m.playerPosition ? `${m.playerPosition} · ` : ""}
                    rejoint {m.teamName}
                  </span>
                </span>

                {m.teamLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.teamLogo} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
