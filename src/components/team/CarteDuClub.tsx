"use client";

import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import MiniEcusson from "@/components/match/MiniEcusson";
import { FormeEnLettres } from "@/components/team/BandeauEquipe";
import { libelleDuJour } from "@/lib/dates";
import type { BilanClub } from "@/lib/bilan-club";
import type { CompetitionDuClub, MatchDuClub, Meneur } from "@/lib/fiche-club";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { FOOT } from "@/i18n/foot";

const T = textes(
  {
    rang: (n: number) => (n === 1 ? "1er" : `${n}e`),
    recrute: "Recrute",
    abonnes: (n: number) => `${n} abonné${n > 1 ? "s" : ""}`,
    joues: "Joués",
    gagnes: "Gagnés",
    nuls: "Nuls",
    perdus: "Perdus",
    forme: "Forme",
    buts: "Buts",
    meilleurButeur: "Meilleur buteur",
    meilleurPasseur: "Meilleur passeur",
    aucunMatch: "Aucun match joué pour l'instant : le bilan viendra avec.",
    amical: "Amical",
    competitions: (n: number) => (n > 1 ? "Compétitions" : "Compétition"),
    points: (n: number) => `${n} pts`,
  },
  {
    rang: (n: number) => {
      const dizaine = n % 100;
      const suffixe = dizaine >= 11 && dizaine <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
      return `${n}${suffixe}`;
    },
    recrute: "Recruiting",
    abonnes: (n: number) => `${n} follower${n === 1 ? "" : "s"}`,
    joues: "Played",
    gagnes: "Won",
    nuls: "Drawn",
    perdus: "Lost",
    forme: "Form",
    buts: "Goals",
    meilleurButeur: "Top scorer",
    meilleurPasseur: "Top assists",
    aucunMatch: "No matches played yet: the record will come with them.",
    amical: "Friendly",
    competitions: (n: number) => (n === 1 ? "Competition" : "Competitions"),
    points: (n: number) => `${n} pts`,
  },
);

// ============================================
// La carte d'un club : tout ce qu'on vient vérifier, sans ouvrir d'onglet.
//
// ELLE REMPLACE « À PROPOS » ET « STATS ». Le premier tenait quatre lignes
// et une phrase ; le second, dix chiffres en tuiles géantes, trois écrans et
// demi pour « 3 victoires, 1 nul ». On y retrouve la même chose, serrée :
// d'où vient le club, son bilan, sa forme, ses meilleurs joueurs, son prochain
// match, les compétitions où il est engagé — la réponse à « qui sont-ils,
// et où en sont-ils ».
//
// Sur ordinateur, elle se pose dans la colonne de droite, à côté de
// l'effectif ; sur téléphone, entre le bandeau et les onglets.
// ============================================

function Chiffre({ valeur, libelle, ton = "text-gray-900" }: { valeur: number; libelle: string; ton?: string }) {
  return (
    <div className="min-w-0">
      <p className={`font-display text-2xl font-black leading-none tabular-nums ${ton}`}>{valeur}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">{libelle}</p>
    </div>
  );
}

function LeMeilleur({ titre, m, quantite }: { titre: string; m: Meneur | undefined; quantite: (n: number) => string }) {
  if (!m) return null;
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">{titre}</p>
      <p className="mt-0.5 truncate text-sm font-black text-gray-900">
        {m.uid ? (
          <Link href={`/profile/${m.uid}`} className="hover:text-emerald-700">{m.nom}</Link>
        ) : m.nom}
      </p>
      <p className="text-[11px] font-bold tabular-nums text-gray-500">
        {quantite(m.valeur)}
      </p>
    </div>
  );
}

export default function CarteDuClub({
  ville, niveau, recrute, abonnes, bilan, forme, meneurs, prochain, competitions, presentation,
}: {
  ville: string | null;
  niveau: string | null;
  recrute: boolean;
  abonnes: number;
  bilan: BilanClub | null;
  /** Du plus ancien au plus récent. */
  forme: ("V" | "N" | "D")[];
  meneurs: { buteurs: Meneur[]; passeurs: Meneur[] } | null;
  prochain: MatchDuClub | null;
  competitions: CompetitionDuClub[];
  presentation: string | null;
}) {
  const { langue } = useLangue();
  const t = useTextes(T);
  const f = useTextes(FOOT);
  const identite = [ville, niveau].filter(Boolean).join(" · ");
  const buteur = meneurs?.buteurs[0];
  const passeur = meneurs?.passeurs[0];
  const diff = bilan ? bilan.butsPour - bilan.butsContre : 0;

  return (
    <aside className="divide-y divide-gray-200/70 border border-gray-200/70 bg-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[11px] font-bold text-gray-500">
        {identite && (
          <span className="flex items-center gap-1">
            <MapPin size={12} className="text-gray-300" />
            {identite}
          </span>
        )}
        {recrute && (
          <span className="bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">
            {t.recrute}
          </span>
        )}
        <span className="ml-auto tabular-nums">
          {t.abonnes(abonnes)}
        </span>
      </div>

      {bilan && bilan.joues > 0 ? (
        <div className="space-y-4 px-4 py-4">
          <div className="grid grid-cols-4 gap-2">
            <Chiffre valeur={bilan.joues} libelle={t.joues} />
            <Chiffre valeur={bilan.gagnes} libelle={t.gagnes} ton="text-emerald-700" />
            <Chiffre valeur={bilan.nuls} libelle={t.nuls} />
            <Chiffre valeur={bilan.perdus} libelle={t.perdus} ton="text-red-600" />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">{t.forme}</p>
              <div className="mt-1">
                <FormeEnLettres forme={forme} sombre={false} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">{t.buts}</p>
              <p className="mt-1 text-sm font-black tabular-nums text-gray-900">
                {bilan.butsPour}–{bilan.butsContre}
                <span className={`ml-1.5 text-xs ${diff > 0 ? "text-emerald-700" : diff < 0 ? "text-red-600" : "text-gray-400"}`}>
                  {diff > 0 ? `+${diff}` : diff}
                </span>
              </p>
            </div>
          </div>
          {(buteur || passeur) && (
            <div className="grid grid-cols-2 gap-3">
              <LeMeilleur titre={t.meilleurButeur} m={buteur} quantite={f.buts} />
              <LeMeilleur titre={t.meilleurPasseur} m={passeur} quantite={f.passes} />
            </div>
          )}
        </div>
      ) : (
        <p className="px-4 py-4 text-sm font-bold text-gray-400">
          {t.aucunMatch}
        </p>
      )}

      {prochain && (
        <Link href={prochain.lien} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">
              {prochain.statut === "en_direct" ? f.enDirect : f.prochainMatch}
              {" · "}
              {prochain.competition?.nom ?? t.amical}
            </p>
            <p className="mt-0.5 flex min-w-0 items-center gap-2 text-sm font-black text-gray-900">
              <MiniEcusson nom={prochain.adversaire.nom} logo={prochain.adversaire.logo} taille={18} className="text-gray-400" />
              <span className="truncate">{prochain.adversaire.nom}</span>
            </p>
            {prochain.date && (
              <p className="text-[11px] font-bold text-gray-500">
                {libelleDuJour(prochain.date, langue)}{prochain.heure ? ` · ${prochain.heure}` : ""}
                {prochain.lieu ? ` · ${prochain.lieu}` : ""}
              </p>
            )}
          </div>
          <ChevronRight size={16} className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {competitions.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-400">
            {t.competitions(competitions.length)}
          </p>
          <ul className="mt-1 space-y-1">
            {competitions.map((c) => (
              <li key={c.lienEquipe}>
                <Link href={c.lienEquipe} className="group flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-black text-gray-900 group-hover:text-emerald-700">{c.nom}</span>
                  {(c.groupe || c.rang) && (
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-500">
                      {[c.groupe ? f.groupe(c.groupe) : null, c.rang ? t.rang(c.rang) : null, c.points != null ? t.points(c.points) : null]
                        .filter(Boolean).join(" · ")}
                    </span>
                  )}
                  <ChevronRight size={14} className="shrink-0 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {presentation && (
        <p className="px-4 py-3 text-sm italic leading-relaxed text-gray-600">
          &ldquo;{presentation}&rdquo;
        </p>
      )}
    </aside>
  );
}
