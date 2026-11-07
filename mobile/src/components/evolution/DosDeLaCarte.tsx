import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import type { Genre } from "@/lib/genre";
import { nomDuPoste, POSTES } from "@/lib/postes";
import type { EvolutionRole } from "@/types";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { DefilementClavier } from "~/components/DefilementClavier";
import { useAuth } from "~/lib/auth";
import { prevenir } from "~/lib/confirmer";
import { activerLeRole } from "~/lib/direct-firestore";
import { creerEquipe } from "~/lib/equipe-api";
import { equipesQueJeGere } from "~/lib/equipe-firestore";
import { messageDe } from "~/lib/message-erreur";
import { PRESENTATION } from "~/lib/pile-des-roles";
import { retourImpact } from "~/lib/retour";
import { equipeDeLActivation, patchDActivation, ROLES, type ChampsDActivation } from "~/lib/roles";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

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
  const styles = useStyles();
  return (
    <View style={styles.pastilles}>
      {options.map((o) => {
        const on = valeur === o.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            aria-checked={on}
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

function Etiquette({ children }: { children: string }) {
  const styles = useStyles();
  return <Text style={styles.etiquette}>{children.toUpperCase()}</Text>;
}

/**
 * Le dos de la carte du rôle : le formulaire d'activation (celui du
 * ChoixDuRole du site). Il écrit dans le compte ce que le site écrit, et
 * seulement ce que les règles laissent au titulaire ; un manager qui nomme
 * son équipe la voit créée. Le titre se pose sur le bandeau de la couleur du
 * rôle ; les champs gardent les couleurs du thème.
 */
export function DosDeLaCarte({ role, onRetour }: { role: EvolutionRole; onRetour: () => void }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const { utilisateur, profil, rafraichirProfil } = useAuth();
  const [genre, setGenre] = useState<Genre | null>(profil?.gender ?? null);
  const [genreManquant, setGenreManquant] = useState(false);
  const [poste, setPoste] = useState(profil?.position ?? "");
  const [pied, setPied] = useState<string>(profil?.strongFoot ?? "");
  const [equipe, setEquipe] = useState(profil?.teamName ?? "");
  const [licence, setLicence] = useState(profil?.licenseLevel ?? "");
  const [numero, setNumero] = useState(profil?.licenseNumber ?? "");
  const [ville, setVille] = useState(profil?.locationCity ?? "");
  const [villeManquante, setVilleManquante] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  // Deux touchers avant que l'écran ne se redessine ne font qu'une activation.
  const enCours = useRef(false);

  const meta = ROLES.find((r) => r.role === role) ?? ROLES[0];
  const { profond } = PRESENTATION[role].couleurs;

  async function activer() {
    if (!utilisateur || enCours.current) return;
    if (!genre) {
      setGenreManquant(true);
      return;
    }
    // L'équipe nommée sera créée, et le serveur refuse une équipe sans ville.
    if (role === "manager" && equipe.trim() && !ville.trim()) {
      setVilleManquante(true);
      return;
    }
    const champs: ChampsDActivation = { genre, ville, poste, pied, equipe, licence, numero };
    enCours.current = true;
    setEnvoi(true);
    try {
      await activerLeRole(utilisateur.uid, patchDActivation(role, champs));
    } catch {
      Alert.alert("Une erreur est survenue", "Ton rôle n'a pas été activé. Réessaie dans un instant.");
      enCours.current = false;
      setEnvoi(false);
      return;
    }
    // AVANT de relire le profil : l'onglet Manager qui s'ouvre doit trouver l'équipe.
    if (role === "manager") await creerLEquipeNommee(champs);
    retourImpact();
    // Le profil relu, l'onglet prend le nom du rôle et montre sa fiche.
    await rafraichirProfil();
  }

  /**
   * L'équipe que le manager a nommée, créée par la route du site (lib/roles,
   * equipeDeLActivation). Le rôle est déjà activé : un échec ici le dit, sans
   * le défaire ; l'équipe se crée ensuite depuis l'onglet Manager.
   */
  async function creerLEquipeNommee(champs: ChampsDActivation) {
    if (!utilisateur) return;
    const dejaGerees = await equipesQueJeGere(utilisateur.uid).then((l) => l.map((t) => t.name)).catch(() => []);
    const issue = equipeDeLActivation("manager", champs, dejaGerees);
    if (issue.genre !== "creer") return;
    try {
      await creerEquipe(utilisateur, issue.champs);
    } catch (e) {
      prevenir(
        "Ton rôle est activé, pas ton équipe",
        `${messageDe(e, "La création de l'équipe a échoué.")} Tu pourras la créer depuis l'onglet Manager.`,
      );
    }
  }

  return (
    <View style={styles.dos}>
      <View style={[styles.bandeau, { backgroundColor: profond }]}>
        <Text style={styles.formulaire} accessibilityRole="header">{meta.formulaire.toUpperCase()}</Text>
        <Text style={styles.sousTitre}>Tout se modifie plus tard dans ton profil.</Text>
      </View>

      <DefilementClavier contentContainerStyle={styles.colonne}>
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

        {role === "player" ? (
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
        {role === "referee" ? (
          <>
            <View style={styles.champ}>
              <Etiquette>Niveau de licence</Etiquette>
              <Pastilles options={LICENCES} valeur={licence} onChange={setLicence} />
            </View>
            <Champ etiquette="Numéro de licence (facultatif)" value={numero} onChangeText={setNumero} placeholder="ex : TG-2024-0182" autoCapitalize="characters" />
            <Text style={styles.note}>
              {"Personne ne vérifie ce numéro aujourd'hui : il sert aux organisateurs qui te contactent, pas à te valider."}
            </Text>
          </>
        ) : null}
        {role === "manager" ? (
          <>
            <Champ etiquette="Nom de ton équipe (facultatif)" value={equipe} onChangeText={setEquipe} placeholder="ex : FC Étoile" />
            <Text style={styles.note}>
              {"Nommée ici, ton équipe est créée avec ton rôle. Pas d'équipe ? Un organisateur pourra t'inviter à gérer une équipe de sa compétition."}
            </Text>
          </>
        ) : null}
        <Champ
          etiquette="Ta ville"
          value={ville}
          onChangeText={(v) => {
            setVille(v);
            setVilleManquante(false);
          }}
          placeholder="Ta ville"
          erreur={villeManquante ? "Ta ville est nécessaire pour créer ton équipe." : null}
        />

        <Bouton titre={`Activer mon ${meta.espace.toLowerCase()}`} occupe={envoi} onPress={() => void activer()} />

        <Pressable accessibilityRole="button" onPress={onRetour} hitSlop={8} style={styles.retour}>
          <Ionicons name="arrow-back" size={14} color={couleurs.texteSecondaire} />
          <Text style={styles.retourTexte}>Retour</Text>
        </Pressable>
      </DefilementClavier>
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  dos: { flex: 1, backgroundColor: couleurs.surface },
  bandeau: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, gap: 4 },
  formulaire: { fontFamily: polices.titre, fontSize: 22, color: "#FFFFFF" },
  sousTitre: { fontFamily: polices.texte, fontSize: 13, color: "rgba(255,255,255,0.8)" },
  colonne: { gap: 14, padding: 16, paddingBottom: 24 },
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
  retour: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "center", paddingVertical: 6 },
  retourTexte: { fontFamily: polices.texteNoir, fontSize: 12, color: couleurs.texteSecondaire },
}));
