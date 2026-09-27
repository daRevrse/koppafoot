import Link from "next/link";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import { effectifParPoste } from "@/lib/fiche-club";

// ============================================
// Un effectif, rangé comme une feuille de match : par poste, du but vers
// l'attaque, puis par numéro.
//
// LE MÊME pour la fiche d'un club et pour celle d'une équipe en compétition.
// La première empilait une grande carte par joueur — quatorze joueurs, cinq
// écrans de téléphone —, la ville répétée sur chaque ligne ; la seconde
// affichait les postes en anglais (« GOALKEEPER ») et ne menait nulle part.
//
// UNE LIGNE PAR JOUEUR : son numéro, son visage, son nom. Le nom mène à sa
// fiche quand il a un compte. Deux colonnes dès que l'écran le permet.
//
// Le manager et le staff ouvrent la liste : ce sont eux qu'on cherche pour
// joindre le club.
// ============================================

export interface LigneDEffectif {
  cle: string;
  nom: string;
  numero?: string | null;
  poste?: string | null;
  photo?: string | null;
  /** Sa fiche publique, quand il a un compte. */
  lien?: string | null;
  /** Ce qui se pose après le nom : « Toi », sa forme… */
  apres?: React.ReactNode;
  /** Au bout de la ligne : une action, pour qui a le droit de la faire. */
  action?: React.ReactNode;
}

export default function EffectifParPoste({
  joueurs, manager, staff, vide = "Effectif non communiqué.",
}: {
  joueurs: LigneDEffectif[];
  manager?: { nom: string; photo: string | null; lien: string | null } | null;
  staff?: { nom: string; titre: string }[];
  vide?: string;
}) {
  const groupes = effectifParPoste(joueurs);

  return (
    <div className="space-y-4">
      {(manager || (staff ?? []).length > 0) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border border-gray-200/70 bg-white px-4 py-3">
          {manager && (
            <span className="flex min-w-0 items-center gap-2.5">
              <PlayerAvatar name={manager.nom} photo={manager.photo} size={28} />
              <span className="min-w-0">
                <span className="block text-[9px] font-black uppercase tracking-[0.15em] text-gray-400">Manager</span>
                {manager.lien ? (
                  <Link href={manager.lien} className="block truncate text-sm font-black text-gray-900 hover:text-emerald-700">
                    {manager.nom}
                  </Link>
                ) : (
                  <span className="block truncate text-sm font-black text-gray-900">{manager.nom}</span>
                )}
              </span>
            </span>
          )}
          {(staff ?? []).map((m) => (
            <span key={`${m.nom}-${m.titre}`} className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-[0.15em] text-gray-400">{m.titre || "Staff"}</span>
              <span className="block truncate text-sm font-bold text-gray-700">{m.nom}</span>
            </span>
          ))}
        </div>
      )}

      {groupes.length === 0 ? (
        <p className="border border-gray-200/70 bg-white px-5 py-8 text-center text-sm font-bold text-gray-400">{vide}</p>
      ) : (
        groupes.map((g) => (
          <section key={g.titre}>
            <h3 className="mb-1.5 flex items-baseline gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
              {g.titre}
              <span className="tabular-nums text-gray-300">{g.joueurs.length}</span>
            </h3>
            <ul className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2">
              {g.joueurs.map((j) => (
                <li key={j.cle} className="flex min-w-0 items-center gap-3 bg-white px-3 py-2.5">
                  <span className="w-6 shrink-0 text-right text-xs font-black tabular-nums text-gray-400">
                    {j.numero?.trim() || "–"}
                  </span>
                  <PlayerAvatar name={j.nom} photo={j.photo} size={30} />
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                    {j.lien ? (
                      <Link href={j.lien} className="truncate text-sm font-bold text-gray-900 hover:text-emerald-700">
                        {j.nom}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-bold text-gray-900">{j.nom}</span>
                    )}
                    {j.apres}
                  </span>
                  {j.action}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
