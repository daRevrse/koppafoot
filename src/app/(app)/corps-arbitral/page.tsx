"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion } from "motion/react";
import toast from "react-hot-toast";
import {
  Check, Flag, Loader2, LogOut, Pencil, Radio, Search, Send, ShieldCheck, Trash2,
  UserPlus, UserRound, Users, X, XCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isScorer } from "@/lib/hats";
import {
  onMesCorpsArbitraux, onInvitationsCorpsArbitral, searchReferees, searchScoreurs,
} from "@/lib/firestore";
import { gesteCorps, NIVEAUX_LICENCE, ROLE_DANS_LE_CORPS, type GesteCorps } from "@/lib/arbitrage-client";
import type { CorpsArbitral, RoleDansLeCorps, UserProfile } from "@/types";

// ============================================
// Le corps arbitral : l'équipe permanente d'un arbitre.
//
// L'ARBITRE N'EST PAS DANS L'APPLICATION PENDANT LE MATCH. Il a un sifflet en
// main, pas un téléphone. Il y est avant — accepter sa désignation, choisir
// qui vient avec lui — et après, pour relire le match et ses notes. Pendant,
// c'est son scoreur qui tient la console.
//
// Ce qui manquait, c'est l'équipe elle-même. Un arbitre a ses habitués : les
// assistants avec qui il a l'habitude d'officier, le scoreur qu'il emmène.
// On les réunit ici une fois ; ensuite, pour chaque match où il est désigné,
// il choisit qui l'accompagne depuis « Mes désignations ».
//
// La page sert aussi à ceux qu'on invite, arbitres et scoreurs : c'est ici
// qu'on répond, et ici qu'on voit les corps dont on fait partie.
// ============================================

const btnPlein =
  "inline-flex items-center justify-center gap-1.5 bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
const btnVide =
  "inline-flex items-center justify-center gap-1.5 border border-gray-200/70 px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const btnDiscret =
  "inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-bold text-gray-400 transition-colors hover:text-red-600 disabled:opacity-50";

function Pastille({ role }: { role: RoleDansLeCorps | "chef" }) {
  const styles = {
    chef: "bg-gray-900 text-white",
    arbitre: "bg-violet-50 text-violet-700",
    scoreur: "bg-sky-50 text-sky-700",
  }[role];
  const label = role === "chef" ? "Arbitre principal" : ROLE_DANS_LE_CORPS[role];
  return (
    <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${styles}`}>{label}</span>
  );
}

function Personne({ uid, nom, role, action }: {
  uid: string;
  nom: string;
  role: RoleDansLeCorps | "chef";
  action?: React.ReactNode;
}) {
  const Icone = role === "scoreur" ? Radio : role === "chef" ? ShieldCheck : Flag;
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center ${
        role === "scoreur" ? "bg-sky-50 text-sky-600" : "bg-violet-50 text-violet-600"
      }`}>
        <Icone size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/profile/${uid}`} className="block truncate text-sm font-bold text-gray-900 hover:text-emerald-700">
          {nom}
        </Link>
        <div className="mt-0.5"><Pastille role={role} /></div>
      </div>
      {action}
    </li>
  );
}

export default function CorpsArbitralPage() {
  const { user } = useAuth();
  const [corps, setCorps] = useState<CorpsArbitral[] | null>(null);
  const [invitations, setInvitations] = useState<CorpsArbitral[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [renommage, setRenommage] = useState<string | null>(null);
  const [recherche, setRecherche] = useState<RoleDansLeCorps | null>(null);

  const estArbitre = user?.evolutionRole === "referee" || user?.userType === "referee";
  const scoreur = isScorer(user);

  useEffect(() => {
    if (!user) return;
    const a = onMesCorpsArbitraux(user.uid, setCorps);
    const b = onInvitationsCorpsArbitral(user.uid, setInvitations);
    return () => {
      a();
      b();
    };
  }, [user]);

  const agir = async (cle: string, g: GesteCorps, succes: string) => {
    setEnCours(cle);
    try {
      await gesteCorps(g);
      toast.success(succes);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'action n'a pas pu être enregistrée");
      return false;
    } finally {
      setEnCours(null);
    }
  };

  if (!user) return null;

  const monCorps = (corps ?? []).find((c) => c.chefId === user.uid) ?? null;
  const autres = (corps ?? []).filter((c) => c.chefId !== user.uid);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-gray-900 sm:text-3xl">
          Corps arbitral
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          L&apos;équipe qui officie avec l&apos;arbitre : ses assistants, et les scoreurs qui tiennent
          la console pendant qu&apos;il dirige la rencontre.
        </p>
      </motion.div>

      {/* Ce qui attend une réponse passe devant. */}
      {invitations.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-amber-600">On t&apos;invite</p>
          {invitations.map((c) => {
            const moi = c.invitations.find((i) => i.uid === user.uid);
            return (
              <div key={c.id} className="border border-gray-200/70 border-l-2 border-l-amber-400 bg-white p-4 sm:p-5">
                <p className="font-display text-lg font-black tracking-tight text-gray-900">« {c.nom} »</p>
                <p className="mt-1 text-sm text-gray-600">
                  <Link href={`/profile/${c.chefId}`} className="font-bold hover:text-emerald-700">{c.chefNom}</Link>{" "}
                  t&apos;invite comme <strong>{moi ? ROLE_DANS_LE_CORPS[moi.role].toLowerCase() : "membre"}</strong>
                  {c.ville ? <>, à {c.ville}</> : null}. {c.membres.length > 0
                    ? `${c.membres.length} membre${c.membres.length > 1 ? "s" : ""} déjà.`
                    : "Tu serais le premier à le rejoindre."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => agir(`rep-${c.id}`, { action: "repondre", corpsId: c.id, accepte: true }, `Bienvenue dans « ${c.nom} »`)}
                    disabled={!!enCours}
                    className={btnPlein}
                  >
                    {enCours === `rep-${c.id}` ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Rejoindre
                  </button>
                  <button
                    onClick={() => agir(`rep-${c.id}`, { action: "repondre", corpsId: c.id, accepte: false }, "Invitation déclinée")}
                    disabled={!!enCours}
                    className={btnVide}
                  >
                    <XCircle size={14} /> Décliner
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {corps === null && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-300" aria-label="Chargement" />
        </div>
      )}

      {/* ── Le corps que je dirige ─────────────────────────────── */}
      {corps !== null && estArbitre && !monCorps && (
        <section className="border border-gray-200/70 bg-white p-5 sm:p-6">
          <h2 className="font-display text-xl font-black uppercase tracking-tight text-gray-900">
            Crée ton corps arbitral
          </h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Donne-lui un nom", "Celui que les managers verront à côté du tien."],
              ["2", "Invite ton équipe", "Des arbitres pour t'assister, des scoreurs pour la console."],
              ["3", "Emmène-la sur tes matchs", "À chaque désignation, choisis qui t'accompagne."],
            ].map(([n, t, d]) => (
              <li key={n} className="border border-gray-200/70 p-3">
                <p className="font-display text-2xl font-black text-emerald-600">{n}</p>
                <p className="mt-1 text-sm font-bold text-gray-900">{t}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{d}</p>
              </li>
            ))}
          </ol>
          <form
            className="mt-5 flex flex-col gap-2 sm:flex-row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await agir("creer", { action: "creer", nom }, "Corps arbitral créé")) setNom("");
            }}
          >
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. : Les Sifflets du Golfe"
              maxLength={40}
              className="min-w-0 flex-1 border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
            />
            <button type="submit" disabled={!!enCours || nom.trim().length < 3} className={btnPlein}>
              {enCours === "creer" ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
              Créer mon corps arbitral
            </button>
          </form>
        </section>
      )}

      {monCorps && (
        <section className="border border-gray-200/70 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200/70 p-5 sm:p-6">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
                Mon corps arbitral{monCorps.ville ? ` · ${monCorps.ville}` : ""}
              </p>
              {renommage === null ? (
                <h2 className="mt-1 flex items-center gap-2 font-display text-2xl font-black uppercase leading-tight tracking-tight text-gray-900">
                  {monCorps.nom}
                  <button
                    onClick={() => setRenommage(monCorps.nom)}
                    aria-label="Renommer"
                    className="text-gray-300 transition-colors hover:text-gray-900"
                  >
                    <Pencil size={15} />
                  </button>
                </h2>
              ) : (
                <form
                  className="mt-1 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await agir("renommer", { action: "renommer", corpsId: monCorps.id, nom: renommage }, "Nom enregistré")) {
                      setRenommage(null);
                    }
                  }}
                >
                  <input
                    value={renommage}
                    onChange={(e) => setRenommage(e.target.value)}
                    maxLength={40}
                    autoFocus
                    className="min-w-0 border border-gray-200/70 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  />
                  <button type="submit" disabled={!!enCours} className={btnPlein}><Check size={14} /></button>
                  <button type="button" onClick={() => setRenommage(null)} className={btnVide}><X size={14} /></button>
                </form>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setRecherche("arbitre")} className={btnVide}>
                <UserPlus size={14} /> Inviter un arbitre
              </button>
              <button onClick={() => setRecherche("scoreur")} className={btnVide}>
                <UserPlus size={14} /> Inviter un scoreur
              </button>
            </div>
          </div>

          <ul className="divide-y divide-gray-200/70">
            <Personne uid={user.uid} nom={monCorps.chefNom} role="chef" />
            {monCorps.membres.map((m) => (
              <Personne
                key={m.uid}
                uid={m.uid}
                nom={m.nom}
                role={m.role}
                action={
                  <button
                    onClick={() => {
                      if (window.confirm(`Retirer ${m.nom} de « ${monCorps.nom} » ?\n\nIl sera retiré des matchs à venir où il t'accompagnait.`)) {
                        void agir(`ret-${m.uid}`, { action: "retirer", corpsId: monCorps.id, uid: m.uid }, `${m.nom} ne fait plus partie du corps`);
                      }
                    }}
                    disabled={!!enCours}
                    className={btnDiscret}
                  >
                    {enCours === `ret-${m.uid}` ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                    Retirer
                  </button>
                }
              />
            ))}
          </ul>

          {monCorps.membres.length === 0 && monCorps.invitations.length === 0 && (
            <p className="border-t border-gray-200/70 px-5 py-4 text-sm text-gray-500 sm:px-6">
              Ton corps arbitral n&apos;a encore que toi. Invite un arbitre pour t&apos;assister et un
              scoreur pour tenir la console pendant tes matchs.
            </p>
          )}

          {monCorps.invitations.length > 0 && (
            <div className="border-t border-gray-200/70">
              <p className="px-5 pt-4 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 sm:px-6">
                Invitations envoyées
              </p>
              <ul className="divide-y divide-gray-200/70">
                {monCorps.invitations.map((i) => (
                  <li key={i.uid} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                    <Send size={14} className="shrink-0 text-amber-500" />
                    <p className="min-w-0 flex-1 truncate text-sm text-gray-700">
                      <span className="font-bold">{i.nom}</span>, {ROLE_DANS_LE_CORPS[i.role].toLowerCase()} · en attente
                    </p>
                    <button
                      onClick={() => agir(`inv-${i.uid}`, { action: "annulerInvitation", corpsId: monCorps.id, uid: i.uid }, "Invitation retirée")}
                      disabled={!!enCours}
                      className={btnDiscret}
                    >
                      <XCircle size={13} /> Annuler
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200/70 bg-gray-50 px-5 py-4 sm:px-6">
            <p className="text-xs leading-relaxed text-gray-500">
              Pour chaque match où tu es désigné, choisis qui t&apos;accompagne depuis{" "}
              <Link href="/designations" className="font-bold text-gray-900 underline decoration-dotted underline-offset-2">
                Mes désignations
              </Link>.
            </p>
            <button
              onClick={() => {
                if (window.confirm(`Dissoudre « ${monCorps.nom} » ?\n\nSes membres seront prévenus et retirés de tes matchs à venir.`)) {
                  void agir("dissoudre", { action: "dissoudre", corpsId: monCorps.id }, "Corps arbitral dissous");
                }
              }}
              disabled={!!enCours}
              className={btnDiscret}
            >
              <Trash2 size={13} /> Dissoudre
            </button>
          </div>
        </section>
      )}

      {/* ── Les corps dont je fais partie ──────────────────────── */}
      {autres.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Je fais partie de</p>
          {autres.map((c) => {
            const moi = c.membres.find((m) => m.uid === user.uid);
            return (
              <div key={c.id} className="border border-gray-200/70 bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200/70 p-4 sm:p-5">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-black tracking-tight text-gray-900">« {c.nom} »</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Dirigé par {c.chefNom}{c.ville ? ` · ${c.ville}` : ""}
                      {moi ? <> · tu y es {ROLE_DANS_LE_CORPS[moi.role].toLowerCase()}</> : null}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`Quitter « ${c.nom} » ?\n\nTu seras retiré des matchs à venir où tu accompagnais ${c.chefNom}.`)) {
                        void agir(`quit-${c.id}`, { action: "quitter", corpsId: c.id }, `Tu as quitté « ${c.nom} »`);
                      }
                    }}
                    disabled={!!enCours}
                    className={btnDiscret}
                  >
                    <LogOut size={13} /> Quitter
                  </button>
                </div>
                <ul className="divide-y divide-gray-200/70">
                  <Personne uid={c.chefId} nom={c.chefNom} role="chef" />
                  {c.membres.map((m) => <Personne key={m.uid} uid={m.uid} nom={m.nom} role={m.role} />)}
                </ul>
                {moi?.role === "scoreur" && (
                  <p className="border-t border-gray-200/70 bg-sky-50/50 px-4 py-3 text-xs leading-relaxed text-sky-900 sm:px-5">
                    Quand {c.chefNom} t&apos;emmène sur un match, il apparaît dans{" "}
                    <Link href="/live-ops" className="font-bold underline decoration-dotted underline-offset-2">Mes directs</Link> :
                    c&apos;est toi qui tiens la console.
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Ni arbitre, ni scoreur, ni invité : rien à faire ici. */}
      {corps !== null && !estArbitre && autres.length === 0 && invitations.length === 0 && (
        <div className="flex flex-col items-center border border-dashed border-gray-200/70 bg-white px-6 py-16 text-center">
          <Users size={32} className="text-gray-300" />
          <h3 className="mt-4 font-display text-lg font-bold text-gray-900">Aucun corps arbitral</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            {scoreur
              ? "Un arbitre peut t'inviter dans son corps arbitral pour tenir la console de ses matchs. Son invitation apparaîtra ici."
              : "Les corps arbitraux réunissent des arbitres et des scoreurs. Active le rôle Arbitre pour créer le tien."}
          </p>
          {!scoreur && (
            <Link href="/roles#choisir" className={`${btnVide} mt-5`}>Choisir mon rôle</Link>
          )}
        </div>
      )}

      {recherche && monCorps && (
        <InviterMembre
          role={recherche}
          corps={monCorps}
          moi={user.uid}
          fermer={() => setRecherche(null)}
          inviter={async (p) => {
            const ok = await agir(
              `invite-${p.uid}`,
              { action: "inviter", corpsId: monCorps.id, uid: p.uid, role: recherche },
              `Invitation envoyée à ${p.firstName}`,
            );
            if (ok) setRecherche(null);
          }}
          enCours={enCours}
        />
      )}
    </div>
  );
}

// ============================================
// Inviter un arbitre ou un scoreur
// ============================================

function InviterMembre({ role, corps, moi, fermer, inviter, enCours }: {
  role: RoleDansLeCorps;
  corps: CorpsArbitral;
  moi: string;
  fermer: () => void;
  inviter: (p: UserProfile) => void;
  enCours: string | null;
}) {
  const [liste, setListe] = useState<UserProfile[] | null>(null);
  const [nom, setNom] = useState("");
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let perime = false;
    const deja = new Set([moi, ...corps.membres.map((m) => m.uid), ...corps.invitations.map((i) => i.uid)]);
    (role === "arbitre" ? searchReferees({}) : searchScoreurs())
      .then((l) => l.filter((p) => !deja.has(p.uid)))
      .catch((err) => {
        console.error("Corps arbitral : recherche", err);
        return [] as UserProfile[];
      })
      .then((l) => {
        if (!perime) setListe(l);
      });
    return () => {
      perime = true;
    };
  }, [role, corps, moi]);

  useEffect(() => {
    champ.current?.focus();
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    document.addEventListener("keydown", auClavier);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.style.overflow = avant;
    };
  }, [fermer]);

  // Ceux de sa ville d'abord : c'est avec eux qu'on officie le dimanche.
  const ville = (corps.ville ?? "").toLowerCase();
  const q = nom.trim().toLowerCase();
  const affiches = (liste ?? [])
    .filter((p) => !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
    .sort((a, b) =>
      Number((b.locationCity ?? "").toLowerCase() === ville) - Number((a.locationCity ?? "").toLowerCase() === ville)
      || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Fermer" onClick={fermer} className="absolute inset-0 bg-gray-900/60 backdrop-blur-[2px]" />
      <div role="dialog" aria-modal="true" aria-labelledby="inviter-titre" className="relative flex max-h-[90dvh] w-full max-w-lg flex-col border border-gray-200/70 bg-white">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200/70 p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">« {corps.nom} »</p>
            <h2 id="inviter-titre" className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight text-gray-900">
              {role === "arbitre" ? "Inviter un arbitre" : "Inviter un scoreur"}
            </h2>
          </div>
          <button type="button" onClick={fermer} aria-label="Fermer" className="-mr-1 -mt-1 shrink-0 border border-gray-200/70 p-2 text-gray-400 transition-colors hover:border-gray-900 hover:text-gray-900">
            <X size={15} />
          </button>
        </div>
        <div className="border-b border-gray-200/70 p-5 sm:px-6">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={champ}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Chercher par nom"
              className="w-full border border-gray-200/70 py-2.5 pl-9 pr-3 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            {role === "arbitre"
              ? "Les comptes qui ont activé le rôle Arbitre."
              : "Les scoreurs validés par KoppaFoot : ils ont fait leur candidature sur la page Scoreurs."}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {liste === null ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
          ) : affiches.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-gray-500">
              {role === "arbitre" ? "Aucun arbitre à inviter." : "Aucun scoreur à inviter."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-200/70">
              {affiches.map((p) => (
                <li key={p.uid} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden ${
                    role === "scoreur" ? "bg-sky-50 text-sky-600" : "bg-violet-50 text-violet-600"
                  }`}>
                    {p.profilePictureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.profilePictureUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserRound size={18} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/profile/${p.uid}`} target="_blank" className="block truncate text-sm font-bold text-gray-900 hover:text-emerald-700">
                      {p.firstName} {p.lastName}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] text-gray-500">
                      {[p.locationCity, p.licenseLevel ? `Licence ${NIVEAUX_LICENCE[p.licenseLevel] ?? p.licenseLevel}` : null]
                        .filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button onClick={() => inviter(p)} disabled={!!enCours} className={`${btnPlein} shrink-0 px-3 text-xs`}>
                    {enCours === `invite-${p.uid}` ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    Inviter
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
