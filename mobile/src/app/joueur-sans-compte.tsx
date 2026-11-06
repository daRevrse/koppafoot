import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { LIBELLE_POSTE, POSTES, type Poste } from "@/lib/postes";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { EcranAuth, useStylesAuth } from "~/components/EcranAuth";
import { Pastilles } from "~/components/mon-club/Pastilles";
import { useAuth } from "~/lib/auth";
import { confirmer } from "~/lib/confirmer";
import { retirerPhotoFantome } from "~/lib/equipe-api";
import { creerFantome, lireFantome, modifierFantome, supprimerFantome, type ChampsFantome } from "~/lib/equipe-firestore";
import { messageDe } from "~/lib/message-erreur";
import { erreursFantome, nettoyerDossard } from "~/lib/mon-club";
import { useCouleurs } from "~/theme";

const OPTIONS_POSTE = POSTES.map((p) => ({ valeur: p, libelle: LIBELLE_POSTE[p] }));
const VIDE: ChampsFantome = { prenom: "", nom: "", poste: "midfielder", dossard: "" };

/**
 * Ajouter ou modifier un joueur sans compte : celui qui n'a pas de téléphone
 * figure quand même dans l'effectif et sur les feuilles de match. Sa photo et
 * son état de forme se règlent sur le site, pour l'instant.
 */
export default function EcranJoueurSansCompte() {
  const stylesAuth = useStylesAuth();
  const couleurs = useCouleurs();
  const router = useRouter();
  const { utilisateur } = useAuth();
  const { teamId, ghostId } = useLocalSearchParams<{ teamId: string; ghostId?: string }>();
  const [champs, setChamps] = useState<ChampsFantome>(VIDE);
  // Pour un joueur à modifier : undefined pendant la lecture, null s'il n'existe plus.
  const [photo, setPhoto] = useState<string | null | undefined>(ghostId ? undefined : null);
  const [introuvable, setIntrouvable] = useState(false);
  const [essaye, setEssaye] = useState(false);
  const [occupe, setOccupe] = useState<"enregistrer" | "supprimer" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!ghostId || !teamId) return;
    let vivant = true;
    lireFantome(teamId, ghostId)
      .then((g) => {
        if (!vivant) return;
        if (!g) {
          setIntrouvable(true);
          return;
        }
        setChamps({ prenom: g.firstName, nom: g.lastName, poste: g.position as Poste, dossard: g.squadNumber ?? "" });
        setPhoto(g.photoUrl ?? null);
      })
      .catch((e: unknown) => {
        if (vivant) setErreur(messageDe(e));
      });
    return () => {
      vivant = false;
    };
  }, [teamId, ghostId]);

  const erreurs = essaye ? erreursFantome(champs) : {};
  const modifier = (c: Partial<ChampsFantome>) => setChamps((avant) => ({ ...avant, ...c }));

  async function enregistrer() {
    setEssaye(true);
    if (!teamId || Object.keys(erreursFantome(champs)).length > 0) return;
    setOccupe("enregistrer");
    setErreur(null);
    try {
      if (ghostId) await modifierFantome(teamId, ghostId, champs);
      else await creerFantome(teamId, champs);
      router.back();
    } catch (e) {
      setErreur(messageDe(e));
      setOccupe(null);
    }
  }

  async function supprimer() {
    if (!teamId || !ghostId) return;
    const nom = `${champs.prenom} ${champs.nom}`.trim() || "ce joueur";
    const oui = await confirmer({
      titre: `Supprimer ${nom} ?`,
      message: "Il disparaît de l'effectif du club.",
      action: "Supprimer",
    });
    if (!oui) return;
    setOccupe("supprimer");
    setErreur(null);
    try {
      // Sa photo d'abord, par le serveur : sinon le fichier resterait en ligne. Un échec n'empêche pas la suppression.
      if (photo && utilisateur) await retirerPhotoFantome(utilisateur, teamId, ghostId).catch(() => {});
      await supprimerFantome(teamId, ghostId);
      router.back();
    } catch (e) {
      setErreur(messageDe(e));
      setOccupe(null);
    }
  }

  const titre = ghostId ? "Modifier le joueur" : "Joueur sans compte";
  const phrase = ghostId
    ? "Son nom, son poste et son numéro, tels qu'ils s'affichent dans l'effectif et sur les feuilles de match."
    : "Pour celui qui n'a pas de téléphone : il figure dans l'effectif et sur les feuilles de match comme les autres.";

  if (introuvable) {
    return (
      <EcranAuth titre={titre} phrase="Ce joueur n'existe plus : il a peut-être été supprimé depuis un autre téléphone.">
        <Bouton titre="Revenir" variante="contour" onPress={() => router.back()} />
      </EcranAuth>
    );
  }

  return (
    <EcranAuth titre={titre} phrase={phrase}>
      {photo === undefined ? (
        <ActivityIndicator color={couleurs.texteDiscret} />
      ) : (
        <>
          <Champ
            etiquette="Prénom"
            value={champs.prenom}
            onChangeText={(prenom) => modifier({ prenom })}
            autoCapitalize="words"
            autoComplete="off"
            maxLength={60}
            erreur={erreurs.prenom}
          />
          <Champ
            etiquette="Nom"
            value={champs.nom}
            onChangeText={(nom) => modifier({ nom })}
            autoCapitalize="words"
            autoComplete="off"
            maxLength={60}
            erreur={erreurs.nom}
          />
          <Pastilles etiquette="Poste" options={OPTIONS_POSTE} valeur={champs.poste} onChange={(poste) => modifier({ poste })} />
          <Champ
            etiquette="Dossard"
            value={champs.dossard}
            onChangeText={(v) => modifier({ dossard: nettoyerDossard(v) })}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="Facultatif"
          />
          {erreur ? <Text style={stylesAuth.erreur}>{erreur}</Text> : null}
          <Bouton titre="Enregistrer" occupe={occupe === "enregistrer"} disabled={occupe !== null} onPress={() => void enregistrer()} />
          {ghostId ? (
            <Bouton
              titre="Supprimer ce joueur"
              variante="danger"
              occupe={occupe === "supprimer"}
              disabled={occupe !== null}
              onPress={() => void supprimer()}
            />
          ) : null}
          <Bouton titre="Annuler" variante="lien" onPress={() => router.back()} />
        </>
      )}
    </EcranAuth>
  );
}
