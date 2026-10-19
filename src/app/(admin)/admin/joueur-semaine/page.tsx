"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Clapperboard, Download, Eye, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  BOUTON_CONTOUR, BOUTON_VERT, Carte, Chargement, EnTete, Erreur, Pastille, Recherche, Titre, Vide, type Ton,
} from "@/components/admin/ui";
import type { EtatConsentement } from "@/lib/consentement-image";
import type { CompetitionDeLaSemaine, DossardEcarte, Semaine } from "@/lib/joueur-semaine";
import type { PartenaireDAffiche } from "@/lib/joueur-semaine-admin";
import type { CalqueVideo } from "@/lib/og-joueur-semaine";
import { fabriquerLaVideo, videoPossible } from "@/lib/video-joueur-semaine-client";

// ============================================
// Admin, le joueur de la semaine.
//
// Classer les joueurs d'une semaine (lundi–dimanche), en choisir un, et
// fabriquer son affiche (publication et vertical) et sa vidéo pour les
// réseaux. La page n'enregistre rien. Voir
// docs/superpowers/specs/2026-10-19-joueur-de-la-semaine-design.md.
//
// LA PHOTO NE SE CHOISIT PAS ICI : elle ne paraît que si son joueur l'a
// autorisée (lib/consentement-image) ; sinon, l'avatar. La page montre l'état
// du consentement de chacun, pour qu'on sache avant de générer.
// ============================================

interface CandidatResume {
  cle: string;
  nom: string;
  equipes: string[];
  matchs: number;
  buts: number;
  passes: number;
  note: number | null;
  hommeDuMatch: number;
  image: EtatConsentement;
}

interface Reponse {
  classement: {
    semaine: Semaine;
    competitions: CompetitionDeLaSemaine[];
    dossards: DossardEcarte[];
    candidats: CandidatResume[];
  };
  partenaires: PartenaireDAffiche[];
}

const IMAGE: Record<EtatConsentement, { ton: Ton; texte: string }> = {
  oui: { ton: "vert", texte: "Photo autorisée" },
  non: { ton: "rouge", texte: "Photo refusée" },
  aucun: { ton: "gris", texte: "Sans réponse" },
  mineur: { ton: "ambre", texte: "Mineur" },
};

const PREMIERS = 30;

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
/** « 12–18 oct. », ou « 29 sept.–5 oct. ». */
function periode(s: Semaine): string {
  const [, m1, j1] = s.lundi.split("-").map(Number);
  const [, m2, j2] = s.dimanche.split("-").map(Number);
  return m1 === m2 ? `${j1}–${j2} ${MOIS[m2 - 1]}` : `${j1} ${MOIS[m1 - 1]}–${j2} ${MOIS[m2 - 1]}`;
}

/** Un lundi, décalé de `semaines` semaines. */
function decaler(lundi: string, semaines: number): string {
  const d = new Date(`${lundi}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * semaines);
  return d.toISOString().slice(0, 10);
}

function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function AdminJoueurSemainePage() {
  const { firebaseUser } = useAuth();
  const [lundi, setLundi] = useState<string | null>(null);
  const [ecartees, setEcartees] = useState<string[]>([]);
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [partenaires, setPartenaires] = useState<string[]>([]);
  const [apercu, setApercu] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<null | "apercu" | "publication" | "vertical" | "video">(null);
  const [progres, setProgres] = useState(0);
  const [videoOk, setVideoOk] = useState<boolean | null>(null);

  useEffect(() => {
    videoPossible().then(setVideoOk).catch(() => setVideoOk(false));
  }, []);

  const appel = useCallback(async (chemin: string, corps?: unknown): Promise<Response> => {
    if (!firebaseUser) throw new Error("Session expirée");
    const jeton = await firebaseUser.getIdToken();
    const rep = await fetch(chemin, {
      method: corps ? "POST" : "GET",
      headers: { Authorization: `Bearer ${jeton}`, ...(corps ? { "Content-Type": "application/json" } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    if (!rep.ok) {
      const data = await rep.json().catch(() => ({}));
      throw new Error(data.error ?? "Erreur serveur");
    }
    return rep;
  }, [firebaseUser]);

  const charger = useCallback(async (voulu: string | null, sans: string[]) => {
    setChargement(true);
    setErreur(null);
    try {
      const params = new URLSearchParams();
      if (voulu) params.set("lundi", voulu);
      if (sans.length) params.set("ecartees", sans.join(","));
      const data = (await (await appel(`/api/admin/joueur-semaine?${params}`)).json()) as Reponse;
      setDonnees(data);
      setLundi(data.classement.semaine.lundi);
      const premier = data.classement.candidats[0] ?? null;
      setChoisi(premier?.cle ?? null);
      setNom(premier?.nom.toUpperCase() ?? "");
      setPartenaires(data.partenaires.slice(0, 2).map((p) => p.id));
      setApercu((ancien) => {
        if (ancien) URL.revokeObjectURL(ancien);
        return null;
      });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setChargement(false);
    }
  }, [appel]);

  useEffect(() => {
    if (firebaseUser) void charger(null, []);
    // Une seule fois à l'ouverture ; ensuite, chaque geste recharge lui-même.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  const changerDeSemaine = (sens: number) => {
    if (!lundi) return;
    setEcartees([]);
    void charger(decaler(lundi, sens), []);
  };

  const basculerCompetition = (id: string) => {
    const suivantes = ecartees.includes(id) ? ecartees.filter((x) => x !== id) : [...ecartees, id];
    setEcartees(suivantes);
    void charger(lundi, suivantes);
  };

  const candidats = useMemo(() => donnees?.classement.candidats ?? [], [donnees]);
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return q ? candidats.filter((c) => c.nom.toLowerCase().includes(q)) : candidats.slice(0, PREMIERS);
  }, [candidats, recherche]);
  const candidat = candidats.find((c) => c.cle === choisi) ?? null;

  const choisir = (c: CandidatResume) => {
    setChoisi(c.cle);
    setNom(c.nom.toUpperCase());
    setApercu((ancien) => {
      if (ancien) URL.revokeObjectURL(ancien);
      return null;
    });
  };

  const demande = (format?: "publication" | "vertical") => ({
    lundi, ecartees, cle: choisi, nom, partenaires, ...(format ? { format } : {}),
  });
  const numero = donnees?.classement.semaine.numero ?? 0;

  const voirApercu = async () => {
    setEnCours("apercu");
    try {
      const blob = await (await appel("/api/admin/joueur-semaine/affiche", demande("vertical"))).blob();
      setApercu((ancien) => {
        if (ancien) URL.revokeObjectURL(ancien);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aperçu impossible");
    } finally {
      setEnCours(null);
    }
  };

  const telechargerAffiche = async (format: "publication" | "vertical") => {
    setEnCours(format);
    try {
      const blob = await (await appel("/api/admin/joueur-semaine/affiche", demande(format))).blob();
      telecharger(blob, `joueur-semaine-${numero}-${format}.png`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Téléchargement impossible");
    } finally {
      setEnCours(null);
    }
  };

  const genererVideo = async () => {
    setEnCours("video");
    setProgres(0);
    try {
      const { calques } = (await (await appel("/api/admin/joueur-semaine/calques", demande())).json()) as { calques: CalqueVideo[] };
      const mp4 = await fabriquerLaVideo(calques, setProgres);
      telecharger(mp4, `joueur-semaine-${numero}.mp4`);
      toast.success("Vidéo prête");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "La vidéo n'a pas pu être fabriquée");
    } finally {
      setEnCours(null);
    }
  };

  const basculerPartenaire = (id: string) => {
    setPartenaires((liste) => (liste.includes(id) ? liste.filter((x) => x !== id) : liste.length >= 2 ? liste : [...liste, id]));
  };

  const semaine = donnees?.classement.semaine;
  const nomValide = nom.trim().length > 0 && nom.trim().length <= 40;

  return (
    <div className="space-y-6">
      <EnTete
        titre="Joueur de la semaine"
        sousTitre={semaine ? `Semaine ${semaine.numero} · ${periode(semaine)}` : "Le classement de la semaine, l'affiche et la vidéo"}
        actions={
          <div className="flex gap-2">
            <button type="button" className={BOUTON_CONTOUR} disabled={chargement || !lundi} onClick={() => changerDeSemaine(-1)}>
              <ChevronLeft size={16} /> Précédente
            </button>
            <button type="button" className={BOUTON_CONTOUR} disabled={chargement || !lundi} onClick={() => changerDeSemaine(1)}>
              Suivante <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      {erreur ? (
        <Erreur message={erreur} onReessayer={() => void charger(lundi, ecartees)} />
      ) : chargement && !donnees ? (
        <Chargement />
      ) : donnees ? (
        <>
          {/* Les compétitions de la semaine : on écarte celles dont la saisie n'est pas fiable. */}
          <Carte>
            <Titre compte={donnees.classement.competitions.length}>Compétitions de la semaine</Titre>
            {donnees.classement.competitions.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun match cette semaine.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {donnees.classement.competitions.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 border border-gray-200/70 px-3 py-2 text-sm">
                    <input type="checkbox" checked={!ecartees.includes(c.id)} disabled={chargement} onChange={() => basculerCompetition(c.id)} />
                    <span className="font-medium text-gray-900">{c.id === "friendly" ? "Matchs amicaux" : c.nom}</span>
                    <span className="text-gray-400">{c.matchs} match{c.matchs > 1 ? "s" : ""}</span>
                  </label>
                ))}
              </div>
            )}
          </Carte>

          {/* Le classement : les buts d'abord, puis les passes, la note, l'homme du match. */}
          <Carte>
            <Titre
              compte={candidats.length}
              action={<Recherche valeur={recherche} onChange={setRecherche} placeholder="Chercher un joueur" />}
            >
              Classement
            </Titre>
            {chargement ? (
              <Chargement />
            ) : candidats.length === 0 ? (
              <Vide titre="Aucun joueur" texte="Pas de match joué cette semaine, ou toutes les compétitions sont écartées." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200/70 text-left text-[11px] uppercase tracking-wide text-gray-400">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Joueur</th>
                      <th className="py-2 pr-3 text-right">Matchs</th>
                      <th className="py-2 pr-3 text-right">Buts</th>
                      <th className="py-2 pr-3 text-right">Passes</th>
                      <th className="py-2 pr-3 text-right">Note</th>
                      <th className="py-2 pr-3 text-right">HdM</th>
                      <th className="py-2">Image</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((c) => (
                      <tr
                        key={c.cle}
                        onClick={() => choisir(c)}
                        className={`cursor-pointer border-b border-gray-100 ${c.cle === choisi ? "bg-emerald-50" : "hover:bg-gray-50"}`}
                      >
                        <td className="py-2 pr-3 text-gray-400">{candidats.indexOf(c) + 1}</td>
                        <td className="py-2 pr-3">
                          <p className="font-semibold text-gray-900">{c.nom}</p>
                          <p className="text-xs text-gray-500">{c.equipes.join(" · ")}</p>
                        </td>
                        <td className="py-2 pr-3 text-right">{c.matchs}</td>
                        <td className="py-2 pr-3 text-right font-semibold">{c.buts}</td>
                        <td className="py-2 pr-3 text-right">{c.passes}</td>
                        <td className="py-2 pr-3 text-right">{c.note === null ? "–" : c.note.toLocaleString("fr-FR")}</td>
                        <td className="py-2 pr-3 text-right">{c.hommeDuMatch || "–"}</td>
                        <td className="py-2"><Pastille ton={IMAGE[c.image].ton}>{IMAGE[c.image].texte}</Pastille></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {donnees.classement.dossards.length > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-gray-500">
                {donnees.classement.dossards.length} joueur{donnees.classement.dossards.length > 1 ? "s" : ""} au dossard écarté
                {donnees.classement.dossards.length > 1 ? "s" : ""} : {donnees.classement.dossards.slice(0, 8)
                  .map((d) => `${d.nom} (${d.equipe}, ${d.buts} but${d.buts > 1 ? "s" : ""}${d.passes ? `, ${d.passes} passe${d.passes > 1 ? "s" : ""}` : ""})`)
                  .join(" · ")}
                {donnees.classement.dossards.length > 8 ? "…" : ""}. Les faire nommer par leur organisateur pour qu&apos;ils comptent.
              </p>
            )}
          </Carte>

          {/* L'affiche du joueur choisi. */}
          {candidat && (
            <Carte>
              <Titre>L&apos;affiche</Titre>
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Nom affiché</span>
                    <input
                      value={nom}
                      maxLength={40}
                      onChange={(e) => setNom(e.target.value)}
                      className="w-full border border-gray-200/70 px-3 py-2 text-sm font-semibold uppercase"
                    />
                  </label>
                  <div>
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Photo</span>
                    <p className="text-sm text-gray-600">
                      <Pastille ton={IMAGE[candidat.image].ton}>{IMAGE[candidat.image].texte}</Pastille>{" "}
                      {candidat.image === "oui"
                        ? "Sa photo paraît sur l'affiche."
                        : "Sans photo autorisée, l'affiche montre l'avatar."}
                    </p>
                  </div>
                  <div>
                    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Partenaires (deux au plus)</span>
                    {donnees.partenaires.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Aucun partenaire à l&apos;affiche sur l&apos;emplacement « Affiche Joueur de la semaine » : le pied ne montre que le logo.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {donnees.partenaires.map((p) => (
                          <label key={p.id} className="flex cursor-pointer items-center gap-2 border border-gray-200/70 px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              checked={partenaires.includes(p.id)}
                              disabled={!partenaires.includes(p.id) && partenaires.length >= 2}
                              onChange={() => basculerPartenaire(p.id)}
                            />
                            {p.annonceur}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button type="button" className={BOUTON_CONTOUR} disabled={!!enCours || !nomValide} onClick={() => void voirApercu()}>
                      {enCours === "apercu" ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Aperçu
                    </button>
                    <button type="button" className={BOUTON_VERT} disabled={!!enCours || !nomValide} onClick={() => void telechargerAffiche("publication")}>
                      {enCours === "publication" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Publication
                    </button>
                    <button type="button" className={BOUTON_VERT} disabled={!!enCours || !nomValide} onClick={() => void telechargerAffiche("vertical")}>
                      {enCours === "vertical" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Vertical
                    </button>
                    <button type="button" className={BOUTON_VERT} disabled={!!enCours || !nomValide || !videoOk} onClick={() => void genererVideo()}>
                      {enCours === "video" ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
                      {enCours === "video" ? `Vidéo ${Math.round(progres * 100)} %` : "Vidéo"}
                    </button>
                  </div>
                  {videoOk === false && (
                    <p className="text-xs text-amber-700">
                      Ce navigateur ne sait pas fabriquer la vidéo. Ouvre cette page dans Chrome ou Edge, sur ordinateur ; les affiches, elles, se téléchargent ici.
                    </p>
                  )}
                </div>
                <div className="flex aspect-[9/16] w-full items-center justify-center border border-gray-200/70 bg-gray-50">
                  {apercu ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={apercu} alt="Aperçu de l'affiche verticale" className="h-full w-full object-contain" />
                  ) : (
                    <p className="px-6 text-center text-xs text-gray-400">L&apos;aperçu du format vertical paraît ici.</p>
                  )}
                </div>
              </div>
            </Carte>
          )}
        </>
      ) : null}
    </div>
  );
}
