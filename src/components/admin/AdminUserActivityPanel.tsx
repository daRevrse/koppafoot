"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  X, Loader2, Trophy, Shield, Flag, ClipboardList, Star, Ghost,
} from "lucide-react";
import { getAdminUserActivity, type AdminUserActivity } from "@/lib/admin-firestore";
import { roleEffectif } from "@/lib/espaces-acces";
import type { UserProfile } from "@/types";

// ============================================
// Ce qu'un compte a réellement fait, casquette par casquette.
//
// La colonne « rôle » d'un tableau annonce « manager » aussi bien pour celui
// qui dirige trois clubs que pour celui qui n'a jamais rien créé. Les
// compteurs vivent chacun dans leur collection : il faut aller les chercher,
// et c'est exactement ce qu'on ne peut pas faire depuis une ligne de tableau.
//
// Les quatre familles sont affichées ensemble, sans se limiter au rôle
// déclaré : un compte cumule un rôle et des casquettes, et c'est justement
// l'écart entre ce qu'il déclare et ce qu'il fait qui intéresse ici.
// ============================================

function Groupe({
  titre,
  Icone,
  ton,
  children,
  vide,
}: {
  titre: string;
  Icone: typeof Trophy;
  ton: string;
  children: React.ReactNode;
  vide?: boolean;
}) {
  return (
    <section className="rounded-xl border border-gray-100 p-4">
      <h3 className={`mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] ${ton}`}>
        <Icone size={13} /> {titre}
      </h3>
      {vide ? <p className="text-sm italic text-gray-300">Rien à ce titre.</p> : children}
    </section>
  );
}

function Chiffres({ items }: { items: { label: string; valeur: number | string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="rounded-lg bg-gray-50 p-2.5 text-center">
          <p className="font-display text-xl font-black tabular-nums text-gray-900">{s.valeur}</p>
          <p className="text-[10px] font-medium text-gray-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function AdminUserActivityPanel({
  user,
  onClose,
}: {
  user: UserProfile;
  onClose: () => void;
}) {
  const [a, setA] = useState<AdminUserActivity | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    getAdminUserActivity(user.uid).then(setA).catch(() => setErreur(true));
  }, [user.uid]);

  const nom = `${user.firstName} ${user.lastName}`.trim() || user.email || user.uid;
  const role = roleEffectif(user);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-extrabold text-gray-900">{nom}</h2>
            <p className="truncate text-xs text-gray-500">
              {user.email ?? "sans email"}
              {role && <> · rôle déclaré : <span className="font-semibold">{role}</span></>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {erreur ? (
            <p className="py-10 text-center text-sm text-gray-500">Lecture impossible.</p>
          ) : !a ? (
            <div className="flex justify-center py-14">
              <Loader2 size={26} className="animate-spin text-gray-300" />
            </div>
          ) : (
            <>
              <Groupe titre="Joueur" Icone={Star} ton="text-emerald-600">
                <Chiffres items={[
                  { label: "Matchs", valeur: a.matchesPlayed },
                  { label: "Buts", valeur: a.goals },
                  { label: "Passes", valeur: a.assists },
                  { label: "Note moyenne", valeur: a.noteMoyenne ?? "," },
                ]} />
                {a.equipesRejointes.length > 0 && (
                  <p className="mt-3 text-xs text-gray-500">
                    Effectif de{" "}
                    {a.equipesRejointes.map((t, i) => (
                      <span key={t.id}>
                        {i > 0 && ", "}
                        <Link href={`/admin/teams/${t.id}`} className="font-semibold text-gray-700 hover:underline">
                          {t.name}
                        </Link>
                      </span>
                    ))}
                  </p>
                )}
              </Groupe>

              <Groupe titre="Manager" Icone={Shield} ton="text-blue-600" vide={a.equipesDirigees.length === 0 && a.matchsProgrammes === 0}>
                <Chiffres items={[
                  { label: "Équipes dirigées", valeur: a.equipesDirigees.length },
                  { label: "Effectif cumulé", valeur: a.equipesDirigees.reduce((n, t) => n + t.memberIds.length, 0) },
                  { label: "Matchs programmés", valeur: a.matchsProgrammes },
                  { label: "Dont amicaux", valeur: a.amicauxHorsPlateforme },
                ]} />
                {a.equipesDirigees.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {a.equipesDirigees.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                        <Link href={`/admin/teams/${t.id}`} className="truncate text-sm font-semibold text-gray-900 hover:underline">
                          {t.name}
                        </Link>
                        <span className="shrink-0 text-[11px] text-gray-500">
                          {t.memberIds.length} joueur{t.memberIds.length > 1 ? "s" : ""} · {t.wins}V {t.draws}N {t.losses}D
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {a.amicauxHorsPlateforme > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
                    <Ghost size={11} /> {a.amicauxHorsPlateforme} match{a.amicauxHorsPlateforme > 1 ? "s" : ""} contre une équipe hors plateforme
                  </p>
                )}
              </Groupe>

              <Groupe titre="Arbitre" Icone={Flag} ton="text-amber-600" vide={a.matchsArbitres === 0 && a.designationsEnAttente === 0}>
                <Chiffres items={[
                  { label: "Matchs arbitrés", valeur: a.matchsArbitres },
                  { label: "En attente", valeur: a.designationsEnAttente },
                ]} />
              </Groupe>

              <Groupe titre="Organisateur" Icone={ClipboardList} ton="text-violet-600" vide={a.competitions.length === 0}>
                <ul className="space-y-1.5">
                  {a.competitions.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
                      <span className="truncate text-sm font-semibold text-gray-900">{c.name}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        c.isValidated ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      }`}>
                        {c.isValidated ? "publique" : "à valider"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Groupe>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
