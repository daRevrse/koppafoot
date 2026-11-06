import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { versHex } from "@/lib/couleurs-equipe";
import { CATEGORIES, LIBELLES_CATEGORIE, type Categorie } from "@/lib/genre";
import { ErreurLimiteOffre } from "@/lib/offre";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { EcranAuth, useStylesAuth } from "~/components/EcranAuth";
import { Pastilles } from "~/components/mon-club/Pastilles";
import { useAuth } from "~/lib/auth";
import { creerEquipe, type ChampsEquipe } from "~/lib/equipe-api";
import { messageDe } from "~/lib/message-erreur";
import { erreursEquipe } from "~/lib/mon-club";
import { retourSelection } from "~/lib/retour";
import { creerStyles, espacement, polices } from "~/theme";

// Le formulaire de création du site (app/(app)/teams), champ pour champ.
const NIVEAUX = [
  { valeur: "beginner", libelle: "Débutant" },
  { valeur: "amateur", libelle: "Amateur" },
  { valeur: "intermediate", libelle: "Intermédiaire" },
  { valeur: "advanced", libelle: "Avancé" },
] as const;
const OPTIONS_CATEGORIE = CATEGORIES.map((c) => ({ valeur: c, libelle: LIBELLES_CATEGORIE.fr[c] }));
const COULEURS = [
  { valeur: "emerald", libelle: "Vert" },
  { valeur: "blue", libelle: "Bleu" },
  { valeur: "red", libelle: "Rouge" },
  { valeur: "amber", libelle: "Jaune" },
  { valeur: "purple", libelle: "Violet" },
  { valeur: "orange", libelle: "Orange" },
] as const;

function ChoixCouleur({ valeur, onChange }: { valeur: string; onChange: (c: string) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.bloc}>
      <Text style={styles.etiquette}>COULEUR</Text>
      <View style={styles.couleurs} accessibilityRole="radiogroup" accessibilityLabel="Couleur">
        {COULEURS.map((c) => {
          const on = c.valeur === valeur;
          return (
            <Pressable
              key={c.valeur}
              accessibilityRole="radio"
              accessibilityLabel={c.libelle}
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (!on) retourSelection();
                onChange(c.valeur);
              }}
              style={[styles.anneau, on && styles.anneauActif]}
            >
              <View style={[styles.pastille, { backgroundColor: versHex(c.valeur) ?? "#10b981" }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Créer son équipe, depuis l'application. Le serveur vérifie le rôle et la
 * limite de l'offre ; son refus s'affiche tel qu'il l'écrit. Créée, l'équipe
 * apparaît dans l'onglet au retour.
 */
export default function EcranCreerEquipe() {
  const stylesAuth = useStylesAuth();
  const router = useRouter();
  const { utilisateur, profil } = useAuth();
  const [champs, setChamps] = useState<ChampsEquipe>({
    name: "",
    city: profil?.locationCity ?? "",
    level: "amateur",
    category: (profil?.gender === "female" ? "women" : "men") as Categorie,
    color: "emerald",
    description: "",
    maxMembers: 14,
  });
  const [joueursMax, setJoueursMax] = useState("14");
  const [essaye, setEssaye] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<{ message: string; limite: boolean } | null>(null);

  const erreurs = essaye ? erreursEquipe(champs) : {};
  const modifier = (c: Partial<ChampsEquipe>) => setChamps((avant) => ({ ...avant, ...c }));

  async function creer() {
    setEssaye(true);
    if (!utilisateur || Object.keys(erreursEquipe(champs)).length > 0) return;
    setOccupe(true);
    setErreur(null);
    try {
      await creerEquipe(utilisateur, {
        ...champs,
        name: champs.name.trim(),
        city: champs.city.trim(),
        description: champs.description.trim(),
      });
      router.back();
    } catch (e) {
      setErreur({ message: messageDe(e, "La création de l'équipe a échoué."), limite: e instanceof ErreurLimiteOffre });
      setOccupe(false);
    }
  }

  return (
    <EcranAuth titre="Créer mon équipe" phrase="Le nom et la ville suffisent pour commencer ; le reste se change ensuite.">
      <Champ
        etiquette="Nom de l'équipe"
        value={champs.name}
        onChangeText={(name) => modifier({ name })}
        placeholder="FC Koppa"
        autoCapitalize="words"
        maxLength={90}
        erreur={erreurs.name}
      />
      <Champ
        etiquette="Ville"
        value={champs.city}
        onChangeText={(city) => modifier({ city })}
        placeholder="Lomé"
        autoCapitalize="words"
        maxLength={90}
        erreur={erreurs.city}
      />
      <Pastilles etiquette="Niveau" options={NIVEAUX} valeur={champs.level as (typeof NIVEAUX)[number]["valeur"]} onChange={(level) => modifier({ level })} />
      <Pastilles etiquette="Catégorie" options={OPTIONS_CATEGORIE} valeur={champs.category} onChange={(category) => modifier({ category })} />
      <ChoixCouleur valeur={champs.color} onChange={(color) => modifier({ color })} />
      <Champ
        etiquette="Joueurs max"
        value={joueursMax}
        onChangeText={(v) => {
          const chiffres = v.replace(/\D/g, "").slice(0, 2);
          setJoueursMax(chiffres);
          modifier({ maxMembers: Number(chiffres) || 0 });
        }}
        keyboardType="number-pad"
        maxLength={2}
        erreur={erreurs.maxMembers}
      />
      <Champ
        etiquette="Description"
        value={champs.description}
        onChangeText={(description) => modifier({ description })}
        placeholder="Décris ton équipe…"
        multiline
        maxLength={1000}
        style={{ minHeight: 96, textAlignVertical: "top" }}
      />
      {erreur ? <Text style={stylesAuth.erreur}>{erreur.message}</Text> : null}
      {erreur?.limite ? <Bouton titre="Voir KoppaFoot+" variante="contour" onPress={() => router.push("/offre")} /> : null}
      <Bouton titre="Créer l'équipe" occupe={occupe} onPress={() => void creer()} />
      <Bouton titre="Annuler" variante="lien" onPress={() => router.back()} />
    </EcranAuth>
  );
}

const useStyles = creerStyles((couleurs) => ({
  bloc: { gap: 6 },
  etiquette: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteDiscret },
  couleurs: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  anneau: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "transparent",
    alignItems: "center", justifyContent: "center",
  },
  anneauActif: { borderColor: couleurs.texte },
  pastille: { width: 32, height: 32, borderRadius: 16 },
}));
