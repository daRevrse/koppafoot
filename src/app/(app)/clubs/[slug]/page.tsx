"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import { Moon, Settings, Share2 } from "lucide-react";
import BandeauEquipe, { BOUTON_BANDEAU } from "@/components/team/BandeauEquipe";
import MiniEcusson from "@/components/match/MiniEcusson";
import { useAuth } from "@/contexts/AuthContext";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { versHex } from "@/lib/couleurs-equipe";
import { lienAbsolu, partagerLien } from "@/lib/partage";
import type { ClubPublic } from "@/lib/clubs";

// ============================================
// La page d'un club : son identité, ses sections, son encadrement.
//
// Chaque section mène à la fiche de son équipe, qui garde tout : effectif,
// matchs, statistiques. Le club ne recopie rien, il réunit (lib/clubs).
//
// EN SOMMEIL, la page le dit sans rien montrer d'autre ; son propriétaire y
// lit pourquoi, et que rien n'est perdu.
// ============================================

const T = textes(
  {
    accueil: "Accueil",
    introuvable: "Ce club n'existe pas, ou plus.",
    sections: "Les sections",
    encadrement: "L'encadrement",
    sectionsCompte: (n: number) => `${n} section${n > 1 ? "s" : ""}`,
    club: "Club",
    aucuneSection: "Le club n'a pas encore de section.",
    partager: "Partager ce club",
    partageTexte: (nom: string) => `${nom}, sur KoppaFoot`,
    lienCopie: "Lien du club copié !",
    partageEchoue: "Partage impossible",
    gerer: "Gérer le club",
    sommeilTitre: "Cette page de club est en sommeil.",
    sommeilVisiteur: "Ses équipes restent visibles sur leurs propres fiches.",
    sommeilProprietaire:
      "Ton club dort parce que ton KoppaFoot Pro s'est arrêté. Rien n'est effacé : sections, identité et encadrement reviennent tels quels avec le Pro.",
    voirOffre: "Voir mon offre",
  },
  {
    accueil: "Home",
    introuvable: "This club doesn't exist, or no longer does.",
    sections: "Sections",
    encadrement: "Staff",
    sectionsCompte: (n: number) => `${n} section${n > 1 ? "s" : ""}`,
    club: "Club",
    aucuneSection: "The club has no section yet.",
    partager: "Share this club",
    partageTexte: (nom: string) => `${nom}, on KoppaFoot`,
    lienCopie: "Club link copied!",
    partageEchoue: "Couldn't share",
    gerer: "Manage the club",
    sommeilTitre: "This club page is dormant.",
    sommeilVisiteur: "Its teams remain visible on their own pages.",
    sommeilProprietaire:
      "Your club is dormant because your KoppaFoot Pro ended. Nothing is deleted: sections, identity and staff come back as they were with Pro.",
    voirOffre: "See my plan",
  },
);

export default function ClubPage() {
  const t = useTextes(T);
  const { slug } = useParams<{ slug: string }>();
  const { firebaseUser } = useAuth();
  const [club, setClub] = useState<ClubPublic | null | undefined>(undefined);

  useEffect(() => {
    let vivant = true;
    fetch(`/api/public/club/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (vivant) setClub(d.club ?? null); })
      .catch(() => { if (vivant) setClub(null); });
    return () => { vivant = false; };
  }, [slug]);

  if (club === undefined) {
    return <div className="mx-auto mt-6 h-48 max-w-6xl animate-pulse bg-gray-100" />;
  }
  if (club === null) {
    return <p className="mx-auto max-w-xl py-24 text-center text-sm text-gray-500">{t.introuvable}</p>;
  }

  const proprietaire = firebaseUser?.uid === club.proprietaireId;

  if (club.enSommeil) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <Moon size={28} className="mx-auto text-gray-300" />
        <h1 className="mt-4 font-display text-2xl font-black uppercase tracking-tight text-gray-900">{club.nom}</h1>
        <p className="mt-2 text-sm font-semibold text-gray-700">{t.sommeilTitre}</p>
        <p className="mt-1 text-sm text-gray-500">{proprietaire ? t.sommeilProprietaire : t.sommeilVisiteur}</p>
        {proprietaire && (
          <Link href="/offre" className="mt-5 inline-flex border border-gray-900 bg-gray-900 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-gray-700">
            {t.voirOffre}
          </Link>
        )}
      </div>
    );
  }

  const partager = async () => {
    const r = await partagerLien({ title: club.nom, text: t.partageTexte(club.nom), url: lienAbsolu(`/clubs/${club.slug}`) });
    if (r === "copie") toast.success(t.lienCopie);
    else if (r === "echec") toast.error(t.partageEchoue);
  };

  return (
    <div className="pb-16">
      <BandeauEquipe
        fil={[{ label: t.accueil, href: "/" }, { label: club.nom }]}
        nom={club.nom}
        logo={club.logoUrl}
        couleur={club.couleur}
        surtitre={[t.club, club.ville].filter(Boolean).join(" · ")}
        devise={club.slogan}
        banniere={club.banniereUrl}
        puces={<span>{t.sectionsCompte(club.sections.length)}</span>}
        actions={
          <>
            <button type="button" onClick={partager} aria-label={t.partager} className={BOUTON_BANDEAU}>
              <Share2 size={14} />
            </button>
            {proprietaire && (
              <Link href="/mon-club" aria-label={t.gerer} className={BOUTON_BANDEAU}>
                <Settings size={14} />
              </Link>
            )}
          </>
        }
      />

      <div className="mx-auto mt-4 grid max-w-6xl gap-4 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-4">
          {club.description && (
            <p className="whitespace-pre-line border border-gray-200/70 bg-white p-4 text-sm leading-relaxed text-gray-700">
              {club.description}
            </p>
          )}
          <section>
            <h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{t.sections}</h2>
            {club.sections.length === 0 ? (
              <p className="border border-gray-200/70 bg-white p-4 text-sm text-gray-500">{t.aucuneSection}</p>
            ) : (
              <div className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2">
                {club.sections.map((s) => (
                  <Link
                    key={s.equipeId}
                    href={`/teams/${s.equipeId}`}
                    className="flex items-center gap-3 bg-white p-4 transition-colors hover:bg-gray-50"
                  >
                    {s.logoUrl ? (
                      <MiniEcusson nom={s.nom} logo={s.logoUrl} taille={44} />
                    ) : (
                      <span
                        aria-hidden
                        style={{ backgroundColor: versHex(s.couleur) ?? club.couleur }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center font-display text-lg font-black text-white"
                      >
                        {s.nom.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{s.libelle}</span>
                      <span className="block truncate font-display text-base font-black tracking-tight text-gray-900">{s.nom}</span>
                      {s.ville && <span className="block text-xs text-gray-500">{s.ville}</span>}
                    </span>
                  </Link>
                ))}
                {/* Un nombre impair de sections : une case blanche plutôt qu'un trou gris. */}
                {club.sections.length % 2 === 1 && <span aria-hidden className="hidden bg-white sm:block" />}
              </div>
            )}
          </section>
        </div>

        {club.staff.length > 0 && (
          <aside>
            <h2 className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{t.encadrement}</h2>
            <ul className="divide-y divide-gray-100 border border-gray-200/70 bg-white">
              {club.staff.map((m, i) => (
                <li key={`${m.nom}-${i}`} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <span className="truncate text-sm font-bold text-gray-900">{m.nom}</span>
                  {m.titre && <span className="shrink-0 text-xs text-gray-500">{m.titre}</span>}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
