import { Ionicons } from "@expo/vector-icons";
import { useState, type ComponentProps } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Notification, NotificationType } from "@/types";
import { Puces } from "~/components/competition/Puces";
import { EnTetePage } from "~/components/EnTetePage";
import { EtatVide } from "~/components/EtatVide";
import { useAuth } from "~/lib/auth";
import {
  filtresDisponibles, joursDesNotifications, LIBELLE_NOTIFICATION, notificationsDuFiltre, type FiltreNotifications,
} from "~/lib/centre-notifications";
import { useNotifications } from "~/lib/notifications";
import { ouvrirLeLien } from "~/lib/push";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

/** L'icône de chaque type, celles du site (lucide) dans Ionicons. */
const ICONE: Record<NotificationType, ComponentProps<typeof Ionicons>["name"]> = {
  invitation: "person-add-outline",
  join_request: "mail-unread-outline",
  match_challenge: "flash-outline",
  match_update: "time-outline",
  participation_request: "clipboard-outline",
  admin_message: "megaphone-outline",
  team_activity: "people-outline",
  follow_activity: "star-outline",
  booking_request: "calendar-outline",
  booking_answer: "calendar-outline",
  venue_application: "location-outline",
  arbitrage: "flag-outline",
  tribune_comment: "chatbubble-outline",
  offre: "diamond-outline",
};

const heure = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
};

function Ligne({ n, premiere, onPress }: { n: Notification; premiere: boolean; onPress: () => void }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  return (
    <Pressable
      accessibilityRole={n.link ? "link" : "button"}
      accessibilityLabel={`${n.read ? "" : "Non lue, "}${n.title}. ${n.body}`}
      onPress={onPress}
      style={({ pressed }) => [styles.ligne, !premiere && styles.separee, !n.read && styles.nonLue, pressed && styles.presse]}
    >
      <View style={styles.icone}>
        <Ionicons name={ICONE[n.type] ?? "notifications-outline"} size={16} color={couleurs.texteSecondaire} />
      </View>
      <View style={styles.textes}>
        <View style={styles.titreLigne}>
          <Text style={styles.titre} numberOfLines={1}>{n.title}</Text>
          {!n.read ? <View style={styles.point} /> : null}
        </View>
        {/* Le message en entier : c'est ce que la cloche du site tronquait. */}
        {n.body ? <Text style={styles.corps}>{n.body}</Text> : null}
        <View style={styles.meta}>
          <Text style={styles.type}>{LIBELLE_NOTIFICATION[n.type] ?? "Message"}</Text>
          <Text style={styles.heure}>{heure(n.createdAt)}</Text>
        </View>
      </View>
      {n.link ? <Ionicons name="chevron-forward" size={16} color={couleurs.texteDiscret} style={styles.chevron} /> : null}
    </Pressable>
  );
}

/**
 * Le centre de notifications (app/(app)/notifications du site) : combien
 * restent à lire et de quoi tout solder, les filtres qui ont quelque chose à
 * montrer, puis les notifications par jour. Toucher une notification la marque
 * lue et ouvre ce qu'elle annonce : l'écran de l'application quand il existe
 * (un match, une compétition, une équipe), le site sinon.
 */
export default function EcranNotifications() {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const { utilisateur } = useAuth();
  const { notifications, nonLues, marquerLue, toutMarquerLu } = useNotifications();
  const [filtre, setFiltre] = useState<FiltreNotifications>("toutes");

  const filtres = notifications ? filtresDisponibles(notifications) : [];
  // Un filtre vidé (« Non lues » après « Tout marquer lu ») revient à « Toutes ».
  const actif = filtres.some((f) => f.cle === filtre) ? filtre : "toutes";
  const jours = notifications ? joursDesNotifications(notificationsDuFiltre(notifications, actif)) : [];

  function ouvrir(n: Notification) {
    if (!n.read) marquerLue(n.id);
    if (n.link) void ouvrirLeLien(n.link, true);
    else Alert.alert(n.title, n.body);
  }

  let contenu;
  if (!utilisateur) {
    contenu = <EtatVide icone="notifications-off-outline" texte="Connecte-toi pour retrouver tes notifications." />;
  } else if (notifications === null) {
    contenu = <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />;
  } else if (notifications.length === 0) {
    contenu = <EtatVide icone="notifications-outline" texte="Aucune notification pour l'instant." />;
  } else {
    contenu = (
      <>
        {nonLues > 0 ? (
          <View style={styles.resume}>
            <Text style={styles.resumeTexte}>{`${nonLues} NON LUE${nonLues > 1 ? "S" : ""}`}</Text>
            <Pressable accessibilityRole="button" onPress={toutMarquerLu} style={({ pressed }) => [styles.toutLu, pressed && styles.presse]}>
              <Ionicons name="checkmark-done" size={14} color={couleurs.texteSecondaire} />
              <Text style={styles.toutLuTexte}>TOUT MARQUER LU</Text>
            </Pressable>
          </View>
        ) : null}
        {filtres.length > 1 ? <Puces puces={filtres} actif={actif} onChange={setFiltre} /> : null}
        {jours.map((j) => (
          <View key={j.cle} style={styles.jour}>
            <Text style={styles.jourTitre} accessibilityRole="header">{j.titre.toUpperCase()}</Text>
            <View style={styles.cadre}>
              {j.notifications.map((n, i) => <Ligne key={n.id} n={n} premiere={i === 0} onPress={() => ouvrir(n)} />)}
            </View>
          </View>
        ))}
      </>
    );
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTetePage titre="Notifications" />
      <ScrollView contentContainerStyle={styles.contenu}>{contenu}</ScrollView>
    </SafeAreaView>
  );
}

const useStyles = creerStyles((couleurs) => ({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingTop: 16, paddingBottom: 32, gap: 16 },
  chargement: { paddingVertical: 40 },
  resume: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  resumeTexte: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.15), color: couleurs.texteDiscret },
  toutLu: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: couleurs.bordure,
  },
  toutLuTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteSecondaire },
  jour: { gap: 8, paddingHorizontal: 16 },
  jourTitre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.15), color: couleurs.texteDiscret },
  cadre: { backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  ligne: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  separee: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  nonLue: { backgroundColor: couleurs.primaireVoile },
  presse: { backgroundColor: couleurs.surfaceHaute },
  icone: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: couleurs.surfaceHaute, alignItems: "center", justifyContent: "center",
  },
  textes: { flex: 1, minWidth: 0 },
  titreLigne: { flexDirection: "row", alignItems: "center", gap: 8 },
  titre: { flexShrink: 1, fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: couleurs.primaire },
  corps: { marginTop: 2, fontFamily: polices.texte, fontSize: 14, lineHeight: 20, color: couleurs.texteSecondaire },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  type: {
    paddingHorizontal: 6, paddingVertical: 2, fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteSecondaire,
    backgroundColor: couleurs.surfaceHaute,
  },
  heure: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },
  chevron: { marginTop: 8 },
}));
