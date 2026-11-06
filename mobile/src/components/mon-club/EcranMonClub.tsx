import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { User } from "firebase/auth";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { versHex } from "@/lib/couleurs-equipe";
import type { Team } from "@/types";
import { BarreOnglets } from "~/components/BarreOnglets";
import { Bouton } from "~/components/Bouton";
import { DefilementClavier } from "~/components/DefilementClavier";
import { Ecusson } from "~/components/Ecusson";
import { EtatVide } from "~/components/EtatVide";
import { OngletCandidatures } from "~/components/mon-club/OngletCandidatures";
import { OngletEffectif } from "~/components/mon-club/OngletEffectif";
import { OngletInvitations } from "~/components/mon-club/OngletInvitations";
import { useMonClub, type MonClub } from "~/hooks/useMonClub";
import { useAuth } from "~/lib/auth";
import { prevenir } from "~/lib/confirmer";
import { enregistrerEffectif, type Brouillon } from "~/lib/equipe-firestore";
import { initiales } from "~/lib/initiales";
import { messageDe } from "~/lib/message-erreur";
import { aDesChangements, brouillonDe, candidaturesParEtat, invitationsEnAttente } from "~/lib/mon-club";
import { retourSelection } from "~/lib/retour";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

type Onglet = "effectif" | "candidatures" | "invitations";
const ONGLETS: Onglet[] = ["effectif", "candidatures", "invitations"];

const blanc = (opacite: number) => `rgba(255,255,255,${opacite})`;

/** Plusieurs clubs (les siens, ceux qu'on vous a délégués) : une pastille par club. */
function ChoixDuClub({ equipes, actif, choisir }: { equipes: Team[]; actif: string; choisir: (id: string) => void }) {
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choix}>
      {equipes.map((t) => {
        const on = t.id === actif;
        return (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) retourSelection();
              choisir(t.id);
            }}
            style={[styles.pastille, on && styles.pastilleActive]}
          >
            <Text style={[styles.pastilleTexte, on && styles.pastilleTexteActive]} numberOfLines={1}>{t.name.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** L'en-tête du club, noir comme celui de sa fiche publique, et le chemin vers elle. */
function EnTeteMonClub({ equipe, effectif, proprietaire }: { equipe: Team; effectif: number; proprietaire: boolean }) {
  const styles = useStyles();
  const router = useRouter();
  const couleur = versHex(equipe.color);
  return (
    <View style={styles.entete}>
      <View style={styles.identite}>
        {equipe.logoUrl ? (
          <Ecusson url={equipe.logoUrl} nom={equipe.name} taille={64} />
        ) : (
          <View style={[styles.initiale, couleur ? { backgroundColor: couleur } : null]}>
            <Text style={styles.initialeTexte}>{initiales(equipe.name)}</Text>
          </View>
        )}
        <View style={styles.textes}>
          {equipe.city ? <Text style={styles.ville}>{equipe.city.toUpperCase()}</Text> : null}
          <Text style={styles.nom} numberOfLines={2} accessibilityRole="header">{equipe.name.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.puces}>
        <Text style={styles.puce}>{`${effectif} JOUEUR${effectif > 1 ? "S" : ""}`}</Text>
        {equipe.isRecruiting ? <Text style={[styles.puce, styles.vert]}>RECRUTE</Text> : null}
        {proprietaire ? null : <Text style={styles.puce}>DÉLÉGUÉ</Text>}
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push({ pathname: "/club/[id]", params: { id: equipe.id } })}
        hitSlop={6}
        style={({ pressed }) => [styles.versFiche, pressed && styles.presse]}
      >
        <Text style={styles.versFicheTexte}>VOIR LA FICHE DU CLUB</Text>
        <Ionicons name="chevron-forward" size={14} color={blanc(0.8)} />
      </Pressable>
    </View>
  );
}

/** Le club affiché : ses onglets, et la barre « Enregistrer » quand l'effectif a changé. */
function ClubGere({ club, equipe, utilisateur, monNom }: { club: MonClub; equipe: Team; utilisateur: User; monNom: string }) {
  const styles = useStyles();
  const [onglet, setOnglet] = useState<Onglet>("effectif");
  // Null tant qu'on n'a rien touché : l'effectif suit alors l'équipe en direct.
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const courant = brouillon ?? brouillonDe(equipe);
  const changements = club.peutGerer && aDesChangements(equipe, courant);
  const enAttente = candidaturesParEtat(club.candidatures).enAttente.length;
  const invitees = invitationsEnAttente(club.invitations, equipe.id).length;
  const nomsDeSecours = useMemo(
    () => new Map([[utilisateur.uid, monNom], ...club.nomsDeSecours]),
    [club.nomsDeSecours, utilisateur.uid, monNom],
  );
  const plusieurs = (club.equipes?.length ?? 0) > 1;

  async function enregistrer() {
    setEnregistrement(true);
    try {
      await enregistrerEffectif(equipe.id, courant);
      setBrouillon(null);
    } catch (e) {
      prevenir("Enregistrement impossible", messageDe(e));
    } finally {
      setEnregistrement(false);
    }
  }

  const libelles: Record<Onglet, string> = {
    effectif: "Effectif",
    candidatures: enAttente ? `Candidatures · ${enAttente}` : "Candidatures",
    invitations: invitees ? `Invitations · ${invitees}` : "Invitations",
  };

  return (
    <View style={styles.ecran}>
      <DefilementClavier contentContainerStyle={styles.contenu} stickyHeaderIndices={[plusieurs ? 2 : 1]}>
        {plusieurs && club.equipes ? <ChoixDuClub equipes={club.equipes} actif={equipe.id} choisir={club.choisir} /> : null}
        <EnTeteMonClub equipe={equipe} effectif={equipe.memberIds.length + club.fantomes.length} proprietaire={club.proprietaire} />
        <BarreOnglets onglets={ONGLETS} libelles={libelles} actif={onglet} onChange={setOnglet} />
        {onglet === "effectif" ? (
          <OngletEffectif
            equipe={equipe}
            fantomes={club.fantomes}
            identites={club.identites}
            nomsDeSecours={nomsDeSecours}
            peutGerer={club.peutGerer}
            proprietaire={club.proprietaire}
            utilisateur={utilisateur}
            courant={courant}
            changer={setBrouillon}
          />
        ) : onglet === "candidatures" ? (
          <OngletCandidatures equipe={equipe} candidatures={club.candidatures} peutGerer={club.peutGerer} utilisateur={utilisateur} />
        ) : (
          <OngletInvitations equipe={equipe} invitations={club.invitations} peutGerer={club.peutGerer} />
        )}
      </DefilementClavier>
      {changements ? (
        <View style={styles.barre}>
          <Text style={styles.barreTexte}>MODIFICATIONS EN ATTENTE</Text>
          <View style={styles.barreBoutons}>
            <Bouton titre="Annuler" variante="lien" disabled={enregistrement} onPress={() => setBrouillon(null)} />
            <Bouton titre="Enregistrer" occupe={enregistrement} onPress={() => void enregistrer()} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * L'onglet Évolution d'un manager : le club qu'il gère, et de quoi le tenir
 * sans passer par le site — l'effectif, les candidatures, les invitations.
 */
export function EcranMonClub({ uid }: { uid: string }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const { utilisateur, profil } = useAuth();
  const club = useMonClub(uid);

  if (club.equipes === null) return <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />;
  if (!club.equipe || !utilisateur) {
    return (
      <EtatVide
        icone="briefcase-outline"
        texte="Tu ne diriges pas encore d'équipe. Crée la tienne, ou un organisateur t'invitera à gérer une équipe de sa compétition."
      >
        <Bouton titre="Créer mon équipe" onPress={() => router.push("/creer-equipe")} />
      </EtatVide>
    );
  }
  const monNom = `${profil?.firstName ?? ""} ${profil?.lastName ?? ""}`.trim();
  return <ClubGere key={club.equipe.id} club={club} equipe={club.equipe} utilisateur={utilisateur} monNom={monNom} />;
}

const useStyles = creerStyles((couleurs) => ({
  ecran: { flex: 1 },
  contenu: { paddingBottom: 48 },
  chargement: { paddingVertical: 48 },
  choix: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  pastille: {
    maxWidth: 220, minHeight: 36, paddingHorizontal: 14, justifyContent: "center",
    borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.surface,
  },
  pastilleActive: { borderColor: couleurs.primaire, backgroundColor: couleurs.primaireVoile },
  pastilleTexte: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.1), color: couleurs.texteSecondaire },
  pastilleTexteActive: { color: couleurs.primaire },
  entete: { backgroundColor: "#000", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, gap: 14 },
  identite: { flexDirection: "row", alignItems: "center", gap: 14 },
  initiale: {
    width: 64, height: 64, borderWidth: 1, borderColor: blanc(0.15), backgroundColor: blanc(0.1),
    alignItems: "center", justifyContent: "center",
  },
  initialeTexte: { fontFamily: polices.titre, fontSize: 24, color: "#fff" },
  textes: { flex: 1, minWidth: 0 },
  ville: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.16), color: "#6ee7b7" },
  nom: { marginTop: 4, fontFamily: polices.titre, fontSize: 22, lineHeight: 24, color: "#fff" },
  puces: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 6 },
  puce: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: blanc(0.6) },
  vert: { color: "#6ee7b7" },
  versFiche: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4 },
  versFicheTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: blanc(0.8) },
  presse: { opacity: 0.6 },
  barre: {
    paddingHorizontal: 16, paddingVertical: 10, gap: 6, backgroundColor: couleurs.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  barreTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: couleurs.primaire },
  barreBoutons: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8 },
}));
