import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useAuth } from "~/lib/auth";
import { suivreCompetition } from "~/lib/direct-firestore";
import { mettreEnAttente } from "~/lib/suivi-en-attente";

/**
 * Les compétitions suivies, et l'étoile qui les bascule.
 *
 * Optimiste : l'étoile change tout de suite, et revient si l'écriture échoue.
 * Sans compte, elle ouvre la connexion et se met en attente (voir
 * lib/suivi-en-attente).
 */
export function useSuivi() {
  const { utilisateur, profil, rafraichirProfil } = useAuth();
  const router = useRouter();
  const [enCours, setEnCours] = useState<ReadonlyMap<string, boolean>>(new Map());

  const ids = useMemo(() => {
    const s = new Set(profil?.followedCompetitionIds ?? []);
    for (const [cid, suivre] of enCours) {
      if (suivre) s.add(cid);
      else s.delete(cid);
    }
    return s;
  }, [profil, enCours]);

  const basculer = useCallback(
    async (cid: string) => {
      if (!profil) {
        // Connecté, mais le profil n'a pas pu être lu (réseau) : la connexion
        // lui est fermée par la garde, il n'y a rien à ouvrir.
        if (utilisateur) {
          Alert.alert("Profil indisponible", "Vérifie ta connexion, puis réessaie.");
          return;
        }
        mettreEnAttente(cid);
        router.push({ pathname: "/connexion", params: { raison: "suivre" } });
        return;
      }
      const suivre = !ids.has(cid);
      setEnCours((m) => new Map(m).set(cid, suivre));
      try {
        await suivreCompetition(profil.uid, cid, suivre);
        await rafraichirProfil();
      } catch {
        Alert.alert("Impossible de mettre à jour", "Vérifie ta connexion, puis réessaie.");
      } finally {
        setEnCours((m) => {
          const suivant = new Map(m);
          suivant.delete(cid);
          return suivant;
        });
      }
    },
    [utilisateur, profil, ids, router, rafraichirProfil],
  );

  return { ids, basculer };
}
