"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { getAllUsers, getModeratorIds, toggleUserActive } from "@/lib/admin-firestore";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import {
  Carte, Chargement, EnTete, Filtres, MenuActions, Pastille, Recherche, Selecteur, Vide, ilYA,
} from "@/components/admin/ui";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import { ESPACE_LABELS, espacesDuCompte, roleEffectif, roleHerite, type EspaceAcces } from "@/lib/espaces-acces";
import type { EvolutionRole, UserProfile } from "@/types";

// ============================================
// Les comptes.
//
// UNE LIGNE PAR COMPTE, ET LA LIGNE OUVRE SA FICHE. La liste empilait huit
// colonnes, trois boutons par ligne — dont « Désactiver », en rouge plein, le
// geste le plus visible de la page — et une fenêtre surgissante par action.
// Elle débordait de l'écran d'un téléphone. On lit ici qui est qui et ce
// qu'il peut ouvrir ; ce qu'on lui fait (casquettes, suspension, correction,
// suppression) se décide sur sa fiche, où l'on voit ce qu'il a fait avant.
//
// `?q=` préremplit la recherche : les autres écrans y mènent par un nom ou un
// e-mail (le manager d'une équipe, l'auteur d'un retour).
// ============================================

const ROLES: Record<EvolutionRole, string> = { player: "Joueur", manager: "Manager", referee: "Arbitre" };

type Filtre = "tous" | EvolutionRole | "sans" | "suspendus";

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function PageComptes() {
  const params = useSearchParams();
  const router = useRouter();
  const [comptes, setComptes] = useState<UserProfile[]>([]);
  const [moderateurs, setModerateurs] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState(() => params.get("q") ?? "");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [espace, setEspace] = useState<"tous" | "aucun" | EspaceAcces>("tous");

  const charger = useCallback(() => {
    Promise.all([getAllUsers(), getModeratorIds().catch(() => new Set<string>())])
      .then(([u, m]) => { setComptes(u); setModerateurs(m); })
      .catch(() => toast.error("Lecture des comptes impossible"))
      .finally(() => setChargement(false));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const compte = useMemo(() => {
    const n = { tous: comptes.length, player: 0, manager: 0, referee: 0, sans: 0, suspendus: 0 };
    for (const u of comptes) {
      const r = roleEffectif(u);
      if (r) n[r] += 1;
      else n.sans += 1;
      if (u.isActive === false) n.suspendus += 1;
    }
    return n;
  }, [comptes]);

  const filtres = useMemo(() => {
    const q = fold(recherche.trim());
    return comptes.filter((u) => {
      if (filtre === "suspendus" && u.isActive !== false) return false;
      if (filtre === "sans" && roleEffectif(u)) return false;
      if ((filtre === "player" || filtre === "manager" || filtre === "referee") && roleEffectif(u) !== filtre) return false;
      if (espace !== "tous") {
        const ouverts = espacesDuCompte(u, moderateurs);
        if (espace === "aucun" ? ouverts.length > 0 : !ouverts.includes(espace)) return false;
      }
      if (q) {
        const texte = fold(`${u.firstName} ${u.lastName} ${u.email ?? ""} ${u.phone ?? ""} ${u.locationCity ?? ""}`);
        return texte.includes(q);
      }
      return true;
    });
  }, [comptes, recherche, filtre, espace, moderateurs]);

  const { page, setPage, pages, tranche, total, parPage } = usePagination(filtres, 30);
  const sansEspace = useMemo(
    () => comptes.filter((u) => espacesDuCompte(u, moderateurs).length === 0).length,
    [comptes, moderateurs],
  );

  const basculer = async (u: UserProfile) => {
    const suspendre = u.isActive !== false;
    if (suspendre && !window.confirm(
      `Suspendre ${u.firstName} ${u.lastName} ?\n\nLe compte disparaît de la recherche de joueurs, des invitations de scoreurs et des envois groupés. Il peut encore se connecter. Rien n'est effacé : il se réactive d'ici.`,
    )) return;
    try {
      await toggleUserActive(u.uid, !suspendre);
      setComptes((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, isActive: !suspendre } : x)));
      toast.success(suspendre ? "Compte suspendu" : "Compte réactivé");
    } catch {
      toast.error("La modification a échoué");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <EnTete
        titre="Comptes"
        sousTitre={chargement ? "Lecture…" : `${comptes.length} comptes, dont ${sansEspace} sans aucun espace et ${compte.suspendus} suspendus.`}
      />

      <Filtres<Filtre>
        valeur={filtre}
        onChange={setFiltre}
        options={[
          { valeur: "tous", label: "Tous", compte: compte.tous },
          { valeur: "player", label: "Joueurs", compte: compte.player },
          { valeur: "manager", label: "Managers", compte: compte.manager },
          { valeur: "referee", label: "Arbitres", compte: compte.referee },
          { valeur: "sans", label: "Sans rôle", compte: compte.sans },
          { valeur: "suspendus", label: "Suspendus", compte: compte.suspendus },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        <Recherche valeur={recherche} onChange={setRecherche} placeholder="Nom, e-mail, téléphone, ville…" />
        <Selecteur
          label="Espace ouvert"
          valeur={espace}
          onChange={setEspace}
          options={[
            { valeur: "tous", label: "Tous les espaces" },
            { valeur: "aucun", label: "Aucun espace" },
            ...(Object.keys(ESPACE_LABELS) as EspaceAcces[]).map((e) => ({ valeur: e, label: `Espace ${ESPACE_LABELS[e].toLowerCase()}` })),
          ]}
        />
      </div>

      {chargement ? (
        <Chargement />
      ) : filtres.length === 0 ? (
        <Vide titre="Aucun compte" texte="Aucun compte ne correspond à cette recherche." />
      ) : (
        <Carte>
          <ul className="divide-y divide-gray-200/70">
            {tranche.map((u) => {
              const role = roleEffectif(u);
              const ouverts = espacesDuCompte(u, moderateurs);
              const nom = `${u.firstName} ${u.lastName}`.trim() || "Compte sans nom";
              return (
                <li key={u.uid} className="flex items-center gap-2 pr-2">
                  <Link href={`/admin/users/${u.uid}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50">
                    <PlayerAvatar name={nom} photo={u.profilePictureUrl} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`truncate text-sm font-bold ${u.isActive === false ? "text-gray-400 line-through" : "text-gray-900"}`}>{nom}</span>
                        {u.isActive === false && <Pastille ton="rouge">Suspendu</Pastille>}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {[u.email || u.phone, u.locationCity].filter(Boolean).join(" · ") || "Sans contact"}
                      </span>
                    </span>
                    <span className="hidden max-w-[45%] flex-wrap justify-end gap-1 md:flex">
                      {role ? (
                        <Pastille
                          ton={roleHerite(u) ? "gris" : "vert"}
                          title={roleHerite(u) ? "Déclaré à l'inscription, jamais activé : le produit ne lui ouvre pas cet espace." : "Activé dans Évolution"}
                        >
                          {ROLES[role]}{roleHerite(u) ? " (hérité)" : ""}
                        </Pastille>
                      ) : (
                        <Pastille>Sans rôle</Pastille>
                      )}
                      {ouverts.filter((e) => !["joueur", "manager", "arbitre"].includes(e)).map((e) => (
                        <Pastille key={e} ton={e === "administration" ? "noir" : "bleu"}>{ESPACE_LABELS[e]}</Pastille>
                      ))}
                    </span>
                    <span className="hidden w-20 shrink-0 text-right text-[11px] text-gray-400 sm:block">{ilYA(u.createdAt)}</span>
                  </Link>
                  <MenuActions
                    label={`Actions pour ${nom}`}
                    actions={[
                      { label: "Ouvrir la fiche", onClick: () => router.push(`/admin/users/${u.uid}`) },
                      u.isActive === false
                        ? { label: "Réactiver le compte", onClick: () => basculer(u) }
                        : { label: "Suspendre le compte", onClick: () => basculer(u), danger: true },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pages={pages} total={total} parPage={parPage} onPage={setPage} nom="compte" />
        </Carte>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<Chargement />}>
      <PageComptes />
    </Suspense>
  );
}
