"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Loader2, Plus, Minus, ChevronRight, ChevronLeft, CheckCircle2,
  History, AlertTriangle, X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  searchOpponentTeams, getTeamMembers, getGhostPlayersByTeam, recordPlayedMatch,
  type ButeurSaisi,
} from "@/lib/firestore";
import type { Team } from "@/types";

// ============================================
// Renseigner un match déjà joué.
//
// Le troisième parcours, et le seul qui regarde en arrière. Les deux autres
// programment : leur formulaire refuse une date passée, et un club n'avait donc
// aucun moyen de porter son historique sur la plateforme.
//
// DEUX DIFFÉRENCES DE FOND avec les deux autres, qui expliquent tout le reste :
//
//  - il n'y a rien à convoquer. Le match a eu lieu ; personne n'a de présence
//    à confirmer. On demande le score et qui a marqué, pas une feuille.
//  - il n'y a pas de retour en arrière. Un match renseigné ne se modifie plus
//    une fois validé — d'où le récapitulatif, qui est le dernier moment où on
//    peut se relire.
//
// La fenêtre est de quatre-vingt-dix jours, bornée ici pour le confort et AU
// SERVEUR pour de vrai : plus la date est lointaine, moins il reste de
// quelqu'un pour démentir un score.
// ============================================

const FENETRE_JOURS = 90;

const jour = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Un joueur de l'effectif, avec ou sans compte, tel que la saisie le voit. */
interface JoueurSaisissable {
  id: string;
  nom: string;
  sansCompte: boolean;
  detail: string;
}

interface Props {
  teams: Team[];
  managerId: string;
  onClose: () => void;
  onRecorded: () => void;
}

export default function RecordMatchForm({ teams, managerId, onClose, onRecorded }: Props) {
  const [etape, setEtape] = useState<"saisie" | "recap">("saisie");
  const [envoi, setEnvoi] = useState(false);

  const [teamId, setTeamId] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [terrain, setTerrain] = useState("");
  const [ville, setVille] = useState("");
  const [format, setFormat] = useState("11v11");
  const [scoreUs, setScoreUs] = useState("");
  const [scoreThem, setScoreThem] = useState("");

  // Adversaire : une équipe KoppaFoot (qui devra contresigner) ou un nom libre.
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<Team[]>([]);
  const [chercheEnCours, setChercheEnCours] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const [advTeamId, setAdvTeamId] = useState("");
  const [advManagerId, setAdvManagerId] = useState("");
  const [advNom, setAdvNom] = useState("");
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [effectif, setEffectif] = useState<JoueurSaisissable[]>([]);
  const [saisie, setSaisie] = useState<Record<string, { buts: number; passes: number }>>({});

  const aujourdhui = jour(new Date());
  const plancher = jour(new Date(Date.now() - FENETRE_JOURS * 24 * 60 * 60 * 1000));
  // Un match d'hier au plus tard : « déjà joué » exclut aujourd'hui, qui se
  // programme par les deux autres parcours.
  const plafond = jour(new Date(Date.now() - 24 * 60 * 60 * 1000));

  // L'effectif du camp qu'on renseigne, comptes et joueurs sans compte réunis :
  // ce sont les mêmes joueurs, seule leur trace en base diffère.
  useEffect(() => {
    if (!teamId) { setEffectif([]); setSaisie({}); return; }
    let annule = false;
    Promise.all([getTeamMembers(teamId), getGhostPlayersByTeam(teamId)])
      .then(([membres, fantomes]) => {
        if (annule) return;
        setEffectif([
          ...membres.map((m) => ({
            id: m.uid,
            nom: `${m.firstName} ${m.lastName}`.trim() || m.email || m.uid,
            sansCompte: false,
            detail: m.position ?? "Joueur",
          })),
          ...fantomes.map((g) => ({
            id: g.id,
            nom: `${g.firstName} ${g.lastName}`.trim(),
            sansCompte: true,
            detail: "sans compte",
          })),
        ]);
        setSaisie({});
      })
      .catch(() => { if (!annule) setEffectif([]); });
    return () => { annule = true; };
  }, [teamId]);

  const chercherAdversaire = (v: string) => {
    setRecherche(v);
    setAdvTeamId(""); setAdvManagerId("");
    // Le nom tapé fait office d'adversaire hors plateforme tant qu'on n'a
    // choisi personne dans la liste.
    setAdvNom(v.trim());
    if (minuteur.current) clearTimeout(minuteur.current);
    if (!v.trim()) { setResultats([]); setDropdown(false); return; }
    setDropdown(true);
    setChercheEnCours(true);
    minuteur.current = setTimeout(async () => {
      try {
        setResultats(await searchOpponentTeams({ query: v, managerId }));
      } catch { /* la saisie libre reste possible */ }
      finally { setChercheEnCours(false); }
    }, 300);
  };

  const choisirEquipe = (t: Team) => {
    setAdvTeamId(t.id);
    setAdvManagerId(t.managerId);
    setAdvNom(t.name);
    setRecherche(t.name);
    setDropdown(false);
  };

  const buteurs: ButeurSaisi[] = useMemo(
    () => effectif
      .filter((j) => (saisie[j.id]?.buts ?? 0) > 0 || (saisie[j.id]?.passes ?? 0) > 0)
      .map((j) => ({
        playerId: j.id, sansCompte: j.sansCompte, nom: j.nom,
        buts: saisie[j.id]?.buts ?? 0, passes: saisie[j.id]?.passes ?? 0,
      })),
    [effectif, saisie],
  );

  const nous = parseInt(scoreUs, 10);
  const eux = parseInt(scoreThem, 10);
  const butsSaisis = buteurs.reduce((n, b) => n + b.buts, 0);
  const equipe = teams.find((t) => t.id === teamId);
  const contreUnCompte = !!advTeamId && !!advManagerId;

  const saisieComplete = !!teamId && !!advNom.trim() && !!date
    && Number.isFinite(nous) && Number.isFinite(eux) && nous >= 0 && eux >= 0;

  const ajuster = (id: string, champ: "buts" | "passes", delta: number) => {
    setSaisie((prev) => {
      const courant = prev[id] ?? { buts: 0, passes: 0 };
      return { ...prev, [id]: { ...courant, [champ]: Math.max(0, courant[champ] + delta) } };
    });
  };

  const valider = async () => {
    if (!saisieComplete) return;
    setEnvoi(true);
    try {
      const r = await recordPlayedMatch({
        teamId, isHome,
        opponentTeamId: advTeamId || undefined,
        opponentManagerId: advManagerId || undefined,
        opponentName: advNom.trim(),
        date, time: heure,
        venueName: terrain.trim(), venueCity: ville.trim(),
        format, scoreUs: nous, scoreThem: eux, buteurs,
      });
      toast.success(r.enAttente
        ? "Match enregistré : il attend la confirmation de l'adversaire"
        : "Match enregistré");
      onRecorded();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'enregistrement a échoué");
    } finally {
      setEnvoi(false);
    }
  };

  // ---------------------------------------------------------------- récap
  if (etape === "recap") {
    return (
      <div className="border-2 border-gray-900 bg-white p-3 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-gray-900 sm:text-lg">Relis avant de valider</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Un match renseigné ne se modifie plus. Tu pourras le supprimer et le ressaisir, rien d&apos;autre.
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="border border-gray-200/70 bg-gray-50/60 p-4">
          <p className="text-center font-display text-lg font-black text-gray-900">
            {isHome ? equipe?.name : advNom} <span className="mx-2 tabular-nums">{isHome ? nous : eux} – {isHome ? eux : nous}</span> {isHome ? advNom : equipe?.name}
          </p>
          <p className="mt-1 text-center text-xs text-gray-500">
            {date}{heure ? ` à ${heure}` : ""}{terrain ? ` · ${terrain}` : ""} · {format}
          </p>
        </div>

        {butsSaisis !== nous && (
          <p className="mt-3 flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Tu as saisi {butsSaisis} buteur{butsSaisis > 1 ? "s" : ""} pour {nous} but{nous > 1 ? "s" : ""}.
            Ce n&apos;est pas bloquant — un but contre son camp ou un buteur oublié arrive — mais relis.
          </p>
        )}

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Ce qui sera crédité</p>
          {buteurs.length === 0 ? (
            <p className="text-sm italic text-gray-400">Aucun joueur nommé : seul le bilan du club bougera.</p>
          ) : (
            <ul className="space-y-1.5">
              {buteurs.map((b) => (
                <li key={b.playerId} className="flex items-center justify-between gap-3 border border-gray-200/70 px-3 py-2">
                  <span className="truncate text-sm font-semibold text-gray-900">{b.nom}</span>
                  <span className="shrink-0 text-xs font-bold text-gray-500">
                    {b.buts} but{b.buts > 1 ? "s" : ""} · {b.passes} passe{b.passes > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-4 border border-gray-200/70 bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
          {contreUnCompte ? (
            <>
              <strong className="font-semibold text-gray-800">{advNom}</strong> est sur KoppaFoot : rien ne
              comptera tant que son manager n&apos;aura pas confirmé ce score. Le match s&apos;affichera en
              attente.
            </>
          ) : (
            <>
              <strong className="font-semibold text-gray-800">{advNom}</strong> n&apos;est pas sur KoppaFoot :
              le résultat compte immédiatement dans le bilan de ton club et dans la carrière des joueurs nommés.
            </>
          )}
        </p>

        <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => setEtape("saisie")}
            disabled={envoi}
            className="inline-flex items-center gap-2 border border-gray-200/70 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft size={16} /> Corriger
          </button>
          <button
            onClick={valider}
            disabled={envoi}
            className="inline-flex items-center gap-2 bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50"
          >
            {envoi ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Valider ce match
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------- saisie
  return (
    <div className="border-2 border-gray-900 bg-white p-3 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-gray-900 sm:text-lg">
            <History size={18} /> Renseigner un match joué
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Un match des {FENETRE_JOURS} derniers jours, déjà disputé. Aucune convocation ne partira.
          </p>
        </div>
        <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-100">
          <X size={18} />
        </button>
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Mon équipe</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
          >
            <option value="">Sélectionner une équipe</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="relative">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Adversaire</label>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={recherche}
              onChange={(e) => chercherAdversaire(e.target.value)}
              onBlur={() => setTimeout(() => setDropdown(false), 150)}
              placeholder="Nom de l'équipe…"
              className="w-full border border-gray-200/70 bg-white py-2.5 pl-8 pr-3 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          {dropdown && recherche.trim() && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden border border-gray-200/70 bg-white">
              {resultats.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onMouseDown={() => choisirEquipe(t)}
                  className="flex w-full flex-col px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{t.name}</span>
                  <span className="text-xs text-gray-500">{t.city} · sur KoppaFoot, devra confirmer</span>
                </button>
              ))}
              {chercheEnCours && resultats.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                  <Loader2 size={14} className="animate-spin" /> Recherche…
                </div>
              )}
              {!chercheEnCours && (
                <p className="border-t border-gray-200/70 bg-gray-50/60 px-4 py-2.5 text-xs text-gray-500">
                  Sans sélection, «&nbsp;{recherche.trim()}&nbsp;» sera traitée comme une équipe hors plateforme.
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Date du match</label>
          <input
            type="date" value={date} min={plancher} max={plafond}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-gray-400">Entre le {plancher} et hier.</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Heure (optionnel)</label>
          <input
            type="time" value={heure} onChange={(e) => setHeure(e.target.value)}
            className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Terrain (optionnel)</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={terrain} onChange={(e) => setTerrain(e.target.value)} placeholder="Nom"
              className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
            />
            <input
              value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Ville"
              className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Format</label>
          <div className="flex gap-2">
            {["5v5", "7v7", "11v11"].map((f) => (
              <button
                key={f} type="button" onClick={() => setFormat(f)}
                className={`flex-1 border px-3 py-2.5 text-sm font-medium transition-colors ${
                  format === f ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200/70 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Lieu</label>
          <div className="flex gap-2">
            {[{ v: true, l: "Domicile" }, { v: false, l: "Extérieur" }].map((o) => (
              <button
                key={o.l} type="button" onClick={() => setIsHome(o.v)}
                className={`flex-1 border px-3 py-2.5 text-sm font-medium transition-colors ${
                  isHome === o.v ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200/70 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Le score */}
      <div className="mt-4 border border-gray-200/70 bg-gray-50/60 p-4">
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Score final</p>
        <div className="flex items-end justify-center gap-3">
          <div className="min-w-0 flex-1 text-center">
            <p className="mb-1.5 truncate text-xs font-bold text-gray-600">{equipe?.name || "Mon équipe"}</p>
            <input
              type="number" min={0} inputMode="numeric" value={scoreUs}
              onChange={(e) => setScoreUs(e.target.value)}
              className="w-full border-2 border-gray-200/70 bg-white py-3 text-center font-display text-2xl font-black text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </div>
          <span className="pb-3 text-xl font-black text-gray-300">–</span>
          <div className="min-w-0 flex-1 text-center">
            <p className="mb-1.5 truncate text-xs font-bold text-gray-600">{advNom || "Adversaire"}</p>
            <input
              type="number" min={0} inputMode="numeric" value={scoreThem}
              onChange={(e) => setScoreThem(e.target.value)}
              className="w-full border-2 border-gray-200/70 bg-white py-3 text-center font-display text-2xl font-black text-gray-900 focus:border-gray-900 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Les buteurs */}
      {teamId && (
        <div className="mt-4 border border-gray-200/70 p-4">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Qui a marqué</p>
            <p className="text-[11px] text-gray-400">
              {butsSaisis} but{butsSaisis > 1 ? "s" : ""} attribué{butsSaisis > 1 ? "s" : ""}
              {Number.isFinite(nous) ? ` sur ${nous}` : ""}
            </p>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Facultatif. Seuls les joueurs nommés verront leur carrière bouger.
          </p>

          {effectif.length === 0 ? (
            <p className="text-sm italic text-gray-400">Cette équipe n&apos;a aucun joueur enregistré.</p>
          ) : (
            <ul className="space-y-2">
              {effectif.map((j) => {
                const v = saisie[j.id] ?? { buts: 0, passes: 0 };
                return (
                  <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-200/70 bg-gray-50/60 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{j.nom}</p>
                      <p className="text-[11px] text-gray-500">{j.detail}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {(["buts", "passes"] as const).map((champ) => (
                        <div key={champ} className="flex items-center gap-1">
                          <span className="w-10 text-[10px] font-black uppercase tracking-wide text-gray-400">
                            {champ === "buts" ? "Buts" : "Pass."}
                          </span>
                          <button
                            type="button" onClick={() => ajuster(j.id, champ, -1)}
                            disabled={v[champ] === 0}
                            className="flex h-7 w-7 items-center justify-center border border-gray-200/70 bg-white text-gray-500 disabled:opacity-30"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-5 text-center text-sm font-black tabular-nums text-gray-900">{v[champ]}</span>
                          <button
                            type="button" onClick={() => ajuster(j.id, champ, 1)}
                            className="flex h-7 w-7 items-center justify-center border border-gray-200/70 bg-white text-gray-500 hover:bg-gray-50"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
        <button
          onClick={() => setEtape("recap")}
          disabled={!saisieComplete}
          className="inline-flex items-center gap-2 bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          Relire avant de valider <ChevronRight size={16} />
        </button>
        <button
          onClick={onClose}
          className="border border-gray-200/70 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
