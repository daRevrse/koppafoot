import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { libellePoste } from "@/lib/postes";
import type { Team } from "@/types";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { EcranAuth, useStylesAuth } from "~/components/EcranAuth";
import { Avatar } from "~/components/mon-club/Avatar";
import { useAuth } from "~/lib/auth";
import { chercherJoueurs, notifierCompte, type JoueurTrouve } from "~/lib/equipe-api";
import { ecouterInvitationsEnvoyees, inviterJoueur, lireEquipe } from "~/lib/equipe-firestore";
import { messageDe } from "~/lib/message-erreur";
import { etatDuJoueur, libelleNiveau, messageInvitation } from "~/lib/mon-club";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

/** Au-delà, on demande de préciser : une liste de deux cents joueurs ne se parcourt pas sur un téléphone. */
const MAX_RESULTATS = 50;

const nomDe = (j: JoueurTrouve) => `${j.prenom} ${j.nom}`.trim() || "Joueur";

/**
 * Inviter un joueur de KoppaFoot dans son club : la recherche du mercato (par
 * nom, par ville), puis un message prérempli qu'on peut changer. Le joueur
 * reçoit une notification ; tant qu'il n'a pas répondu, l'invitation s'annule
 * depuis l'onglet Invitations.
 */
export default function EcranInviterJoueur() {
  const stylesAuth = useStylesAuth();
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const { utilisateur, profil } = useAuth();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const [equipe, setEquipe] = useState<Team | null | undefined>(undefined);
  const [texte, setTexte] = useState("");
  const [ville, setVille] = useState("");
  const [resultats, setResultats] = useState<JoueurTrouve[] | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [invites, setInvites] = useState<Set<string>>(new Set());
  const [choisi, setChoisi] = useState<JoueurTrouve | null>(null);
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoyee, setEnvoyee] = useState<string | null>(null);
  const monNom = `${profil?.firstName ?? ""} ${profil?.lastName ?? ""}`.trim();
  const uid = utilisateur?.uid;

  useEffect(() => {
    if (!teamId) return;
    let vivant = true;
    lireEquipe(teamId)
      .then((t) => {
        if (!vivant) return;
        setEquipe(t);
        if (t?.city) setVille((v) => v || t.city);
      })
      .catch((e: unknown) => {
        if (vivant) {
          setEquipe(null);
          setErreur(messageDe(e));
        }
      });
    return () => {
      vivant = false;
    };
  }, [teamId]);

  // Ceux qu'on a déjà invités dans ce club, et qui n'ont pas répondu.
  useEffect(() => {
    if (!uid || !teamId) return;
    return ecouterInvitationsEnvoyees(uid, (l) =>
      setInvites(new Set(l.filter((i) => i.teamId === teamId && i.status === "pending").map((i) => i.receiverId))),
    );
  }, [uid, teamId]);

  async function chercher() {
    if (!utilisateur) return;
    if (!texte.trim() && !ville.trim()) {
      setErreur("Donne au moins un nom ou une ville.");
      return;
    }
    setRecherche(true);
    setErreur(null);
    setEnvoyee(null);
    try {
      const trouves = await chercherJoueurs(utilisateur, { texte, ville });
      setResultats(trouves.filter((j) => j.uid !== utilisateur.uid));
    } catch (e) {
      setErreur(messageDe(e));
    } finally {
      setRecherche(false);
    }
  }

  function choisir(j: JoueurTrouve) {
    if (!equipe) return;
    setChoisi(j);
    setMessage(messageInvitation(monNom, equipe.name));
    setEnvoyee(null);
    setErreur(null);
  }

  async function envoyer() {
    if (!utilisateur || !equipe || !choisi) return;
    setEnvoi(true);
    setErreur(null);
    try {
      await inviterJoueur({ team: equipe, expediteur: { uid: utilisateur.uid, nom: monNom }, joueur: choisi, message: message.trim() });
      void notifierCompte(utilisateur, {
        userId: choisi.uid,
        type: "invitation",
        title: "Nouvelle invitation",
        body: `${monNom || equipe.name} t'invite à rejoindre ${equipe.name}`,
        link: "/mercato",
      });
      setInvites((avant) => new Set(avant).add(choisi.uid));
      setEnvoyee(nomDe(choisi));
      setChoisi(null);
    } catch (e) {
      setErreur(messageDe(e));
    } finally {
      setEnvoi(false);
    }
  }

  if (equipe === undefined) {
    return (
      <EcranAuth titre="Inviter un joueur" phrase="">
        <ActivityIndicator color={couleurs.texteDiscret} />
      </EcranAuth>
    );
  }
  if (equipe === null) {
    return (
      <EcranAuth titre="Inviter un joueur" phrase={erreur ?? "Ce club n'existe plus."}>
        <Bouton titre="Revenir" variante="contour" onPress={() => router.back()} />
      </EcranAuth>
    );
  }

  if (choisi) {
    return (
      <EcranAuth titre={`Inviter ${nomDe(choisi)}`} phrase={`Dans ${equipe.name}. Le joueur reçoit une notification et répond depuis ses invitations.`}>
        <View style={styles.choisi}>
          <Avatar nom={nomDe(choisi)} photo={choisi.photo} taille={48} />
          <View style={styles.textes}>
            <Text style={styles.nom}>{nomDe(choisi)}</Text>
            <Text style={styles.sous}>{[libellePoste(choisi.poste), choisi.ville, libelleNiveau(choisi.niveau)].filter(Boolean).join(" · ")}</Text>
          </View>
        </View>
        <Champ etiquette="Message" value={message} onChangeText={setMessage} multiline maxLength={500} style={styles.message} />
        {erreur ? <Text style={stylesAuth.erreur}>{erreur}</Text> : null}
        <Bouton titre="Envoyer l'invitation" occupe={envoi} onPress={() => void envoyer()} />
        <Bouton titre="Choisir un autre joueur" variante="lien" disabled={envoi} onPress={() => setChoisi(null)} />
      </EcranAuth>
    );
  }

  const affiches = resultats?.slice(0, MAX_RESULTATS) ?? [];
  return (
    <EcranAuth titre="Inviter un joueur" phrase={`Cherche un joueur de KoppaFoot par son nom ou sa ville, pour ${equipe.name}.`}>
      <Champ etiquette="Nom" value={texte} onChangeText={setTexte} placeholder="Prénom ou nom" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => void chercher()} />
      <Champ etiquette="Ville" value={ville} onChangeText={setVille} placeholder="Toutes les villes" autoCapitalize="words" returnKeyType="search" onSubmitEditing={() => void chercher()} />
      <Bouton titre="Chercher" occupe={recherche} onPress={() => void chercher()} />
      {erreur ? <Text style={stylesAuth.erreur}>{erreur}</Text> : null}
      {envoyee ? <Text style={styles.succes}>{`Invitation envoyée à ${envoyee}.`}</Text> : null}

      {resultats && resultats.length === 0 ? (
        <Text style={stylesAuth.info}>Aucun joueur ne correspond. La ville doit être écrite comme sur son profil : essaie sans elle.</Text>
      ) : null}
      {affiches.length > 0 ? (
        <View>
          {affiches.map((j) => {
            const etat = etatDuJoueur(j.uid, equipe, invites);
            return (
              <View key={j.uid} style={styles.ligne}>
                <Avatar nom={nomDe(j)} photo={j.photo} />
                <View style={styles.textes}>
                  <Text style={styles.nom} numberOfLines={1}>{nomDe(j)}</Text>
                  <Text style={styles.sous} numberOfLines={1}>
                    {[libellePoste(j.poste), j.ville, libelleNiveau(j.niveau)].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                {etat === "libre" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Inviter ${nomDe(j)}`}
                    onPress={() => choisir(j)}
                    hitSlop={6}
                    style={({ pressed }) => [styles.inviter, pressed && styles.presse]}
                  >
                    <Text style={styles.inviterTexte}>INVITER</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.etat}>{etat === "membre" ? "DANS LE CLUB" : "INVITÉ"}</Text>
                )}
              </View>
            );
          })}
          {resultats && resultats.length > MAX_RESULTATS ? (
            <Text style={[stylesAuth.info, styles.plus]}>{`${resultats.length - MAX_RESULTATS} autres : précise le nom pour les voir.`}</Text>
          ) : null}
        </View>
      ) : null}
    </EcranAuth>
  );
}

const useStyles = creerStyles((couleurs) => ({
  choisi: { flexDirection: "row", alignItems: "center", gap: 12 },
  textes: { flex: 1, minWidth: 0, gap: 2 },
  nom: { fontFamily: polices.texteGras, fontSize: 15, color: couleurs.texte },
  sous: { fontFamily: polices.texte, fontSize: 12, color: couleurs.texteDiscret },
  message: { minHeight: 96, textAlignVertical: "top" },
  succes: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.primaire },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  inviter: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: couleurs.bordure },
  inviterTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texte },
  presse: { backgroundColor: couleurs.surfaceHaute },
  etat: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteDiscret },
  plus: { marginTop: 12 },
}));
