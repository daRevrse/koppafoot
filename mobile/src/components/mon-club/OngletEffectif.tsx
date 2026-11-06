import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { User } from "firebase/auth";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LIBELLE_POSTE } from "@/lib/postes";
import type { GhostPlayer, Team } from "@/types";
import { Bouton } from "~/components/Bouton";
import { Avatar } from "~/components/mon-club/Avatar";
import { notifierActiviteEquipe } from "~/lib/equipe-api";
import { retirerMembre, type Brouillon } from "~/lib/equipe-firestore";
import { confirmer, prevenir } from "~/lib/confirmer";
import { messageDe } from "~/lib/message-erreur";
import {
  basculerTitulaire, changerDossard, lignesParPoste, type IdentiteMembre, type LigneEffectif,
} from "~/lib/mon-club";
import { retourSelection } from "~/lib/retour";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

type Props = {
  equipe: Team;
  fantomes: GhostPlayer[];
  identites: Map<string, IdentiteMembre>;
  nomsDeSecours: Map<string, string>;
  peutGerer: boolean;
  proprietaire: boolean;
  utilisateur: User;
  /** Le brouillon des dossards et des titulaires : l'écran le tient, sa barre « Enregistrer » reste à l'écran. */
  courant: Brouillon;
  changer: (b: Brouillon) => void;
};

/** Ce qu'on lit sous le nom : le poste, et ce qui distingue la ligne. */
function sousTitre(l: LigneEffectif): string {
  const morceaux = [
    l.manager ? "Manager" : null,
    l.poste ? LIBELLE_POSTE[l.poste] : null,
    l.genre === "fantome" ? "Sans compte" : null,
    l.staff ? "Staff" : null,
    l.titulaire && !l.manager ? "Titulaire" : null,
  ];
  return morceaux.filter(Boolean).join(" · ");
}

/**
 * L'effectif d'un club, tel que le manager le tient : les dossards, les
 * titulaires, les départs, les joueurs sans compte. Dossards et titulaires ne
 * partent qu'avec « Enregistrer » (la barre de l'écran) ; un retrait part tout
 * de suite, après confirmation.
 */
export function OngletEffectif({
  equipe, fantomes, identites, nomsDeSecours, peutGerer, proprietaire, utilisateur, courant, changer,
}: Props) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const [retrait, setRetrait] = useState<string | null>(null);
  const groupes = lignesParPoste(equipe, identites, fantomes, courant, nomsDeSecours);

  async function retirer(l: LigneEffectif) {
    if (l.staff && !proprietaire) {
      prevenir("Retrait réservé", `Seul le propriétaire du club peut retirer ${l.nom}, qui est du staff.`);
      return;
    }
    const oui = await confirmer({
      titre: `Retirer ${l.nom} ?`,
      message: `${l.nom} quittera l'effectif de ${equipe.name}${l.staff ? ", et son staff" : ""}.`,
      action: "Retirer",
    });
    if (!oui) return;
    setRetrait(l.id);
    try {
      await retirerMembre(equipe, l.id, utilisateur.uid);
      notifierActiviteEquipe(utilisateur, { teamId: equipe.id, event: "member_left", playerId: l.id });
    } catch (e) {
      prevenir("Retrait impossible", messageDe(e));
    } finally {
      setRetrait(null);
    }
  }

  const versFantome = (ghostId?: string) =>
    router.push({ pathname: "/joueur-sans-compte", params: ghostId ? { teamId: equipe.id, ghostId } : { teamId: equipe.id } });

  return (
    <View style={styles.colonne}>
      {groupes.map((g) => (
        <View key={g.titre} style={styles.groupe}>
          <Text style={styles.titreGroupe}>{`${g.titre.toUpperCase()} · ${g.lignes.length}`}</Text>
          {g.lignes.map((l) => (
            <View key={`${l.genre}-${l.id}`} style={styles.ligne}>
              <Avatar nom={l.nom} photo={l.photo} />
              <View style={styles.textes}>
                <Text style={styles.nom} numberOfLines={1}>{l.nom}</Text>
                <Text style={styles.sous} numberOfLines={1}>{sousTitre(l)}</Text>
              </View>

              {l.genre === "fantome" ? (
                <>
                  {l.dossard ? (
                    <Text style={[styles.numero, l.dossardPris && styles.numeroPris]}>
                      {l.dossardPris ? `N°${l.dossard} PRIS` : `N°${l.dossard}`}
                    </Text>
                  ) : null}
                  {peutGerer ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Modifier ${l.nom}`}
                      hitSlop={6}
                      onPress={() => versFantome(l.id)}
                      style={({ pressed }) => [styles.icone, pressed && styles.presse]}
                    >
                      <Ionicons name="create-outline" size={18} color={couleurs.texteSecondaire} />
                    </Pressable>
                  ) : null}
                </>
              ) : peutGerer ? (
                <>
                  <TextInput
                    accessibilityLabel={`Dossard de ${l.nom}`}
                    value={l.dossard}
                    onChangeText={(v) => changer(changerDossard(courant, l.id, v))}
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholder="N°"
                    placeholderTextColor={couleurs.texteDiscret}
                    selectionColor={couleurs.primaire}
                    style={styles.dossard}
                  />
                  {l.manager ? null : (
                    <>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel={`${l.nom} titulaire`}
                        aria-checked={l.titulaire}
                        hitSlop={6}
                        onPress={() => {
                          retourSelection();
                          changer(basculerTitulaire(courant, l.id));
                        }}
                        style={[styles.titulaire, l.titulaire && styles.titulaireOn]}
                      >
                        <Ionicons name="checkmark" size={16} color={l.titulaire ? couleurs.surBouton : "transparent"} />
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Retirer ${l.nom}`}
                        disabled={retrait === l.id}
                        hitSlop={6}
                        onPress={() => void retirer(l)}
                        style={({ pressed }) => [styles.icone, (pressed || retrait === l.id) && styles.presse]}
                      >
                        <Ionicons name="person-remove-outline" size={18} color={couleurs.direct} />
                      </Pressable>
                    </>
                  )}
                </>
              ) : l.dossard ? (
                <Text style={styles.numero}>{`N°${l.dossard}`}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}

      {groupes.length <= 1 && fantomes.length === 0 ? (
        <Text style={styles.vide}>
          Personne dans l&apos;effectif pour l&apos;instant. Invite des joueurs, ou ajoute ceux qui n&apos;ont pas de téléphone.
        </Text>
      ) : null}

      {peutGerer ? <Bouton titre="Ajouter un joueur sans compte" variante="contour" onPress={() => versFantome()} /> : null}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  colonne: { paddingHorizontal: 16, paddingTop: 16, gap: 20 },
  groupe: { gap: 0 },
  titreGroupe: {
    fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: couleurs.texteDiscret,
    marginBottom: 8,
  },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure, marginTop: -StyleSheet.hairlineWidth,
  },
  textes: { flex: 1, minWidth: 0, gap: 2 },
  nom: { fontFamily: polices.texteGras, fontSize: 15, color: couleurs.texte },
  sous: { fontFamily: polices.texte, fontSize: 12, color: couleurs.texteDiscret },
  numero: { fontFamily: polices.texteNoir, fontSize: 12, letterSpacing: espacement(12, 0.05), color: couleurs.texteSecondaire },
  numeroPris: { color: couleurs.accent },
  dossard: {
    width: 52, height: 40, borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.surfaceHaute,
    textAlign: "center", fontFamily: polices.texteNoir, fontSize: 15, color: couleurs.texte, padding: 0,
  },
  titulaire: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: couleurs.bordureForte,
    alignItems: "center", justifyContent: "center",
  },
  titulaireOn: { backgroundColor: couleurs.bouton, borderColor: couleurs.bouton },
  icone: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  presse: { backgroundColor: couleurs.surfaceHaute },
  vide: { fontFamily: polices.texte, fontSize: 14, lineHeight: 21, color: couleurs.texteSecondaire },
}));
