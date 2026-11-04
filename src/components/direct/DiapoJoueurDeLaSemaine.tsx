"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { BadgeCheck, ChevronRight, Loader2, Share2, Trophy, UserCheck, UserPlus, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/auth/AuthModal";
import { followUser, isFollowing, unfollowUser } from "@/lib/firestore";
import { lienAbsolu, partagerLien } from "@/lib/partage";
import {
  adresseDeLAffiche, cheminDuJoueur, nomEnPhrase, periodeDeLaSemaine, resumeDuJoueur, texteDuPartage,
  type JoueurDeLaSemaine,
} from "@/lib/joueur-semaine-publie";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";

// ============================================
// La diapositive « Joueur de la semaine », en tête de l'affiche du Direct.
//
// ELLE PREND LA FORME D'UNE DIAPOSITIVE DE MATCH : un en-tête, le cœur sur
// fond gris, puis une question et trois boutons ronds, là où le match pose
// « Qui va gagner ? ». Le carrousel ne saute pas d'une forme à l'autre, et
// l'œil sait déjà où toucher.
//
// TROIS GESTES (décidés le 2026-11-04) : voir sa fiche, le suivre, partager.
// Un joueur sans compte n'a ni fiche ni abonnés : il ne garde que le partage.
//
// L'AFFICHE PART AVEC LE PARTAGE. Elle est téléchargée d'avance, un peu après
// l'affichage : `navigator.share` exige un geste frais, et aller la chercher
// au clic le consommerait (voir lib/partage). Là où le navigateur ne sait pas
// joindre un fichier (un ordinateur, le plus souvent), le lien est copié et
// l'affiche téléchargée.
// ============================================

const T = textes(
  {
    titre: "Joueur de la semaine",
    semaine: (n: number, periode: string) => `Semaine ${n} · ${periode}`,
    voirTous: "Tous les joueurs de la semaine",
    bravo: (prenom: string) => `Bravo, ${prenom} !`,
    invitation: "Abonne-toi, partage son affiche",
    invitationSansCompte: "Partage son affiche",
    fiche: "Sa fiche",
    suivre: "Suivre",
    suivi: "Suivi",
    toi: "C'est toi",
    partager: "Partager",
    compte: "Crée ton compte pour suivre ce joueur.",
    lienCopie: "Lien copié, affiche téléchargée",
    lienCopieSeul: "Lien copié",
    echec: "Partage impossible",
    erreur: "Une erreur est survenue",
    afficheDe: (nom: string) => `L'affiche de ${nom}, joueur de la semaine`,
  },
  {
    titre: "Player of the week",
    semaine: (n: number, periode: string) => `Week ${n} · ${periode}`,
    voirTous: "All players of the week",
    bravo: (prenom: string) => `Well played, ${prenom}!`,
    invitation: "Follow them, share their poster",
    invitationSansCompte: "Share their poster",
    fiche: "Profile",
    suivre: "Follow",
    suivi: "Following",
    toi: "That's you",
    partager: "Share",
    compte: "Create your account to follow this player.",
    lienCopie: "Link copied, poster downloaded",
    lienCopieSeul: "Link copied",
    echec: "Couldn't share",
    erreur: "Something went wrong",
    afficheDe: (nom: string) => `${nom}'s player of the week poster`,
  },
);

/** L'affiche verticale, prête à joindre à un partage ; null tant qu'elle n'est pas là. */
function useAfficheAPartager(joueur: JoueurDeLaSemaine): File | null {
  const [fichier, setFichier] = useState<{ version: string; valeur: File } | null>(null);
  useEffect(() => {
    let vivant = true;
    // Après le premier affichage : le tableau des matchs passe d'abord.
    const minuteur = setTimeout(async () => {
      try {
        const reponse = await fetch(adresseDeLAffiche(joueur, "vertical"));
        if (!reponse.ok) return;
        const image = await reponse.blob();
        if (!vivant) return;
        setFichier({
          version: joueur.version,
          valeur: new File([image], `koppafoot-joueur-semaine-${joueur.numero}.jpg`, { type: image.type || "image/jpeg" }),
        });
      } catch {
        // Le partage se fera sans l'image.
      }
    }, 1500);
    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [joueur]);
  return fichier?.version === joueur.version ? fichier.valeur : null;
}

function telecharger(fichier: File) {
  const adresse = URL.createObjectURL(fichier);
  const a = document.createElement("a");
  a.href = adresse;
  a.download = fichier.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(adresse), 10_000);
}

function Bouton({ onClick, href, disabled, actif, children, label }: {
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  actif?: boolean;
  children: React.ReactNode;
  label?: string;
}) {
  const classe = `flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-full border-2 px-2 text-[12px] font-black transition-colors disabled:cursor-default ${
    actif ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200/70 bg-white text-gray-700 hover:border-gray-300"
  }`;
  if (href) {
    return <Link href={href} onClick={onClick} className={classe} aria-label={label}>{children}</Link>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={actif} aria-label={label} className={classe}>
      {children}
    </button>
  );
}

export default function DiapoJoueurDeLaSemaine({ joueur, onGeste }: {
  joueur: JoueurDeLaSemaine;
  /** Un bouton touché : le carrousel cesse de défiler sous le doigt. */
  onGeste?: () => void;
}) {
  const t = useTextes(T);
  const { langue } = useLangue();
  const { user } = useAuth();
  const { open } = useAuthModal();
  const fichier = useAfficheAPartager(joueur);
  const [suivi, setSuivi] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const nom = nomEnPhrase(joueur.nom);
  const prenom = nom.split(/\s+/)[0] ?? nom;
  const cEstToi = !!user && user.uid === joueur.uid;
  const equipe = joueur.equipes[0] ?? null;
  const resume = resumeDuJoueur(joueur, langue === "en" ? "en" : "fr");

  useEffect(() => {
    if (!user || !joueur.uid || user.uid === joueur.uid) return;
    let vivant = true;
    isFollowing(user.uid, joueur.uid).then((oui) => { if (vivant) setSuivi(oui); }).catch(() => {});
    return () => { vivant = false; };
  }, [user, joueur.uid]);

  const basculerSuivi = async () => {
    onGeste?.();
    if (!joueur.uid) return;
    if (!user) {
      open(t.compte);
      return;
    }
    setEnCours(true);
    try {
      if (suivi) await unfollowUser(user.uid, joueur.uid);
      else await followUser(user.uid, joueur.uid);
      setSuivi(!suivi);
    } catch {
      toast.error(t.erreur);
    } finally {
      setEnCours(false);
    }
  };

  // Pas d'`await` avant `partagerLien` : le geste doit rester frais.
  const partager = async () => {
    onGeste?.();
    const resultat = await partagerLien({
      title: t.titre,
      text: texteDuPartage(joueur, langue === "en" ? "en" : "fr"),
      url: lienAbsolu(cheminDuJoueur(joueur.lundi)),
      fichier,
    });
    if (resultat === "copie") {
      if (fichier) telecharger(fichier);
      toast.success(fichier ? t.lienCopie : t.lienCopieSeul);
    } else if (resultat === "echec") {
      toast.error(t.echec);
    }
  };

  return (
    <div>
      {/* L'en-tête, à la place de celui de la compétition. */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <Trophy size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-black text-gray-900">{t.titre}</span>
          <span className="block truncate text-[11px] font-bold text-gray-400">
            {t.semaine(joueur.numero, periodeDeLaSemaine(joueur, langue === "en" ? "en" : "fr"))}
          </span>
        </span>
        <Link
          href={cheminDuJoueur(joueur.lundi)}
          aria-label={t.voirTous}
          onClick={onGeste}
          className="shrink-0 text-gray-300 transition-colors hover:text-gray-600"
        >
          <ChevronRight size={18} />
        </Link>
      </div>

      {/* Le joueur : son affiche en vignette, son nom, son équipe, sa semaine. */}
      <div className="px-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 bg-gray-50/70 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={adresseDeLAffiche(joueur, "publication", true)}
            alt={t.afficheDe(nom)}
            width={96}
            height={120}
            className="h-[120px] w-24 shrink-0 bg-white object-cover shadow-sm ring-1 ring-gray-200/70"
          />
          <div className="min-w-0">
            <p className="line-clamp-2 font-display text-lg font-black leading-tight text-gray-900">{nom}</p>
            {equipe && (
              <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[12px] font-bold text-gray-500">
                {equipe.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={equipe.logo} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
                ) : null}
                <span className="truncate">{equipe.nom}</span>
              </p>
            )}
            {resume && (
              <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                {resume}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Les gestes, là où le match pose son pronostic. */}
      <div className="px-4 pb-3 pt-3">
        <p className="text-[13px] font-black text-gray-900">{t.bravo(prenom)}</p>
        <p className="text-[11px] font-bold text-gray-400">{joueur.uid ? t.invitation : t.invitationSansCompte}</p>
        <div className={`mt-2.5 grid gap-2 ${joueur.uid ? "grid-cols-3" : "grid-cols-1"}`}>
          {joueur.uid && (
            <Bouton href={`/profile/${joueur.uid}`} onClick={onGeste}>
              <UserRound size={14} className="shrink-0" />
              <span className="truncate">{t.fiche}</span>
            </Bouton>
          )}
          {joueur.uid && (cEstToi ? (
            <Bouton disabled actif>
              <BadgeCheck size={14} className="shrink-0" />
              <span className="truncate">{t.toi}</span>
            </Bouton>
          ) : (
            <Bouton onClick={() => void basculerSuivi()} disabled={enCours} actif={suivi}>
              {enCours ? (
                <Loader2 size={14} className="shrink-0 animate-spin" />
              ) : suivi ? (
                <UserCheck size={14} className="shrink-0" />
              ) : (
                <UserPlus size={14} className="shrink-0" />
              )}
              <span className="truncate">{suivi ? t.suivi : t.suivre}</span>
            </Bouton>
          ))}
          <Bouton onClick={() => void partager()}>
            <Share2 size={14} className="shrink-0" />
            <span className="truncate">{t.partager}</span>
          </Bouton>
        </div>
      </div>
    </div>
  );
}
