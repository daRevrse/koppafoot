"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { Handshake, Loader2, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  BOUTON_CONTOUR, BOUTON_VERT, Carte, Chargement, Chiffre, EnTete, Erreur, MenuActions, Modale, Pastille, Vide,
  type Ton,
} from "@/components/admin/ui";
import {
  BANNIERE_CONSEILLEE, EMPLACEMENTS, FORMATS, LIBELLE_EMPLACEMENT, LIBELLE_FORMAT, VERTICALE_CONSEILLEE, aLAffiche, avisBanniere,
  avisVerticale, jourDeLome,
  type EmplacementPartenaire, type FormatPartenaire,
} from "@/lib/partenaires";

// ============================================
// Admin, les partenaires.
//
// Les marques vendues en direct : leur visuel (un logo ou une bannière),
// leurs emplacements, leur période, et ce qu'on leur rend en fin de campagne,
// les vues et les clics.
// Tout passe par /api/admin/partenaires ; la collection est fermée aux
// navigateurs.
//
// Ce que cet écran NE PERMET PAS, volontairement : choisir un emplacement
// hors de la liste (console, notifications, paiements, fiches de joueurs en
// sont exclus, voir lib/partenaires).
// ============================================

interface Partenaire {
  id: string;
  annonceur: string;
  accroche: string | null;
  format: FormatPartenaire;
  imageUrl: string | null;
  imageVerticaleUrl: string | null;
  lien: string | null;
  emplacements: EmplacementPartenaire[];
  competitionId: string | null;
  competitionNom: string | null;
  debut: string;
  fin: string;
  actif: boolean;
  vues: number;
  clics: number;
}

interface Formulaire {
  id: string | null;
  annonceur: string;
  accroche: string;
  format: FormatPartenaire;
  lien: string;
  emplacements: EmplacementPartenaire[];
  competition: string;
  /** Le nom de la compétition enregistrée, pour qu'on la reconnaisse sous son identifiant. */
  competitionNom: string | null;
  debut: string;
  fin: string;
  actif: boolean;
  imageUrl: string | null;
  fichier: File | null;
  apercu: string | null;
  retirerImage: boolean;
  /** Le visuel vertical d'une bannière (1:2), facultatif : le rail de droite du Direct. */
  imageVerticaleUrl: string | null;
  fichierVerticale: File | null;
  apercuVerticale: string | null;
  retirerImageVerticale: boolean;
}

/** Dans un mois, jour pour jour : la durée par défaut d'une campagne. */
function dansUnMois(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

const VIDE: Formulaire = {
  id: null, annonceur: "", accroche: "", format: "logo", lien: "", emplacements: ["competition"], competition: "", competitionNom: null,
  debut: "", fin: "", actif: true, imageUrl: null, fichier: null, apercu: null, retirerImage: false,
  imageVerticaleUrl: null, fichierVerticale: null, apercuVerticale: null, retirerImageVerticale: false,
};

/** Retire le préfixe `data:<type>;base64,` : la route attend la charge seule. */
function enBase64(fichier: File): Promise<string> {
  return new Promise((ok, ko) => {
    const lecteur = new FileReader();
    lecteur.onload = () => ok(String(lecteur.result).split(",")[1] ?? "");
    lecteur.onerror = () => ko(lecteur.error);
    lecteur.readAsDataURL(fichier);
  });
}

function jourCourt(jour: string): string {
  const d = new Date(`${jour}T00:00:00`);
  return Number.isNaN(d.getTime()) ? jour : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function statut(p: Partenaire, jour: string): { ton: Ton; label: string } {
  if (!p.actif) return { ton: "ambre", label: "Désactivé" };
  if (aLAffiche(p, jour)) return { ton: "vert", label: "À l'affiche" };
  if (jour < p.debut) return { ton: "bleu", label: "À venir" };
  return { ton: "gris", label: "Terminé" };
}

const nombre = (n: number) => n.toLocaleString("fr-FR");

export default function AdminPartenairesPage() {
  const { firebaseUser } = useAuth();
  const [liste, setListe] = useState<Partenaire[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [form, setForm] = useState<Formulaire | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const jour = jourDeLome();

  const appel = useCallback(async (method: string, corps?: unknown) => {
    if (!firebaseUser) throw new Error("Session expirée");
    const jeton = await firebaseUser.getIdToken();
    const rep = await fetch("/api/admin/partenaires", {
      method,
      headers: { Authorization: `Bearer ${jeton}`, ...(corps ? { "Content-Type": "application/json" } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const data = await rep.json().catch(() => ({}));
    if (!rep.ok) throw new Error(data.error ?? "Erreur serveur");
    return data;
  }, [firebaseUser]);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      const data = await appel("GET");
      setListe(data.partenaires ?? []);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible");
    }
  }, [appel]);

  useEffect(() => { void charger(); }, [charger]);

  const chiffres = useMemo(() => {
    const l = liste ?? [];
    return {
      aLAffiche: l.filter((p) => aLAffiche(p, jour)).length,
      vues: l.reduce((s, p) => s + p.vues, 0),
      clics: l.reduce((s, p) => s + p.clics, 0),
    };
  }, [liste, jour]);

  const ouvrir = (p?: Partenaire) => {
    setForm(p ? {
      ...VIDE,
      id: p.id, annonceur: p.annonceur, accroche: p.accroche ?? "", format: p.format, lien: p.lien ?? "",
      emplacements: p.emplacements, competition: p.competitionId ?? "", competitionNom: p.competitionNom, debut: p.debut, fin: p.fin,
      actif: p.actif, imageUrl: p.imageUrl, imageVerticaleUrl: p.imageVerticaleUrl,
    } : { ...VIDE, debut: jour, fin: dansUnMois() });
  };

  const enregistrer = async () => {
    if (!form) return;
    setEnvoi(true);
    try {
      const corps = {
        ...(form.id ? { id: form.id } : {}),
        annonceur: form.annonceur,
        accroche: form.accroche,
        format: form.format,
        lien: form.lien,
        emplacements: form.emplacements,
        competition: form.competition,
        debut: form.debut,
        fin: form.fin,
        actif: form.actif,
        image: form.fichier ? { data: await enBase64(form.fichier), contentType: form.fichier.type } : null,
        retirerImage: form.retirerImage,
        imageVerticale: form.format === "banniere" && form.fichierVerticale
          ? { data: await enBase64(form.fichierVerticale), contentType: form.fichierVerticale.type }
          : null,
        retirerImageVerticale: form.retirerImageVerticale,
      };
      await appel(form.id ? "PATCH" : "POST", corps);
      toast.success(form.id ? "Partenaire mis à jour" : "Partenaire créé");
      setForm(null);
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setEnvoi(false);
    }
  };

  const basculer = async (p: Partenaire) => {
    try {
      await appel("PATCH", { id: p.id, actif: !p.actif });
      toast.success(p.actif ? "Partenaire désactivé" : "Partenaire réactivé");
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Modification impossible");
    }
  };

  const supprimer = async (p: Partenaire) => {
    if (!window.confirm(`Supprimer « ${p.annonceur} » et ses compteurs ? C'est définitif.`)) return;
    try {
      await appel("DELETE", { id: p.id });
      toast.success("Partenaire supprimé");
      await charger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible");
    }
  };

  return (
    <div className="space-y-6">
      <EnTete
        titre="Partenaires"
        sousTitre="Les marques affichées sur les compétitions, les fiches de match et l'accueil, toujours signalées « Partenaire »."
        actions={
          <button onClick={() => ouvrir()} className={BOUTON_VERT}>
            <Plus size={14} /> Nouveau partenaire
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-px border border-gray-200/70 bg-gray-200/70">
        <Chiffre valeur={chiffres.aLAffiche} libelle="À l'affiche aujourd'hui" />
        <Chiffre valeur={nombre(chiffres.vues)} libelle="Vues" />
        <Chiffre valeur={nombre(chiffres.clics)} libelle="Clics" />
      </div>

      {erreur && <Erreur message={erreur} onReessayer={charger} />}
      {!liste && !erreur && <Chargement />}
      {liste && liste.length === 0 && (
        <Vide
          titre="Aucun partenaire pour l'instant"
          texte="Crée le premier : une marque, son visuel, ses emplacements et sa période d'affichage."
        />
      )}

      {liste && liste.length > 0 && (
        <Carte className="divide-y divide-gray-200/70">
          {liste.map((p) => {
            const s = statut(p, jour);
            const taux = p.vues ? `${((p.clics / p.vues) * 100).toFixed(1).replace(".", ",")} %` : "–";
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <span className="relative flex h-12 w-20 shrink-0 items-center justify-center bg-gray-50">
                  {p.imageUrl ? (
                    p.format === "banniere" ? (
                      // La bannière telle qu'elle paraît : en 4:1, recadrée au centre.
                      <span className="relative block aspect-[4/1] w-full">
                        <Image src={p.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                      </span>
                    ) : (
                      <Image src={p.imageUrl} alt="" fill sizes="80px" className="object-contain p-1" />
                    )
                  ) : (
                    <Handshake size={18} className="text-gray-300" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-gray-900">{p.annonceur}</span>
                    <Pastille ton={s.ton}>{s.label}</Pastille>
                    {p.format === "banniere" && <Pastille ton="gris">{LIBELLE_FORMAT.banniere}</Pastille>}
                    {p.format === "banniere" && p.imageVerticaleUrl && <Pastille ton="gris">+ vertical</Pastille>}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {p.emplacements.map((e) => LIBELLE_EMPLACEMENT[e]).join(" · ")}
                    {" · "}
                    {p.competitionNom ? `Seulement : ${p.competitionNom}` : "Toutes les compétitions"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    Du {jourCourt(p.debut)} au {jourCourt(p.fin)}
                  </p>
                </div>
                <div className="flex gap-5 text-right text-xs">
                  <p><span className="block font-display text-lg font-black tabular-nums text-gray-900">{nombre(p.vues)}</span>vues</p>
                  <p><span className="block font-display text-lg font-black tabular-nums text-gray-900">{nombre(p.clics)}</span>clics</p>
                  <p><span className="block font-display text-lg font-black tabular-nums text-gray-900">{taux}</span>taux</p>
                </div>
                <MenuActions
                  actions={[
                    { label: "Modifier", onClick: () => ouvrir(p) },
                    { label: p.actif ? "Désactiver" : "Réactiver", onClick: () => void basculer(p) },
                    { label: "Supprimer", onClick: () => void supprimer(p), danger: true },
                  ]}
                />
              </div>
            );
          })}
        </Carte>
      )}

      {form && (
        <Modale titre={form.id ? "Modifier le partenaire" : "Nouveau partenaire"} onFermer={() => setForm(null)} largeur="max-w-lg">
          <FormulairePartenaire form={form} setForm={setForm} />
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setForm(null)} className={BOUTON_CONTOUR}>Annuler</button>
            <button onClick={() => void enregistrer()} disabled={envoi} className={BOUTON_VERT}>
              {envoi && <Loader2 size={14} className="animate-spin" />}
              Enregistrer
            </button>
          </div>
        </Modale>
      )}
    </div>
  );
}

const ETIQUETTE = "mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-gray-500";
const CHAMP = "w-full border border-gray-200/70 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";

function FormulairePartenaire({ form, setForm }: {
  form: Formulaire;
  setForm: (f: Formulaire) => void;
}) {
  const maj = (patch: Partial<Formulaire>) => setForm({ ...form, ...patch });
  const basculerEmplacement = (e: EmplacementPartenaire) =>
    maj({ emplacements: form.emplacements.includes(e) ? form.emplacements.filter((x) => x !== e) : [...form.emplacements, e] });
  const visuel = form.apercu ?? (form.retirerImage ? null : form.imageUrl);

  // Les dimensions réelles de l'image affichée, lues à son chargement : un
  // fichier qu'on vient de choisir comme le visuel déjà enregistré (un logo
  // qu'on voudrait passer en bannière, par exemple).
  const [dimensions, setDimensions] = useState<{ src: string; largeur: number; hauteur: number } | null>(null);
  const mesurer = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (visuel) setDimensions({ src: visuel, largeur: img.naturalWidth, hauteur: img.naturalHeight });
  };
  const avis = form.format === "banniere" && visuel && dimensions?.src === visuel
    ? avisBanniere(dimensions.largeur, dimensions.hauteur)
    : null;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={ETIQUETTE}>Annonceur</span>
        <input value={form.annonceur} onChange={(e) => maj({ annonceur: e.target.value })} maxLength={80}
          placeholder="Brasserie du Golfe" className={CHAMP} />
      </label>
      <label className="block">
        <span className={ETIQUETTE}>Accroche (facultative)</span>
        <input value={form.accroche} onChange={(e) => maj({ accroche: e.target.value })} maxLength={120}
          placeholder="Fière partenaire du foot de quartier" className={CHAMP} />
        {form.format === "banniere" && (
          <span className="mt-1 block text-[11px] text-gray-400">
            Sur une bannière, elle n&apos;est pas affichée : l&apos;image porte déjà son message. Elle est lue par les lecteurs d&apos;écran.
          </span>
        )}
      </label>
      <label className="block">
        <span className={ETIQUETTE}>Lien (facultatif, https)</span>
        <input value={form.lien} onChange={(e) => maj({ lien: e.target.value })} placeholder="https://…" className={CHAMP} />
      </label>

      <div>
        <span className={ETIQUETTE}>Format</span>
        <div role="radiogroup" aria-label="Format" className="grid grid-cols-2 gap-2">
          {FORMATS.map((f) => {
            const choisi = form.format === f;
            return (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={choisi}
                onClick={() => maj({ format: f })}
                className={`border px-3 py-2 text-left transition-colors ${
                  choisi ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200/70 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                <span className="block text-sm font-black">{LIBELLE_FORMAT[f]}</span>
                <span className={`mt-0.5 block text-[11px] leading-snug ${choisi ? "text-gray-300" : "text-gray-400"}`}>
                  {f === "logo"
                    ? "Le logo en vignette, le nom et l'accroche à côté."
                    : "Une image pleine largeur, en 4:1, faite par la marque."}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {form.format === "banniere" ? (
          <>
            <span className={ETIQUETTE}>
              Bannière ({BANNIERE_CONSEILLEE.largeur} × {BANNIERE_CONSEILLEE.hauteur} px conseillés, 2 Mo au plus)
            </span>
            {/* L'aperçu dans les proportions exactes de l'affichage : ce qui
                dépasse ici sera coupé sur le site. */}
            <span className="relative mb-2 flex aspect-[4/1] w-full items-center justify-center overflow-hidden border border-gray-200/70 bg-gray-50">
              {visuel ? (
                // L'aperçu d'un fichier local est une adresse blob:, que next/image ne sert pas.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={visuel} src={visuel} alt="" onLoad={mesurer} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-gray-400">Aucune image : une bannière en a besoin</span>
              )}
            </span>
          </>
        ) : (
          <span className={ETIQUETTE}>Logo (2 Mo au plus)</span>
        )}
        <div className="flex items-center gap-3">
          {form.format === "logo" && (
            <span className="relative flex h-14 w-28 shrink-0 items-center justify-center border border-gray-200/70 bg-gray-50">
              {visuel ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={visuel} src={visuel} alt="" onLoad={mesurer} className="max-h-full max-w-full object-contain p-1" />
              ) : (
                <Handshake size={18} className="text-gray-300" />
              )}
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              maj({ fichier: f, apercu: f ? URL.createObjectURL(f) : null, retirerImage: false });
            }}
            className="min-w-0 text-xs"
          />
        </div>
        {avis && <p className="mt-1.5 text-[11px] font-semibold leading-snug text-amber-700">{avis}</p>}
        {(form.imageUrl || form.fichier) && !form.retirerImage && (
          <button type="button" onClick={() => maj({ fichier: null, apercu: null, retirerImage: true })}
            className="mt-1 text-[11px] font-bold text-red-600 hover:underline">
            Retirer le visuel
          </button>
        )}
      </div>

      {form.format === "banniere" && <VisuelVertical form={form} maj={maj} />}

      <div>
        <span className={ETIQUETTE}>Emplacements</span>
        <div className="space-y-1.5">
          {EMPLACEMENTS.map((e) => (
            <label key={e} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.emplacements.includes(e)} onChange={() => basculerEmplacement(e)} />
              {LIBELLE_EMPLACEMENT[e]}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          Jamais dans la console, les notifications, les paiements ni les fiches de joueurs.
        </p>
      </div>

      <label className="block">
        <span className={ETIQUETTE}>Compétition (facultatif)</span>
        <input value={form.competition} onChange={(e) => maj({ competition: e.target.value, competitionNom: null })}
          placeholder="Adresse de la compétition ou son identifiant" className={CHAMP} />
        {form.competitionNom && (
          <span className="mt-1 block text-xs font-semibold text-gray-700">{form.competitionNom}</span>
        )}
        <span className="mt-1 block text-[11px] text-gray-400">
          Vide : le partenaire paraît partout. Remplie : seulement sur cette compétition et ses matchs, en priorité.
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={ETIQUETTE}>Début</span>
          <input type="date" value={form.debut} onChange={(e) => maj({ debut: e.target.value })} className={CHAMP} />
        </label>
        <label className="block">
          <span className={ETIQUETTE}>Fin (incluse)</span>
          <input type="date" value={form.fin} onChange={(e) => maj({ fin: e.target.value })} className={CHAMP} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.actif} onChange={(e) => maj({ actif: e.target.checked })} />
        Actif (décoché : jamais affiché, quelles que soient les dates)
      </label>
    </div>
  );
}

/**
 * Le visuel vertical d'une bannière, 1:2, facultatif : le rail de droite du
 * Direct sur grand écran. Sans lui, le rail montre la bannière 4:1.
 */
function VisuelVertical({ form, maj }: { form: Formulaire; maj: (patch: Partial<Formulaire>) => void }) {
  const visuel = form.apercuVerticale ?? (form.retirerImageVerticale ? null : form.imageVerticaleUrl);
  const [dimensions, setDimensions] = useState<{ src: string; largeur: number; hauteur: number } | null>(null);
  const avis = visuel && dimensions?.src === visuel ? avisVerticale(dimensions.largeur, dimensions.hauteur) : null;
  return (
    <div>
      <span className={ETIQUETTE}>
        Visuel vertical, facultatif ({VERTICALE_CONSEILLEE.largeur} × {VERTICALE_CONSEILLEE.hauteur} px conseillés)
      </span>
      <div className="flex items-start gap-3">
        {/* Les proportions exactes de l'affichage (300 × 600 dans le rail). */}
        <span className="relative flex aspect-[1/2] w-20 shrink-0 items-center justify-center overflow-hidden border border-gray-200/70 bg-gray-50">
          {visuel ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={visuel}
              src={visuel}
              alt=""
              onLoad={(e) => setDimensions({ src: visuel, largeur: e.currentTarget.naturalWidth, hauteur: e.currentTarget.naturalHeight })}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-1 text-center text-[10px] font-bold leading-tight text-gray-400">1:2</span>
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[11px] leading-snug text-gray-500">
            Pour le rail de droite du Direct, sur grand écran. Sans lui, la bannière y paraît en 4:1.
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              maj({ fichierVerticale: f, apercuVerticale: f ? URL.createObjectURL(f) : null, retirerImageVerticale: false });
            }}
            className="block min-w-0 text-xs"
          />
          {avis && <p className="text-[11px] font-semibold leading-snug text-amber-700">{avis}</p>}
          {(form.imageVerticaleUrl || form.fichierVerticale) && !form.retirerImageVerticale && (
            <button type="button" onClick={() => maj({ fichierVerticale: null, apercuVerticale: null, retirerImageVerticale: true })}
              className="text-[11px] font-bold text-red-600 hover:underline">
              Retirer le visuel vertical
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
