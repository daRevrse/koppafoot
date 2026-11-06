import type { User } from "firebase/auth";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { libellePoste } from "@/lib/postes";
import type { JoinRequest, Team } from "@/types";
import { Bouton } from "~/components/Bouton";
import { EtatVide } from "~/components/EtatVide";
import { Avatar } from "~/components/mon-club/Avatar";
import { confirmer, prevenir } from "~/lib/confirmer";
import { notifierActiviteEquipe, notifierCompte } from "~/lib/equipe-api";
import { repondreCandidature } from "~/lib/equipe-firestore";
import { messageDe } from "~/lib/message-erreur";
import { candidaturesParEtat, instant, libelleNiveau } from "~/lib/mon-club";
import { creerStyles, espacement, polices } from "~/theme";

const jour = (v: unknown) => {
  const t = instant(v);
  return t ? new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "";
};

/** Poste, ville, niveau : ce qu'on lit d'un candidat avant de répondre. */
const profil = (d: JoinRequest) =>
  [libellePoste(d.playerPosition), d.playerCity, libelleNiveau(d.playerLevel)].filter(Boolean).join(" · ");

/**
 * Les candidatures du club. Accepter fait entrer le joueur dans l'effectif ;
 * dans les deux cas il est prévenu, comme sur le site. Les réponses passées
 * restent consultables, repliées.
 */
export function OngletCandidatures({ equipe, candidatures, peutGerer, utilisateur }: {
  equipe: Team;
  candidatures: JoinRequest[];
  peutGerer: boolean;
  utilisateur: User;
}) {
  const styles = useStyles();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [passeesOuvertes, setPasseesOuvertes] = useState(false);
  const { enAttente, passees } = candidaturesParEtat(candidatures);

  async function repondre(d: JoinRequest, acceptee: boolean) {
    if (!acceptee) {
      const oui = await confirmer({
        titre: `Refuser ${d.playerName} ?`,
        message: `${d.playerName} sera prévenu que ${equipe.name} n'a pas retenu sa candidature.`,
        action: "Refuser",
      });
      if (!oui) return;
    }
    setEnCours(d.id);
    try {
      await repondreCandidature(d, acceptee);
      if (acceptee) notifierActiviteEquipe(utilisateur, { teamId: equipe.id, event: "member_joined", playerId: d.playerId });
      void notifierCompte(utilisateur, {
        userId: d.playerId,
        type: "join_request",
        title: acceptee ? "Candidature acceptée" : "Candidature refusée",
        body: acceptee ? `Bienvenue dans ${equipe.name} !` : `${equipe.name} n'a pas retenu ta candidature.`,
        link: acceptee ? `/teams/${equipe.id}` : "/mercato",
      });
    } catch (e) {
      prevenir("Réponse impossible", messageDe(e));
    } finally {
      setEnCours(null);
    }
  }

  return (
    <View style={styles.colonne}>
      {enAttente.length === 0 ? (
        <EtatVide icone="mail-unread-outline" texte="Aucune candidature en attente. Les joueurs qui demandent à rejoindre le club apparaîtront ici." />
      ) : (
        enAttente.map((d) => (
          <View key={d.id} style={styles.carte}>
            <View style={styles.entete}>
              <Avatar nom={d.playerName} photo={d.playerPhoto} taille={44} />
              <View style={styles.textes}>
                <Text style={styles.nom} numberOfLines={1}>{d.playerName}</Text>
                <Text style={styles.sous} numberOfLines={2}>{profil(d)}</Text>
              </View>
              <Text style={styles.date}>{jour(d.createdAt)}</Text>
            </View>
            {d.message?.trim() ? <Text style={styles.message}>{`« ${d.message.trim()} »`}</Text> : null}
            {peutGerer ? (
              <View style={styles.boutons}>
                <View style={styles.bouton}>
                  <Bouton titre="Refuser" variante="contour" disabled={enCours !== null} onPress={() => void repondre(d, false)} />
                </View>
                <View style={styles.bouton}>
                  <Bouton titre="Accepter" occupe={enCours === d.id} disabled={enCours !== null} onPress={() => void repondre(d, true)} />
                </View>
              </View>
            ) : null}
          </View>
        ))
      )}

      {passees.length > 0 ? (
        <View style={styles.passees}>
          <Pressable
            accessibilityRole="button"
            aria-expanded={passeesOuvertes}
            onPress={() => setPasseesOuvertes((o) => !o)}
            style={styles.replier}
          >
            <Text style={styles.replierTexte}>{`RÉPONSES PASSÉES · ${passees.length}`}</Text>
            <Text style={styles.replierTexte}>{passeesOuvertes ? "MASQUER" : "AFFICHER"}</Text>
          </Pressable>
          {passeesOuvertes
            ? passees.map((d) => (
                <View key={d.id} style={styles.ligne}>
                  <Avatar nom={d.playerName} photo={d.playerPhoto} taille={32} />
                  <Text style={styles.ligneNom} numberOfLines={1}>{d.playerName}</Text>
                  <Text style={[styles.statut, d.status === "accepted" && styles.acceptee]}>
                    {d.status === "accepted" ? "ACCEPTÉE" : "REFUSÉE"}
                  </Text>
                </View>
              ))
            : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  colonne: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  carte: {
    gap: 12, padding: 14, backgroundColor: couleurs.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  entete: { flexDirection: "row", alignItems: "center", gap: 12 },
  textes: { flex: 1, minWidth: 0, gap: 2 },
  nom: { fontFamily: polices.texteGras, fontSize: 15, color: couleurs.texte },
  sous: { fontFamily: polices.texte, fontSize: 12, color: couleurs.texteDiscret },
  date: { fontFamily: polices.texteMoyen, fontSize: 11, color: couleurs.texteDiscret },
  message: { fontFamily: polices.texteMoyen, fontStyle: "italic", fontSize: 14, lineHeight: 20, color: couleurs.texteSecondaire },
  boutons: { flexDirection: "row", gap: 8 },
  bouton: { flex: 1 },
  passees: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  replier: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 14 },
  replierTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: couleurs.texteDiscret },
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  ligneNom: { flex: 1, fontFamily: polices.texteDemi, fontSize: 14, color: couleurs.texte },
  statut: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteDiscret },
  acceptee: { color: couleurs.primaire },
}));
