import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, type ComponentProps } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { Genre } from "@/lib/genre";
import { nomDuPoste, POSTES } from "@/lib/postes";
import type { EvolutionRole } from "@/types";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { useAuth } from "~/lib/auth";
import { activerLeRole } from "~/lib/direct-firestore";
import { retourImpact } from "~/lib/retour";
import { nomDuRole, patchDActivation, ROLES } from "~/lib/roles";
import { couleurs, espacement, polices } from "~/theme";

const ICONE: Record<EvolutionRole, ComponentProps<typeof Ionicons>["name"]> = {
  player: "person-outline",
  manager: "briefcase-outline",
  referee: "flag-outline",
};
const PIEDS = [{ value: "right", label: "Droit" }, { value: "left", label: "Gauche" }, { value: "both", label: "Les deux" }];
const LICENCES = [
  { value: "trainee", label: "Stagiaire" }, { value: "regional", label: "Régional" },
  { value: "national", label: "National" }, { value: "international", label: "International" },
];

function Pastilles({ options, valeur, onChange, erreur = false }: {
  options: { value: string; label: string }[];
  valeur: string;
  onChange: (v: string) => void;
  erreur?: boolean;
}) {
  return (
    <View style={styles.pastilles}>
      {options.map((o) => {
        const on = valeur === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={[styles.pastille, on && styles.pastilleActive, erreur && styles.pastilleErreur]}
          >
            <Text style={[styles.pastilleTexte, on && styles.pastilleTexteActif]}>{o.label.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const Etiquette = ({ children }: { children: string }) => <Text style={styles.etiquette}>{children.toUpperCase()}</Text>;

/**
 * Le choix du rôle (ChoixDuRole du site) : trois cartes — joueur, manager,
 * arbitre —, puis le formulaire du rôle choisi. Il écrit dans le compte ce
 * que le site écrit, et seulement ce que les règles laissent au titulaire.
 * Sans compte, une carte mène à l'inscription.
 */
export function ChoixDuRole() {
  const router = useRouter();
  const { utilisateur, profil, rafraichirProfil } = useAuth();
  const [choisi, setChoisi] = useState<EvolutionRole | null>(null);
  const [genre, setGenre] = useState<Genre | null>(profil?.gender ?? null);
  const [genreManquant, setGenreManquant] = useState(false);
  const [poste, setPoste] = useState(profil?.position ?? "");
  const [pied, setPied] = useState<string>(profil?.strongFoot ?? "");
  const [equipe, setEquipe] = useState(profil?.teamName ?? "");
  const [licence, setLicence] = useState(profil?.licenseLevel ?? "");
  const [numero, setNumero] = useState(profil?.licenseNumber ?? "");
  const [ville, setVille] = useState(profil?.locationCity ?? "");
  const [envoi, setEnvoi] = useState(false);

  const meta = ROLES.find((r) => r.role === choisi) ?? null;

  async function activer() {
    if (!choisi || !utilisateur || !meta) return;
    if (!genre) {
      setGenreManquant(true);
      return;
    }
    setEnvoi(true);
    try {
      await activerLeRole(utilisateur.uid, patchDActivation(choisi, { genre, ville, poste, pied, equipe, licence, numero }));
      retourImpact();
      // Le profil relu, l'onglet prend le nom du rôle et montre sa fiche.
      await rafraichirProfil();
    } catch {
      Alert.alert("Une erreur est survenue", "Ton rôle n'a pas été activé. Réessaie dans un instant.");
      setEnvoi(false);
    }
  }

  if (!meta) {
    return (
      <View style={styles.colonne}>
        <Text style={styles.intro}>
          {utilisateur ? "Choisis ton rôle sur KoppaFoot." : "Joueur, manager, arbitre : crée ton compte pour choisir ton rôle."}
        </Text>
        {ROLES.map((r) => (
          <Pressable
            key={r.role}
            accessibilityRole="button"
            onPress={() => {
              if (!utilisateur) {
                router.push({ pathname: "/connexion", params: { raison: "role" } });
                return;
              }
              setChoisi(r.role);
            }}
            style={({ pressed }) => [styles.carte, pressed && styles.presse]}
          >
            <View style={styles.icone}>
              <Ionicons name={ICONE[r.role]} size={22} color={couleurs.primaire} />
            </View>
            <View style={styles.textes}>
              <Text style={styles.titre}>{nomDuRole(r.titre, profil?.gender).toUpperCase()}</Text>
              <Text style={styles.phrase}>{r.phrase}</Text>
            </View>
            <Text style={styles.choisir}>CHOISIR</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.colonne}>
      <Pressable accessibilityRole="button" onPress={() => setChoisi(null)} hitSlop={8} style={styles.retour}>
        <Ionicons name="arrow-back" size={14} color={couleurs.texteSecondaire} />
        <Text style={styles.retourTexte}>CHANGER DE RÔLE</Text>
      </Pressable>
      <View>
        <Text style={styles.formulaire}>{meta.formulaire.toUpperCase()}</Text>
        <Text style={styles.phrase}>Tout se modifie plus tard dans ton profil.</Text>
      </View>

      <View style={styles.champ}>
        <Etiquette>Tu es</Etiquette>
        <Pastilles
          options={[{ value: "male", label: "Homme" }, { value: "female", label: "Femme" }]}
          valeur={genre ?? ""}
          onChange={(v) => {
            setGenre(v as Genre);
            setGenreManquant(false);
          }}
          erreur={genreManquant}
        />
        {genreManquant ? <Text style={styles.erreur}>Dis-nous si tu es un homme ou une femme : les compétitions en dépendent.</Text> : null}
      </View>

      {choisi === "player" ? (
        <>
          <View style={styles.champ}>
            <Etiquette>Poste</Etiquette>
            <Pastilles options={POSTES.map((p) => ({ value: p, label: nomDuPoste(p, "fr", genre) }))} valeur={poste} onChange={setPoste} />
          </View>
          <View style={styles.champ}>
            <Etiquette>Pied fort</Etiquette>
            <Pastilles options={PIEDS} valeur={pied} onChange={setPied} />
          </View>
        </>
      ) : null}
      {choisi === "referee" ? (
        <>
          <View style={styles.champ}>
            <Etiquette>Niveau de licence</Etiquette>
            <Pastilles options={LICENCES} valeur={licence} onChange={setLicence} />
          </View>
          <Champ etiquette="Numéro de licence (facultatif)" value={numero} onChangeText={setNumero} placeholder="ex : TG-2024-0182" autoCapitalize="characters" />
          <Text style={styles.note}>Personne ne vérifie ce numéro aujourd&apos;hui : il sert aux organisateurs qui te contactent, pas à te valider.</Text>
        </>
      ) : null}
      {choisi === "manager" ? (
        <>
          <Champ etiquette="Nom de ton équipe (facultatif)" value={equipe} onChangeText={setEquipe} placeholder="ex : FC Étoile" />
          <Text style={styles.note}>Pas d&apos;équipe ? Un organisateur pourra t&apos;inviter à gérer une équipe de sa compétition.</Text>
        </>
      ) : null}
      <Champ etiquette="Ta ville" value={ville} onChangeText={setVille} placeholder="Ta ville" />

      <Bouton titre={`Activer mon ${meta.espace.toLowerCase()}`} occupe={envoi} onPress={() => void activer()} />
    </View>
  );
}

const styles = StyleSheet.create({
  colonne: { gap: 14, padding: 16 },
  intro: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },
  carte: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
    backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  presse: { backgroundColor: couleurs.surfaceHaute },
  icone: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: couleurs.primaireVoile },
  textes: { flex: 1, minWidth: 0, gap: 3 },
  titre: { fontFamily: polices.titre, fontSize: 18, color: couleurs.texte },
  phrase: { fontFamily: polices.texte, fontSize: 13, color: couleurs.texteSecondaire },
  choisir: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.primaire },
  retour: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  retourTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteSecondaire },
  formulaire: { fontFamily: polices.titre, fontSize: 22, color: couleurs.texte, marginBottom: 4 },
  champ: { gap: 8 },
  etiquette: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteDiscret },
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pastille: { paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: couleurs.bordure },
  pastilleActive: { backgroundColor: couleurs.texte, borderColor: couleurs.texte },
  pastilleErreur: { borderColor: couleurs.erreur },
  pastilleTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteSecondaire },
  pastilleTexteActif: { color: couleurs.fond },
  erreur: { fontFamily: polices.texte, fontSize: 12, color: couleurs.erreur },
  note: { marginTop: -6, fontFamily: polices.texte, fontSize: 12, color: couleurs.texteDiscret },
});
