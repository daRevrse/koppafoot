"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Flag, Inbox, Search, History, Calendar, Clock, MapPin, Loader2,
  CheckCircle, XCircle, MonitorPlay, Send, Hourglass, Rocket, Radio,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import {
  onRefereeAssignments,
  getMatchesLookingForReferee,
  respondToRefereeInvitation,
  withdrawRefereeApplication,
  applyToMatchAsReferee,
} from "@/lib/firestore";
import type { Match } from "@/types";

// ============================================
// Mes désignations, l'écran de l'arbitre.
//
// POURQUOI IL MANQUAIT. Toute la mécanique existait déjà — se porter
// candidat, accepter une invitation, se retirer, ouvrir la console d'un
// match qu'on dirige — dans lib/firestore, dans les règles Firestore
// (branche 3 de `matches`) et dans les index. Ce qui n'existait pas, c'est
// l'endroit d'où l'arbitre s'en sert : son espace ne lui proposait que sa
// fiche et deux lignes « Bientôt ». Un rôle activable qui n'ouvre aucun
// écran n'est pas un rôle, c'est une case à cocher.
//
// TROIS ONGLETS, DANS L'ORDRE OÙ ON S'EN SERT. Ce qui m'attend, ce que je
// peux aller chercher, ce que j'ai déjà fait. Les invitations à répondre ne
// sont pas un quatrième onglet : elles remontent en tête du premier, une
// demande qui attend une réponse ne se range pas derrière un clic.
//
// LE TEMPS RÉEL VIENT DE `onRefereeAssignments`. Un manager qui valide une
// candidature pendant que la page est ouverte doit faire apparaître le
// bouton de la console sans rechargement : c'est souvent le même quart
// d'heure, au bord du terrain.
// ============================================

type Onglet = "designations" | "marche" | "historique";

/** Les matchs terminés ou annulés ne se dirigent plus, ils se relisent. */
function estArchive(m: Match): boolean {
  return m.status === "completed" || m.status === "cancelled";
}

/** `date` est un « YYYY-MM-DD » ; un format invalide ne doit pas vider la page. */
function jourLisible(date: string): string {
  try {
    return format(new Date(`${date}T12:00:00`), "EEE d MMM", { locale: fr });
  } catch {
    return date;
  }
}

function estPasse(date: string): boolean {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return date < aujourdhui;
}

// ============================================
// Briques d'affichage
// ============================================

function Squelette() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse space-y-3 border border-gray-200/70 bg-white p-5">
          <div className="h-5 w-52 bg-gray-200" />
          <div className="flex gap-3">
            <div className="h-3 w-24 bg-gray-100" />
            <div className="h-3 w-20 bg-gray-100" />
            <div className="h-3 w-28 bg-gray-100" />
          </div>
          <div className="h-9 w-40 bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

function Vide({ Icon, titre, texte, action }: {
  Icon: typeof Inbox;
  titre: string;
  texte: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center border border-dashed border-gray-200/70 bg-white px-6 py-16 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center bg-gray-100">
        <Icon size={32} className="text-gray-300" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-gray-900">{titre}</h3>
      <p className="mt-1 max-w-sm text-sm text-gray-500">{texte}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

/** L'affiche et le contexte du match, communs à toutes les cartes. */
function EnTeteMatch({ match }: { match: Match }) {
  return (
    <>
      <Link
        href={`/matches/${match.id}`}
        className="block font-display text-base font-black tracking-tight text-gray-900 transition-colors hover:text-emerald-700"
      >
        {match.homeTeamName} <span className="text-gray-300">vs</span> {match.awayTeamName}
      </Link>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar size={12} /> {jourLisible(match.date)}
        </span>
        {match.time && (
          <span className="flex items-center gap-1">
            <Clock size={12} /> {match.time}
          </span>
        )}
        {match.venueName && (
          <span className="flex items-center gap-1">
            <MapPin size={12} /> {match.venueName}
            {match.venueCity ? `, ${match.venueCity}` : ""}
          </span>
        )}
        <span className="border border-gray-200/70 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">
          {match.format}
        </span>
      </div>
    </>
  );
}

function Carte({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 6) * 0.05 }}
      className="overflow-hidden border border-gray-200/70 bg-white p-4 sm:p-5"
    >
      {children}
    </motion.div>
  );
}

const btnPlein =
  "inline-flex items-center justify-center gap-1.5 bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50";
const btnVide =
  "inline-flex items-center justify-center gap-1.5 border border-gray-200/70 px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

// ============================================
// Page
// ============================================

export default function DesignationsPage() {
  const { user } = useAuth();

  const [mes, setMes] = useState<Match[]>([]);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState<Onglet>("designations");
  const [enCours, setEnCours] = useState<Set<string>>(new Set());

  // Le marché ne se charge qu'à l'ouverture de son onglet : c'est une
  // requête sur toute la collection, inutile de la payer à qui vient
  // seulement voir ses matchs de la semaine.
  const [marche, setMarche] = useState<Match[] | null>(null);
  const [marcheCharge, setMarcheCharge] = useState(false);
  const [maVilleSeulement, setMaVilleSeulement] = useState(true);

  // Un compte peut porter le rôle sans l'avoir activé dans Évolution :
  // c'est le cas de tous ceux inscrits avant qu'Évolution existe. Les
  // renvoyer serait leur fermer une page qu'ils sont pourtant en droit
  // d'ouvrir (voir lib/espaces-acces, `roleEffectif`).
  const estArbitre = user?.evolutionRole === "referee" || user?.userType === "referee";

  useEffect(() => {
    if (!user || !estArbitre) {
      setChargement(false);
      return;
    }
    setChargement(true);
    const stop = onRefereeAssignments(user.uid, (data) => {
      setMes(data);
      setChargement(false);
    });
    return () => stop();
  }, [user, estArbitre]);

  const chargerMarche = useCallback(async () => {
    if (!user) return;
    setMarcheCharge(false);
    try {
      const data = await getMatchesLookingForReferee();
      // On n'arbitre pas un match qu'on dirige : un compte peut très bien
      // porter le sifflet et gérer une équipe.
      setMarche(
        data.filter(
          (m) =>
            !estPasse(m.date) &&
            m.managerId !== user.uid &&
            m.awayManagerId !== user.uid,
        ),
      );
    } catch (err) {
      console.error("Désignations : marché indisponible", err);
      toast.error("Impossible de charger les matchs sans arbitre");
      setMarche([]);
    } finally {
      setMarcheCharge(true);
    }
  }, [user]);

  useEffect(() => {
    if (onglet === "marche" && marche === null) chargerMarche();
  }, [onglet, marche, chargerMarche]);

  // ── Répartition ────────────────────────────────────────────
  const { invitations, confirmes, candidatures, historique } = useMemo(() => {
    const vivants = mes.filter((m) => !estArchive(m));
    return {
      invitations: vivants.filter((m) => m.refereeStatus === "invited"),
      confirmes: vivants
        .filter((m) => m.refereeStatus === "confirmed")
        .sort((a, b) => a.date.localeCompare(b.date)),
      candidatures: vivants.filter((m) => m.refereeStatus === "pending"),
      historique: mes
        .filter(estArchive)
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [mes]);

  const villeArbitre = (user?.locationCity ?? "").trim();
  const marcheAffiche = useMemo(() => {
    const liste = marche ?? [];
    const filtre =
      villeArbitre && maVilleSeulement
        ? liste.filter(
            (m) => m.venueCity?.trim().toLowerCase() === villeArbitre.toLowerCase(),
          )
        : liste;
    return [...filtre].sort((a, b) => a.date.localeCompare(b.date));
  }, [marche, maVilleSeulement, villeArbitre]);

  // ── Actions ────────────────────────────────────────────────
  const agir = async (matchId: string, action: () => Promise<void>, succes: string) => {
    setEnCours((s) => new Set(s).add(matchId));
    try {
      await action();
      toast.success(succes);
    } catch (err) {
      console.error("Désignations : action refusée", err);
      toast.error("L'action n'a pas pu être enregistrée");
    } finally {
      setEnCours((s) => {
        const suivant = new Set(s);
        suivant.delete(matchId);
        return suivant;
      });
    }
  };

  const repondre = (match: Match, accepte: boolean) =>
    agir(
      match.id,
      () => respondToRefereeInvitation(match.id, accepte),
      accepte ? "Désignation acceptée" : "Désignation déclinée",
    );

  const seRetirer = (match: Match) =>
    agir(match.id, () => withdrawRefereeApplication(match.id), "Candidature retirée");

  const postuler = (match: Match) => {
    if (!user) return;
    const nom = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Arbitre";
    return agir(
      match.id,
      async () => {
        await applyToMatchAsReferee(match.id, user.uid, nom);
        // Le match quitte le marché sur-le-champ : il réapparaîtra dans
        // « Mes désignations » par le flux temps réel, pas ici.
        setMarche((prev) => (prev ?? []).filter((m) => m.id !== match.id));
      },
      "Candidature envoyée au manager",
    );
  };

  // ── Rendus ─────────────────────────────────────────────────
  if (!user) return null;

  if (!estArbitre) {
    return (
      <div className="mx-auto max-w-2xl">
        <Vide
          Icon={Flag}
          titre="Cet écran est celui des arbitres"
          texte="Active le rôle Arbitre dans Évolution pour recevoir des désignations, te porter candidat sur un match et diriger la rencontre depuis la console."
          action={
            <Link
              href="/evolution"
              className="inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
            >
              <Rocket size={14} /> Choisir mon rôle
            </Link>
          }
        />
      </div>
    );
  }

  const onglets: { cle: Onglet; label: string; Icon: typeof Inbox; compte: number }[] = [
    {
      cle: "designations",
      label: "Mes matchs",
      Icon: Flag,
      compte: invitations.length + confirmes.length + candidatures.length,
    },
    { cle: "marche", label: "Trouver un match", Icon: Search, compte: 0 },
    { cle: "historique", label: "Historique", Icon: History, compte: historique.length },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-gray-900 sm:text-3xl">
          Mes désignations
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Les matchs sur lesquels on te désigne, et ceux qui cherchent encore un arbitre.
        </p>
      </motion.div>

      {/* Onglets */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="flex overflow-x-auto border-b border-gray-200/70"
      >
        {onglets.map(({ cle, label, Icon, compte }) => (
          <button
            key={cle}
            onClick={() => setOnglet(cle)}
            className={`flex shrink-0 items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors ${
              onglet === cle
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon size={16} /> {label}
            {compte > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-100 px-1.5 text-xs font-bold text-primary-700">
                {compte}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {chargement && <Squelette />}

      {/* ── Mes matchs ───────────────────────────────────────── */}
      {!chargement && onglet === "designations" && (
        <div className="space-y-6">
          {/* Ce qui attend une réponse passe devant tout le reste. */}
          {invitations.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-amber-600">
                On te demande d&apos;arbitrer
              </p>
              <AnimatePresence mode="popLayout">
                {invitations.map((match, i) => (
                  <Carte key={match.id} index={i}>
                    <div className="border-l-2 border-amber-400 pl-4">
                      <EnTeteMatch match={match} />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => repondre(match, true)}
                          disabled={enCours.has(match.id)}
                          className={btnPlein}
                        >
                          {enCours.has(match.id) ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle size={14} />
                          )}
                          Accepter
                        </button>
                        <button
                          onClick={() => repondre(match, false)}
                          disabled={enCours.has(match.id)}
                          className={btnVide}
                        >
                          <XCircle size={14} /> Décliner
                        </button>
                      </div>
                    </div>
                  </Carte>
                ))}
              </AnimatePresence>
            </section>
          )}

          {/* Rien nulle part : une seule invitation à agir, pas trois
              sections vides empilées sous leurs titres. */}
          {invitations.length === 0 && confirmes.length === 0 && candidatures.length === 0 && (
            <Vide
              Icon={Flag}
              titre="Aucune désignation pour le moment"
              texte="Les managers peuvent te désigner sur leurs matchs. Tu peux aussi prendre les devants et te porter candidat toi-même."
              action={
                <button onClick={() => setOnglet("marche")} className={btnPlein}>
                  <Search size={14} /> Trouver un match à arbitrer
                </button>
              }
            />
          )}

          {/* Les matchs qu'on dirige vraiment. */}
          {confirmes.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                Désignations confirmées
              </p>
              <AnimatePresence mode="popLayout">
                {confirmes.map((match, i) => {
                  const enDirect = match.status === "live";
                  return (
                    <Carte key={match.id} index={i}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <EnTeteMatch match={match} />
                        </div>
                        <span
                          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            enDirect
                              ? "bg-rose-100 text-rose-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {enDirect ? <Radio size={12} /> : <CheckCircle size={12} />}
                          {enDirect ? "En direct" : "Confirmé"}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/matches/${match.id}/manage`} className={btnPlein}>
                          <MonitorPlay size={14} />
                          {enDirect ? "Reprendre la console" : "Ouvrir la console"}
                        </Link>
                        <Link href={`/matches/${match.id}`} className={btnVide}>
                          Feuille de match <ArrowRight size={14} />
                        </Link>
                      </div>
                    </Carte>
                  );
                })}
              </AnimatePresence>
            </section>
          )}

          {/* Ce qui dépend du manager, et non de l'arbitre. */}
          {candidatures.length > 0 && (
            <section className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                Candidatures envoyées
              </p>
              <AnimatePresence mode="popLayout">
                {candidatures.map((match, i) => (
                  <Carte key={match.id} index={i}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <EnTeteMatch match={match} />
                      </div>
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        <Hourglass size={12} /> Réponse du manager
                      </span>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() => seRetirer(match)}
                        disabled={enCours.has(match.id)}
                        className={btnVide}
                      >
                        {enCours.has(match.id) ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <XCircle size={14} />
                        )}
                        Retirer ma candidature
                      </button>
                    </div>
                  </Carte>
                ))}
              </AnimatePresence>
            </section>
          )}
        </div>
      )}

      {/* ── Trouver un match ─────────────────────────────────── */}
      {!chargement && onglet === "marche" && (
        <div className="space-y-4">
          {villeArbitre && (
            <div className="flex flex-wrap items-center gap-2">
              {[
                { actif: true, label: villeArbitre },
                { actif: false, label: "Partout" },
              ].map(({ actif, label }) => (
                <button
                  key={label}
                  onClick={() => setMaVilleSeulement(actif)}
                  className={`border px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
                    maVilleSeulement === actif
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {!marcheCharge && <Squelette />}

          {marcheCharge && (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {marcheAffiche.map((match, i) => (
                  <Carte key={match.id} index={i}>
                    <EnTeteMatch match={match} />
                    <div className="mt-4">
                      <button
                        onClick={() => postuler(match)}
                        disabled={enCours.has(match.id)}
                        className={btnPlein}
                      >
                        {enCours.has(match.id) ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                        Me porter candidat
                      </button>
                    </div>
                  </Carte>
                ))}
              </AnimatePresence>

              {marcheAffiche.length === 0 && (
                <Vide
                  Icon={Search}
                  titre={
                    maVilleSeulement && villeArbitre
                      ? `Aucun match sans arbitre à ${villeArbitre}`
                      : "Aucun match ne cherche d'arbitre"
                  }
                  texte={
                    maVilleSeulement && villeArbitre
                      ? "Les managers d'ici ont déjà leur arbitre, ou n'ont rien programmé. Élargis à toutes les villes pour voir le reste."
                      : "Reviens plus tard : dès qu'un manager programme un match sans arbitre, il apparaît ici."
                  }
                  action={
                    maVilleSeulement && villeArbitre ? (
                      <button onClick={() => setMaVilleSeulement(false)} className={btnVide}>
                        Voir partout
                      </button>
                    ) : undefined
                  }
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Historique ───────────────────────────────────────── */}
      {!chargement && onglet === "historique" && (
        <div className="space-y-3">
          {historique.map((match, i) => (
            <Carte key={match.id} index={i}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <EnTeteMatch match={match} />
                </div>
                <div className="shrink-0 text-right">
                  {match.status === "completed" ? (
                    <p className="font-display text-xl font-black tracking-tight text-gray-900">
                      {match.scoreHome ?? 0} - {match.scoreAway ?? 0}
                    </p>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
                      Annulé
                    </span>
                  )}
                </div>
              </div>
            </Carte>
          ))}

          {historique.length === 0 && (
            <Vide
              Icon={History}
              titre="Aucun match arbitré"
              texte="Les rencontres que tu auras dirigées se rangeront ici, avec leur score final."
            />
          )}
        </div>
      )}
    </div>
  );
}
