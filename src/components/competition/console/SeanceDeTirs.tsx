"use client";

import { TIRS_PAR_EQUIPE, etatDeLaSeance, type Seance, type Tir } from "@/lib/tirs-au-but";
import { nomCourt } from "@/components/match/TerrainCompo";
import type { LineupEntry } from "@/types";
import type { Side } from "./types";

/**
 * LA SÉANCE DE TIRS AU BUT, TIR PAR TIR, à la place des terrains : le jeu est
 * fini, il ne reste que la séance. Le tirage d'abord — qui tire en premier —,
 * puis chaque tir : le tireur si on l'a vu (facultatif, un appui), puis
 * l'issue. L'alternance, la fin anticipée et la mort subite se calculent
 * (lib/tirs-au-but). Un tir mal saisi s'annule ; une séance manquée se saisit
 * encore en un score, comme avant.
 */
export function SeanceDeTirs({
  seance, etat, nomDe, tireurs, tireur, onTireur, onPremier, onTir, onAnnuler, onValider, onSaisieDirecte,
  isSubmitting,
}: {
  seance: Seance;
  etat: ReturnType<typeof etatDeLaSeance>;
  nomDe: (c: Side) => string;
  tireurs: (c: Side) => LineupEntry[];
  tireur: LineupEntry | null;
  onTireur: (e: LineupEntry | null) => void;
  onPremier: (c: Side) => void;
  onTir: (issue: Tir["issue"]) => void;
  onAnnuler: () => void;
  onValider: () => void;
  onSaisieDirecte: () => void;
  isSubmitting: boolean;
}) {
  const ligne = (c: Side) => {
    const siens = seance.tirs.filter((t) => t.cote === c);
    const cases = Math.max(TIRS_PAR_EQUIPE, siens.length);
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[11px] font-black uppercase tracking-wide text-white/70">{nomDe(c)}</span>
        <span className="flex shrink-0 gap-1.5">
          {Array.from({ length: cases }, (_, i) => {
            const t = siens[i];
            return (
              <span
                key={i}
                title={t?.playerName ?? undefined}
                className={`h-3.5 w-3.5 rounded-full border ${
                  !t ? "border-white/20" : t.issue === "marque" ? "border-emerald-400 bg-emerald-400" : "border-red-400 bg-red-500/30"
                }`}
              />
            );
          })}
        </span>
      </div>
    );
  };
  const deja = new Set(seance.tirs.map((t) => t.playerId).filter(Boolean));

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-3 py-3 text-white">
      <div className="w-full max-w-lg space-y-3">
        <div className="flex items-baseline justify-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Tirs au but</span>
          <span className="font-mono text-2xl font-black tabular-nums">
            {etat.score.home} – {etat.score.away}
          </span>
          {etat.mortSubite && !etat.terminee && (
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300">Mort subite</span>
          )}
        </div>
        <div className="space-y-1.5 border border-white/10 bg-white/[0.04] p-3">
          {ligne("home")}
          {ligne("away")}
        </div>

        {!seance.premier ? (
          <div className="space-y-2">
            <p className="text-center text-[11px] font-black uppercase tracking-wider text-white/60">
              Qui tire en premier ?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["home", "away"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onPremier(c)}
                  className="truncate bg-emerald-600 px-3 py-3 text-xs font-black uppercase tracking-wide text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
                >
                  {nomDe(c)}
                </button>
              ))}
            </div>
          </div>
        ) : etat.terminee && etat.vainqueur ? (
          <div className="space-y-2 text-center">
            <p className="text-sm font-black uppercase tracking-wide text-emerald-300">
              {`${nomDe(etat.vainqueur)} l'emporte aux tirs au but`}
            </p>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onValider}
              className="w-full bg-white py-3 text-xs font-black uppercase tracking-widest text-gray-900 transition-colors hover:bg-gray-100 disabled:opacity-40"
            >
              Valider et terminer le match
            </button>
          </div>
        ) : etat.prochain ? (
          <div className="space-y-2">
            <p className="text-center text-[11px] font-black uppercase tracking-wider text-white/60">
              {`Au tour de ${nomDe(etat.prochain)}`}
              {tireur ? ` · ${tireur.name}` : " · tireur ?"}
            </p>
            <div className="flex flex-wrap justify-center gap-1">
              {tireurs(etat.prochain).map((e) => (
                <button
                  key={e.playerId}
                  type="button"
                  onClick={() => onTireur(tireur?.playerId === e.playerId ? null : e)}
                  className={`border px-2 py-1 text-[10px] font-black tabular-nums transition-colors ${
                    tireur?.playerId === e.playerId
                      ? "border-white bg-white text-gray-900"
                      : deja.has(e.playerId) ? "border-white/10 text-white/30" : "border-white/20 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {e.number ? `${e.number} ` : ""}{nomCourt(e.name)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([["marque", "⚽ Marqué", "bg-emerald-600 hover:bg-emerald-500"], ["rate", "👟 Raté", "bg-white/10 hover:bg-white/20"], ["arrete", "🧤 Arrêté", "bg-sky-700 hover:bg-sky-600"]] as const).map(([issue, libelle, ton]) => (
                <button
                  key={issue}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => onTir(issue)}
                  className={`py-3 text-xs font-black uppercase tracking-wide text-white transition-colors active:scale-95 disabled:opacity-40 ${ton}`}
                >
                  {libelle}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-center gap-4 pt-1">
          {seance.tirs.length > 0 && (
            <button
              type="button"
              onClick={onAnnuler}
              className="text-[10px] font-black uppercase tracking-widest text-white/50 underline hover:text-white"
            >
              Annuler le dernier tir
            </button>
          )}
          <button
            type="button"
            onClick={onSaisieDirecte}
            className="text-[10px] font-black uppercase tracking-widest text-white/35 underline hover:text-white"
          >
            Saisir le score final directement
          </button>
        </div>
      </div>
    </div>
  );
}
