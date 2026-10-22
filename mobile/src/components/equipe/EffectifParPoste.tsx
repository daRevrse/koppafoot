import type { CompPlayer } from "@/types";
import { ListeEffectif } from "~/components/ListeEffectif";
import { usePhotosDesLignes } from "~/hooks/usePhotos";

/**
 * L'effectif d'une équipe de compétition : ses lignes, leurs visages (le
 * compte, la photo de la ligne, la fiche au club), rangés par poste.
 */
export function EffectifParPoste({ joueurs, clubId, feminin }: {
  joueurs: CompPlayer[];
  clubId: string | null | undefined;
  feminin: boolean;
}) {
  const photos = usePhotosDesLignes(joueurs, clubId);
  return (
    <ListeEffectif
      feminin={feminin}
      lignes={joueurs.map((p) => ({
        cle: p.id, nom: p.name, numero: p.number || null, poste: p.position ?? null, photo: photos[p.id] ?? null, uid: p.user_id ?? null,
      }))}
    />
  );
}
