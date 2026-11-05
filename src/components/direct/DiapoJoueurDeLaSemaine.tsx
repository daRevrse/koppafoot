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
  adresseDeLAffiche, cheminDuJoueur, nomEnPhrase, noteEnTexte, periodeDeLaSemaine, texteDuPartage,
  type JoueurDeLaSemaine,
} from "@/lib/joueur-semaine-publie";
import { PlayerAvatar, TeamCrest } from "@/components/ui/EntityAvatar";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";

// ============================================
// La diapositive « Joueur de la semaine », en tête de l'affiche du Direct.
//
// ELLE PREND LA FORME D'UNE DIAPOSITIVE DE MATCH : un en-tête, le cœur, puis
// trois boutons ronds, là où le match pose « Qui va gagner ? ». Le carrousel
// ne saute pas d'une forme à l'autre, et l'œil sait déjà où toucher.
//
// LE CŒUR, C'EST LE JOUEUR, PAS L'AFFICHE (2026-11-05) : sa photo couronnée,
// son nom, son équipe, ce qu'il a fait dans la semaine (buts, passes, note)
// et le match où il l'a fait. L'affiche est faite pour être partagée.
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
    hommeDuMatch: (n: number) => (n > 1 ? `Homme du match ×${n}` : "Homme du match"),
    buts: (n: number) => (n > 1 ? "buts" : "but"),
    passes: (n: number) => (n > 1 ? "passes" : "passe"),
    matchs: (n: number) => (n > 1 ? "matchs" : "match"),
    note: "note",
    detail: (b: number, p: number) => [b ? `${b} but${b > 1 ? "s" : ""}` : "", p ? `${p} passe${p > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · "),
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
  },
  {
    titre: "Player of the week",
    semaine: (n: number, periode: string) => `Week ${n} · ${periode}`,
    voirTous: "All players of the week",
    bravo: (prenom: string) => `Well played, ${prenom}!`,
    hommeDuMatch: (n: number) => (n > 1 ? `Man of the match ×${n}` : "Man of the match"),
    buts: (n: number) => (n > 1 ? "goals" : "goal"),
    passes: (n: number) => (n > 1 ? "assists" : "assist"),
    matchs: (n: number) => (n > 1 ? "matches" : "match"),
    note: "rating",
    detail: (b: number, p: number) => [b ? `${b} goal${b > 1 ? "s" : ""}` : "", p ? `${p} assist${p > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · "),
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
  const lng = langue === "en" ? "en" : "fr";
  // Le troisième chiffre : sa note quand il en a une, sinon ses matchs.
  const troisieme = joueur.note !== null
    ? { valeur: noteEnTexte(joueur.note, lng), libelle: t.note }
    : { valeur: String(joueur.matchs), libelle: t.matchs(joueur.matchs) };
  // Le match de sa semaine, le plus récent : celui qu'on raconte.
  const match = joueur.lignes[joueur.lignes.length - 1] ?? null;

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

      {/* Le joueur : sa photo couronnée, son nom, son équipe, sa semaine en chiffres. */}
      <div className="px-4">
        <div className="relative overflow-hidden bg-emerald-950 p-4 text-white">
          <Trophy aria-hidden size={132} strokeWidth={1.5} className="pointer-events-none absolute -right-7 -top-6 text-white/[0.06]" />
          <div className="relative flex items-center gap-3.5">
            <span className="relative shrink-0">
              <PlayerAvatar name={nom} photo={joueur.photo} size={72} className="ring-4 ring-amber-300" />
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-300 text-emerald-950 ring-2 ring-emerald-950">
                <Trophy size={14} />
              </span>
            </span>
            <div className="min-w-0">
              {joueur.hommeDuMatch > 0 && (
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">{t.hommeDuMatch(joueur.hommeDuMatch)}</p>
              )}
              <p className="line-clamp-2 font-display text-xl font-black leading-tight">{nom}</p>
              {equipe && (
                <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] font-bold text-white/70">
                  <TeamCrest name={equipe.nom} logo={equipe.logo} size={16} className="rounded-full" />
                  <span className="truncate">{equipe.nom}</span>
                </p>
              )}
            </div>
          </div>
          <div className="relative mt-3.5 grid grid-cols-3 gap-2">
            {[
              { valeur: String(joueur.buts), libelle: t.buts(joueur.buts) },
              { valeur: String(joueur.passes), libelle: t.passes(joueur.passes) },
              troisieme,
            ].map((c) => (
              <div key={c.libelle} className="bg-white/10 px-2 py-1.5 text-center">
                <p className="font-display text-xl font-black tabular-nums leading-tight">{c.valeur}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">{c.libelle}</p>
              </div>
            ))}
          </div>
        </div>
        {match && (
          <p className="mt-2 flex min-w-0 items-center gap-2 text-[11px] font-bold text-gray-500">
            <span className="shrink-0 font-black text-gray-400">{match.jour}</span>
            <span className="truncate uppercase">{match.affiche}</span>
            {t.detail(match.buts, match.passes) && (
              <span className="ml-auto shrink-0 font-black text-emerald-600">{t.detail(match.buts, match.passes)}</span>
            )}
          </p>
        )}
      </div>

      {/* Les gestes, là où le match pose son pronostic. */}
      <div className="px-4 pb-3 pt-3">
        <p className="text-[13px] font-black text-gray-900">{t.bravo(prenom)}</p>
        <div className={`mt-2 grid gap-2 ${joueur.uid ? "grid-cols-3" : "grid-cols-1"}`}>
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
