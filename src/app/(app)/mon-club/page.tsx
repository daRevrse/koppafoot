"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ExternalLink, Gem, Loader2, Moon, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { COULEUR_PAR_DEFAUT, MAX_SECTIONS, MAX_STAFF, SECTIONS_SUGGEREES, type MembreDuClub, type SectionPublique } from "@/lib/clubs";

// ============================================
// Mon club : le créer, le modifier, réunir ses équipes.
//
// Deux lecteurs. Le PROPRIÉTAIRE (KoppaFoot Pro) y gère son club : identité,
// encadrement, sections, invitations. Le MANAGER INVITÉ y trouve les
// invitations reçues par ses équipes, et décide. La notification d'une
// invitation mène ici.
//
// En sommeil, l'identité ne se modifie plus et rien ne s'ajoute ; retirer une
// section ou dissoudre le club reste possible : personne n'est retenu.
// ============================================

interface Invitation { equipeId: string; libelle: string; nomEquipe: string }
interface InvitationRecue { clubId: string; clubNom: string; clubSlug: string; equipeId: string; equipeNom: string; libelle: string }
interface MonEquipe { id: string; nom: string; logoUrl: string | null; club: { id: string; nom: string } | null }
interface MonClub {
  id: string; slug: string; nom: string; ville: string | null; description: string | null; slogan: string | null;
  logoUrl: string | null; banniereUrl: string | null; couleur: string; staff: MembreDuClub[];
  sections: SectionPublique[]; invitations: Invitation[]; enSommeil: boolean;
}
interface Donnees { estPro: boolean; club: MonClub | null; mesEquipes: MonEquipe[]; invitationsRecues: InvitationRecue[] }

const T = textes(
  {
    titre: "Club multi-équipes",
    sousTitre: "Réunis tes équipes sous un même club : seniors, jeunes, féminines, avec une seule page.",
    erreur: "Impossible de charger ton club.",
    invitationsRecues: "Invitations reçues",
    invite: (club: string, equipe: string, libelle: string) => `${club} propose à « ${equipe} » de devenir sa section ${libelle}.`,
    accepter: "Accepter",
    refuser: "Refuser",
    acceptee: "Ton équipe a rejoint le club",
    refusee: "Invitation refusée",
    proRequis: "Le Club multi-équipes fait partie de KoppaFoot Pro.",
    proRequisDetail: "Une page de club, l'encadrement commun, et toutes tes équipes réunies. Tes équipes, elles, restent gratuites.",
    voirOffre: "Voir mon offre",
    creerTitre: "Créer ton Club multi-équipes",
    nom: "Nom du club",
    ville: "Ville",
    creer: "Créer le club",
    cree: "Club créé",
    sommeil: "Ton club est en sommeil : ton KoppaFoot Pro s'est arrêté. Sa page ne s'affiche plus, rien n'est effacé. Il revit tel quel avec le Pro.",
    voirPage: "Voir la page du club",
    identite: "Identité",
    slogan: "Devise",
    description: "Présentation",
    couleur: "Couleur",
    logo: "Écusson",
    banniere: "Bannière",
    retirer: "Retirer",
    encadrement: "Encadrement",
    encadrementAide: "Président, directeur technique, entraîneurs : ceux qui font vivre le club.",
    nomPersonne: "Nom",
    role: "Rôle",
    ajouterPersonne: "Ajouter une personne",
    enregistrer: "Enregistrer",
    enregistre: "Club enregistré",
    sections: "Sections",
    sectionsAide: (max: number) => `Jusqu'à ${max} équipes. Chaque section garde sa fiche, son effectif et ses statistiques.`,
    aucuneSection: "Aucune section pour l'instant.",
    retirerSection: "Retirer du club",
    enAttente: "Invitation envoyée",
    annuler: "Annuler",
    ajouterMienne: "Ajouter une de mes équipes",
    choisir: "Choisis une équipe",
    libelle: "Nom de la section",
    ajouter: "Ajouter",
    inviterAutre: "Inviter l'équipe d'un autre manager",
    lienEquipe: "Adresse de la fiche de l'équipe",
    inviter: "Inviter",
    ajoutee: "Section ajoutée",
    invitee: "Invitation envoyée au manager",
    retiree: "Section retirée",
    dissoudre: "Dissoudre le club",
    dissoudreConfirm: "Dissoudre le club ? Ses équipes redeviennent autonomes, avec tout leur historique.",
    dissous: "Club dissous",
    autreClub: (club: string) => `déjà dans ${club}`,
    sortir: "Sortir du club",
    sortirConfirm: (equipe: string) => `Sortir « ${equipe} » du club ? Elle redevient une équipe autonome, avec tout son historique.`,
    mesEquipesDansClubs: "Mes équipes dans un club",
  },
  {
    titre: "Multi-team club",
    sousTitre: "Bring your teams together under one club: seniors, youth, women, with a single page.",
    erreur: "Couldn't load your club.",
    invitationsRecues: "Invitations received",
    invite: (club: string, equipe: string, libelle: string) => `${club} invites "${equipe}" to become its ${libelle} section.`,
    accepter: "Accept",
    refuser: "Decline",
    acceptee: "Your team joined the club",
    refusee: "Invitation declined",
    proRequis: "The multi-team club is part of KoppaFoot Pro.",
    proRequisDetail: "A club page, a shared staff, and all your teams together. Your teams themselves stay free.",
    voirOffre: "See my plan",
    creerTitre: "Create your multi-team club",
    nom: "Club name",
    ville: "City",
    creer: "Create the club",
    cree: "Club created",
    sommeil: "Your club is dormant: your KoppaFoot Pro ended. Its page is hidden, nothing is deleted. It comes back as it was with Pro.",
    voirPage: "See the club page",
    identite: "Identity",
    slogan: "Motto",
    description: "About",
    couleur: "Colour",
    logo: "Crest",
    banniere: "Banner",
    retirer: "Remove",
    encadrement: "Staff",
    encadrementAide: "President, technical director, coaches: the people who run the club.",
    nomPersonne: "Name",
    role: "Role",
    ajouterPersonne: "Add a person",
    enregistrer: "Save",
    enregistre: "Club saved",
    sections: "Sections",
    sectionsAide: (max: number) => `Up to ${max} teams. Each section keeps its page, squad and statistics.`,
    aucuneSection: "No section yet.",
    retirerSection: "Remove from club",
    enAttente: "Invitation sent",
    annuler: "Cancel",
    ajouterMienne: "Add one of my teams",
    choisir: "Pick a team",
    libelle: "Section name",
    ajouter: "Add",
    inviterAutre: "Invite another manager's team",
    lienEquipe: "Team page address",
    inviter: "Invite",
    ajoutee: "Section added",
    invitee: "Invitation sent to the manager",
    retiree: "Section removed",
    dissoudre: "Dissolve the club",
    dissoudreConfirm: "Dissolve the club? Its teams become independent again, with all their history.",
    dissous: "Club dissolved",
    autreClub: (club: string) => `already in ${club}`,
    sortir: "Leave the club",
    sortirConfirm: (equipe: string) => `Take "${equipe}" out of the club? It becomes an independent team again, with all its history.`,
    mesEquipesDansClubs: "My teams in a club",
  },
);

const ETIQUETTE = "mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-500";
const CHAMP = "w-full border border-gray-200/70 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400";
const BOUTON = "inline-flex items-center justify-center gap-1.5 border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] transition-colors disabled:opacity-50";
const PLEIN = `${BOUTON} border-gray-900 bg-gray-900 text-white hover:bg-gray-700`;
const CONTOUR = `${BOUTON} border-gray-200/70 bg-white text-gray-700 hover:border-gray-900`;
const CARTE = "border border-gray-200/70 bg-white p-4";
const TITRE = "mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400";

/** Le contenu d'un fichier en base64, sans le préfixe `data:…;base64,`. */
function enBase64(fichier: File): Promise<string> {
  return new Promise((ok, ko) => {
    const lecteur = new FileReader();
    lecteur.onload = () => ok(String(lecteur.result).split(",")[1] ?? "");
    lecteur.onerror = () => ko(lecteur.error);
    lecteur.readAsDataURL(fichier);
  });
}

export default function MonClubPage() {
  const t = useTextes(T);
  const { firebaseUser } = useAuth();
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState(false);
  const [occupe, setOccupe] = useState<string | null>(null);

  const appel = useCallback(async (url: string, method: string, corps?: unknown) => {
    if (!firebaseUser) throw new Error("Session expirée");
    const rep = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}`, ...(corps ? { "Content-Type": "application/json" } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok) throw new Error(data.error ?? "Erreur serveur");
    return data;
  }, [firebaseUser]);

  const charger = useCallback(async () => {
    try {
      setD(await appel("/api/clubs", "GET"));
    } catch {
      setErreur(true);
    }
  }, [appel]);

  useEffect(() => { if (firebaseUser) void charger(); }, [firebaseUser, charger]);

  /** Un geste : l'exécuter, dire ce qui s'est passé, relire. */
  const agir: Agir = async (cle, geste, succes) => {
    setOccupe(cle);
    try {
      const r = await geste();
      toast.success(typeof succes === "function" ? succes(r) : succes);
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setOccupe(null);
    }
  };

  if (erreur) return <p className="mx-auto max-w-2xl py-16 text-center text-sm text-gray-500">{t.erreur}</p>;
  if (!d) return <div className="mx-auto mt-6 h-64 max-w-2xl animate-pulse bg-gray-100" />;

  const equipesDansUnAutreClub = d.mesEquipes.filter((e) => e.club && e.club.id !== d.club?.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-gray-900 sm:text-3xl">{t.titre}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.sousTitre}</p>
      </div>

      {d.invitationsRecues.length > 0 && (
        <section>
          <h2 className={TITRE}>{t.invitationsRecues}</h2>
          <div className="space-y-2">
            {d.invitationsRecues.map((inv) => (
              <div key={`${inv.clubId}-${inv.equipeId}`} className={`${CARTE} flex flex-col gap-3 sm:flex-row sm:items-center`}>
                <p className="min-w-0 flex-1 text-sm text-gray-700">
                  {t.invite(inv.clubNom, inv.equipeNom, inv.libelle)}{" "}
                  <Link href={`/clubs/${inv.clubSlug}`} className="font-bold text-emerald-700 hover:underline">{t.voirPage}</Link>
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={occupe !== null}
                    onClick={() => void agir(`acc-${inv.equipeId}`, () => appel(`/api/clubs/${inv.clubId}/sections`, "PATCH", { equipeId: inv.equipeId }), t.acceptee)}
                    className={PLEIN}
                  >
                    {occupe === `acc-${inv.equipeId}` && <Loader2 size={13} className="animate-spin" />}
                    {t.accepter}
                  </button>
                  <button
                    disabled={occupe !== null}
                    onClick={() => void agir(`ref-${inv.equipeId}`, () => appel(`/api/clubs/${inv.clubId}/sections`, "DELETE", { equipeId: inv.equipeId }), t.refusee)}
                    className={CONTOUR}
                  >
                    {t.refuser}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {d.club ? (
        <GestionDuClub
          club={d.club}
          mesEquipes={d.mesEquipes}
          occupe={occupe}
          agir={agir}
          appel={appel}
        />
      ) : d.estPro ? (
        <CreationDuClub occupe={occupe} agir={agir} appel={appel} />
      ) : (
        <section className={`${CARTE} space-y-2`}>
          <p className="flex items-center gap-2 font-display text-lg font-black text-gray-900">
            <Gem size={18} className="text-emerald-600" /> {t.proRequis}
          </p>
          <p className="text-sm text-gray-600">{t.proRequisDetail}</p>
          <Link href="/offre" className={`${PLEIN} mt-2`}>{t.voirOffre}</Link>
        </section>
      )}

      {equipesDansUnAutreClub.length > 0 && (
        <section>
          <h2 className={TITRE}>{t.mesEquipesDansClubs}</h2>
          <div className="divide-y divide-gray-100 border border-gray-200/70 bg-white">
            {equipesDansUnAutreClub.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 truncate text-sm text-gray-800">
                  <strong>{e.nom}</strong> · {e.club!.nom}
                </span>
                <button
                  disabled={occupe !== null}
                  onClick={() => {
                    if (!window.confirm(t.sortirConfirm(e.nom))) return;
                    void agir(`sortir-${e.id}`, () => appel(`/api/clubs/${e.club!.id}/sections`, "DELETE", { equipeId: e.id }), t.retiree);
                  }}
                  className={CONTOUR}
                >
                  {t.sortir}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type Agir = (cle: string, geste: () => Promise<unknown>, succes: string | ((reponse: unknown) => string)) => Promise<void>;
type Appel = (url: string, method: string, corps?: unknown) => Promise<unknown>;

function CreationDuClub({ occupe, agir, appel }: { occupe: string | null; agir: Agir; appel: Appel }) {
  const t = useTextes(T);
  const [nom, setNom] = useState("");
  const [ville, setVille] = useState("");
  const [couleur, setCouleur] = useState(COULEUR_PAR_DEFAUT);
  return (
    <section className={`${CARTE} space-y-4`}>
      <h2 className="font-display text-lg font-black text-gray-900">{t.creerTitre}</h2>
      <label className="block">
        <span className={ETIQUETTE}>{t.nom}</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} className={CHAMP} placeholder="Étoile de Bè" />
      </label>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="block">
          <span className={ETIQUETTE}>{t.ville}</span>
          <input value={ville} onChange={(e) => setVille(e.target.value)} maxLength={80} className={CHAMP} placeholder="Lomé" />
        </label>
        <label className="block">
          <span className={ETIQUETTE}>{t.couleur}</span>
          <input type="color" value={couleur} onChange={(e) => setCouleur(e.target.value)} className="h-[38px] w-16 border border-gray-200/70 bg-white" />
        </label>
      </div>
      <button
        disabled={!nom.trim() || occupe !== null}
        onClick={() => void agir("creer", () => appel("/api/clubs", "POST", { nom, ville, couleur }), t.cree)}
        className={PLEIN}
      >
        {occupe === "creer" && <Loader2 size={13} className="animate-spin" />}
        {t.creer}
      </button>
    </section>
  );
}

function GestionDuClub({ club, mesEquipes, occupe, agir, appel }: {
  club: MonClub; mesEquipes: MonEquipe[]; occupe: string | null; agir: Agir; appel: Appel;
}) {
  const t = useTextes(T);
  const fige = club.enSommeil;
  const [form, setForm] = useState({
    nom: club.nom, ville: club.ville ?? "", slogan: club.slogan ?? "", description: club.description ?? "",
    couleur: club.couleur, staff: club.staff,
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [banniere, setBanniere] = useState<File | null>(null);
  const [retraits, setRetraits] = useState({ logo: false, banniere: false });
  // L'aperçu d'un fichier choisi : une adresse locale, créée une fois et rendue ensuite.
  const apercuLogo = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  const apercuBanniere = useMemo(() => (banniere ? URL.createObjectURL(banniere) : null), [banniere]);
  useEffect(() => () => { if (apercuLogo) URL.revokeObjectURL(apercuLogo); }, [apercuLogo]);
  useEffect(() => () => { if (apercuBanniere) URL.revokeObjectURL(apercuBanniere); }, [apercuBanniere]);
  const [mienne, setMienne] = useState({ equipe: "", libelle: "" });
  const [autre, setAutre] = useState({ equipe: "", libelle: "" });

  const libres = mesEquipes.filter((e) => !e.club);
  const plein = club.sections.length + club.invitations.length >= MAX_SECTIONS;

  const enregistrer = () => agir("identite", async () => {
    await appel(`/api/clubs/${club.id}`, "PATCH", {
      ...form,
      logo: logo ? { data: await enBase64(logo), contentType: logo.type } : null,
      banniere: banniere ? { data: await enBase64(banniere), contentType: banniere.type } : null,
      retirerLogo: retraits.logo,
      retirerBanniere: retraits.banniere,
    });
    setLogo(null);
    setBanniere(null);
    setRetraits({ logo: false, banniere: false });
  }, t.enregistre);

  const retirerSection = (equipeId: string) =>
    agir(`ret-${equipeId}`, () => appel(`/api/clubs/${club.id}/sections`, "DELETE", { equipeId }), t.retiree);

  const visuel = (champ: "logo" | "banniere", fichier: File | null, setFichier: (f: File | null) => void, actuel: string | null, apercu: string | null) => (
    <div>
      <span className={ETIQUETTE}>{champ === "logo" ? t.logo : t.banniere}</span>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`relative flex shrink-0 items-center justify-center overflow-hidden border border-gray-200/70 bg-gray-50 ${champ === "logo" ? "h-14 w-14" : "h-14 w-28"}`}>
          {(fichier || (actuel && !retraits[champ])) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={apercu ?? actuel!} alt="" className="h-full w-full object-cover" />
          )}
        </span>
        <input type="file" accept="image/*" disabled={fige} className="min-w-0 text-xs"
          onChange={(e) => { setFichier(e.target.files?.[0] ?? null); setRetraits({ ...retraits, [champ]: false }); }} />
        {(actuel || fichier) && !retraits[champ] && !fige && (
          <button type="button" onClick={() => { setFichier(null); setRetraits({ ...retraits, [champ]: true }); }}
            className="text-[11px] font-bold text-red-600 hover:underline">
            {t.retirer}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {fige && (
        <p className="flex gap-2 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Moon size={16} className="mt-0.5 shrink-0" />
          <span>{t.sommeil} <Link href="/offre" className="font-bold underline">{t.voirOffre}</Link></span>
        </p>
      )}
      <Link href={`/clubs/${club.slug}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:underline">
        {t.voirPage} <ExternalLink size={13} />
      </Link>

      <section>
        <h2 className={TITRE}>{t.sections}</h2>
        <div className={`${CARTE} space-y-4`}>
          <p className="text-xs text-gray-500">{t.sectionsAide(MAX_SECTIONS)}</p>
          {club.sections.length === 0 && club.invitations.length === 0 ? (
            <p className="text-sm text-gray-500">{t.aucuneSection}</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100">
              {club.sections.map((s) => (
                <li key={s.equipeId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0 truncate text-sm">
                    <span className="mr-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">{s.libelle}</span>
                    <Link href={`/teams/${s.equipeId}`} className="font-bold text-gray-900 hover:underline">{s.nom}</Link>
                  </span>
                  <button disabled={occupe !== null} onClick={() => void retirerSection(s.equipeId)}
                    aria-label={t.retirerSection} title={t.retirerSection} className="text-gray-400 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
              {club.invitations.map((inv) => (
                <li key={inv.equipeId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0 truncate text-sm text-gray-500">
                    <span className="mr-2 text-[10px] font-black uppercase tracking-[0.14em]">{inv.libelle}</span>
                    {inv.nomEquipe} · <em>{t.enAttente}</em>
                  </span>
                  <button disabled={occupe !== null} onClick={() => void retirerSection(inv.equipeId)} className="text-xs font-bold text-gray-500 hover:text-red-600">
                    {t.annuler}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!fige && !plein && (
            <>
              <datalist id="sections-suggerees">
                {SECTIONS_SUGGEREES.map((s) => <option key={s} value={s} />)}
              </datalist>
              {libres.length > 0 && (
                <div>
                  <span className={ETIQUETTE}>{t.ajouterMienne}</span>
                  <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                    <select value={mienne.equipe} onChange={(e) => setMienne({ ...mienne, equipe: e.target.value })} className={CHAMP}>
                      <option value="">{t.choisir}</option>
                      {libres.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                    </select>
                    <input list="sections-suggerees" value={mienne.libelle} placeholder={t.libelle} maxLength={30}
                      onChange={(e) => setMienne({ ...mienne, libelle: e.target.value })} className={CHAMP} />
                    <button
                      disabled={!mienne.equipe || !mienne.libelle.trim() || occupe !== null}
                      onClick={() => void agir("mienne", async () => {
                        await appel(`/api/clubs/${club.id}/sections`, "POST", mienne);
                        setMienne({ equipe: "", libelle: "" });
                      }, t.ajoutee)}
                      className={PLEIN}
                    >
                      <Plus size={13} /> {t.ajouter}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <span className={ETIQUETTE}>{t.inviterAutre}</span>
                <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                  <input value={autre.equipe} placeholder={t.lienEquipe}
                    onChange={(e) => setAutre({ ...autre, equipe: e.target.value })} className={CHAMP} />
                  <input list="sections-suggerees" value={autre.libelle} placeholder={t.libelle} maxLength={30}
                    onChange={(e) => setAutre({ ...autre, libelle: e.target.value })} className={CHAMP} />
                  <button
                    disabled={!autre.equipe.trim() || !autre.libelle.trim() || occupe !== null}
                    onClick={() => void agir("autre", async () => {
                      const r = await appel(`/api/clubs/${club.id}/sections`, "POST", autre);
                      setAutre({ equipe: "", libelle: "" });
                      return r;
                    }, (r) => ((r as { etat?: string }).etat === "section" ? t.ajoutee : t.invitee))}
                    className={CONTOUR}
                  >
                    {t.inviter}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className={TITRE}>{t.identite}</h2>
        <div className={`${CARTE} space-y-4`}>
          <label className="block">
            <span className={ETIQUETTE}>{t.nom}</span>
            <input value={form.nom} disabled={fige} maxLength={80} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={CHAMP} />
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="block">
              <span className={ETIQUETTE}>{t.ville}</span>
              <input value={form.ville} disabled={fige} maxLength={80} onChange={(e) => setForm({ ...form, ville: e.target.value })} className={CHAMP} />
            </label>
            <label className="block">
              <span className={ETIQUETTE}>{t.couleur}</span>
              <input type="color" value={form.couleur} disabled={fige} onChange={(e) => setForm({ ...form, couleur: e.target.value })}
                className="h-[38px] w-16 border border-gray-200/70 bg-white" />
            </label>
          </div>
          <label className="block">
            <span className={ETIQUETTE}>{t.slogan}</span>
            <input value={form.slogan} disabled={fige} maxLength={80} onChange={(e) => setForm({ ...form, slogan: e.target.value })} className={CHAMP} />
          </label>
          <label className="block">
            <span className={ETIQUETTE}>{t.description}</span>
            <textarea value={form.description} disabled={fige} maxLength={600} rows={4}
              onChange={(e) => setForm({ ...form, description: e.target.value })} className={CHAMP} />
          </label>
          {visuel("logo", logo, setLogo, club.logoUrl, apercuLogo)}
          {visuel("banniere", banniere, setBanniere, club.banniereUrl, apercuBanniere)}

          <div>
            <span className={ETIQUETTE}>{t.encadrement}</span>
            <p className="mb-2 text-xs text-gray-500">{t.encadrementAide}</p>
            <div className="space-y-2">
              {form.staff.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input value={m.nom} disabled={fige} placeholder={t.nomPersonne} maxLength={60} className={CHAMP}
                    onChange={(e) => setForm({ ...form, staff: form.staff.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)) })} />
                  <input value={m.titre} disabled={fige} placeholder={t.role} maxLength={40} className={CHAMP}
                    onChange={(e) => setForm({ ...form, staff: form.staff.map((x, j) => (j === i ? { ...x, titre: e.target.value } : x)) })} />
                  <button type="button" disabled={fige} aria-label={t.retirer} className="px-2 text-gray-400 hover:text-red-600"
                    onClick={() => setForm({ ...form, staff: form.staff.filter((_, j) => j !== i) })}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {!fige && form.staff.length < MAX_STAFF && (
                <button type="button" onClick={() => setForm({ ...form, staff: [...form.staff, { nom: "", titre: "" }] })}
                  className="text-xs font-bold text-emerald-700 hover:underline">
                  + {t.ajouterPersonne}
                </button>
              )}
            </div>
          </div>

          {!fige && (
            <button disabled={!form.nom.trim() || occupe !== null} onClick={() => void enregistrer()} className={PLEIN}>
              {occupe === "identite" && <Loader2 size={13} className="animate-spin" />}
              {t.enregistrer}
            </button>
          )}
        </div>
      </section>

      <button
        disabled={occupe !== null}
        onClick={() => {
          if (!window.confirm(t.dissoudreConfirm)) return;
          void agir("dissoudre", () => appel(`/api/clubs/${club.id}`, "DELETE"), t.dissous);
        }}
        className="text-xs font-bold text-red-600 hover:underline"
      >
        {t.dissoudre}
      </button>
    </>
  );
}
