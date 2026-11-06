import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { libellePoste } from "@/lib/postes";
import type { Invitation, Team } from "@/types";
import { Bouton } from "~/components/Bouton";
import { Avatar } from "~/components/mon-club/Avatar";
import { confirmer, prevenir } from "~/lib/confirmer";
import { annulerInvitation } from "~/lib/equipe-firestore";
import { messageDe } from "~/lib/message-erreur";
import { instant, invitationsEnAttente } from "~/lib/mon-club";
import { creerStyles, polices } from "~/theme";

const jour = (v: unknown) => {
  const t = instant(v);
  return t ? `Envoyée le ${new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : "";
};

/**
 * Les invitations envoyées pour ce club, en attente de réponse : chacune
 * s'annule. Les règles ne montrent à chacun que les siennes — un délégué ne
 * voit pas celles du propriétaire, et l'inverse.
 */
export function OngletInvitations({ equipe, invitations, peutGerer }: {
  equipe: Team;
  invitations: Invitation[];
  peutGerer: boolean;
}) {
  const styles = useStyles();
  const router = useRouter();
  const [enCours, setEnCours] = useState<string | null>(null);
  const liste = invitationsEnAttente(invitations, equipe.id);

  async function annuler(i: Invitation) {
    const oui = await confirmer({
      titre: `Annuler l'invitation de ${i.receiverName} ?`,
      message: "Elle disparaît de ses invitations.",
      action: "Annuler l'invitation",
    });
    if (!oui) return;
    setEnCours(i.id);
    try {
      await annulerInvitation(i.id);
    } catch (e) {
      prevenir("Annulation impossible", messageDe(e));
    } finally {
      setEnCours(null);
    }
  }

  return (
    <View style={styles.colonne}>
      {peutGerer ? (
        <Bouton titre="Inviter un joueur" onPress={() => router.push({ pathname: "/inviter-joueur", params: { teamId: equipe.id } })} />
      ) : null}
      <Text style={styles.note}>
        {liste.length === 0
          ? "Aucune invitation en attente. Celles que tu envoies pour ce club s'affichent ici jusqu'à la réponse du joueur."
          : "Celles que tu as envoyées pour ce club, en attente de réponse."}
      </Text>
      {liste.map((i) => (
        <View key={i.id} style={styles.ligne}>
          <Avatar nom={i.receiverName} photo={i.receiverPhoto} />
          <View style={styles.textes}>
            <Text style={styles.nom} numberOfLines={1}>{i.receiverName}</Text>
            <Text style={styles.sous} numberOfLines={1}>
              {[libellePoste(i.receiverPosition), i.receiverCity, jour(i.createdAt)].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {peutGerer ? (
            <Bouton titre="Annuler" variante="lien" occupe={enCours === i.id} disabled={enCours !== null} onPress={() => void annuler(i)} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  colonne: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  note: { fontFamily: polices.texte, fontSize: 13, lineHeight: 19, color: couleurs.texteSecondaire },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingLeft: 12, paddingRight: 4,
    backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  textes: { flex: 1, minWidth: 0, gap: 2 },
  nom: { fontFamily: polices.texteGras, fontSize: 15, color: couleurs.texte },
  sous: { fontFamily: polices.texte, fontSize: 12, color: couleurs.texteDiscret },
}));
