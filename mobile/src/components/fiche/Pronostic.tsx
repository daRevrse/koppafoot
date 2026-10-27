import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { EMPTY_COUNTS, pourcentages, type Pick, type PredictionCounts } from "@/lib/pronostics-shared";
import { Ecusson } from "~/components/Ecusson";
import { BarreRepartition, TexteDeSegment, type SegmentRepartition } from "~/components/fiche/BarreRepartition";
import { useAuth } from "~/lib/auth";
import type { Fiche } from "~/lib/fiche-match";
import { comptesDesPronostics, monPronostic, pronostiquer } from "~/lib/interactions-match";
import { retourImpact } from "~/lib/retour";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

/**
 * « Qui gagne ? » (components/match/PredictionPoll) : trois segments, et
 * leurs parts dès le premier vote. Un compte, un pronostic, modifiable
 * jusqu'au coup d'envoi ; après, la barre ne fait plus que montrer.
 */
export function Pronostic({ fiche }: { fiche: Fiche }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const { utilisateur } = useAuth();
  const router = useRouter();
  const uid = utilisateur?.uid ?? null;
  const ferme = fiche.statut !== "scheduled";
  const [comptes, setComptes] = useState<PredictionCounts | null>(null);
  const [lu, setLu] = useState<{ uid: string; pick: Pick | null } | null>(null);
  const [envoi, setEnvoi] = useState<Pick | null>(null);

  useEffect(() => {
    let vivant = true;
    void comptesDesPronostics(fiche.id).then((c) => {
      if (vivant) setComptes(c);
    });
    return () => {
      vivant = false;
    };
  }, [fiche.id]);

  useEffect(() => {
    if (!uid) return;
    let vivant = true;
    void monPronostic(fiche.id, uid).then((pick) => {
      if (vivant) setLu({ uid, pick });
    });
    return () => {
      vivant = false;
    };
  }, [fiche.id, uid]);
  // Le pronostic lu appartient au compte qui l'a lu : déconnecté, il n'y en a plus.
  const mien = uid && lu?.uid === uid ? lu.pick : null;

  async function voter(pick: Pick) {
    if (ferme || envoi || pick === mien) return;
    if (!uid) {
      router.push({ pathname: "/connexion", params: { raison: "pronostic" } });
      return;
    }
    retourImpact();
    setEnvoi(pick);
    try {
      await pronostiquer(fiche.id, uid, pick);
      setLu({ uid, pick });
      setComptes(await comptesDesPronostics(fiche.id));
    } catch {
      // Refusé (session expirée) ou perdu : on le dit, et le choix affiché reste l'ancien.
      Alert.alert("Ton pronostic n'est pas passé", "Réessaie dans un instant.");
    } finally {
      setEnvoi(null);
    }
  }

  const chiffres = (comptes?.total ?? 0) > 0;
  // Clos sans un seul vote : rien à montrer (le site fait de même).
  if (comptes !== null && ferme && !chiffres) return null;

  const parts = pourcentages(comptes ?? EMPTY_COUNTS);
  const issues = [
    { cle: "home" as const, nom: fiche.domicile.nom, logo: fiche.domicile.logo, pct: parts.home, libelle: `Victoire de ${fiche.domicile.nom}` },
    { cle: "draw" as const, nom: "Nul", logo: null, pct: parts.draw, libelle: "Match nul" },
    { cle: "away" as const, nom: fiche.exterieur.nom, logo: fiche.exterieur.logo, pct: parts.away, libelle: `Victoire de ${fiche.exterieur.nom}` },
  ];
  const max = Math.max(...issues.map((i) => i.pct));
  const enTete = issues.filter((i) => i.pct === max);
  const enAvant = chiffres && enTete.length === 1 ? enTete[0].cle : null;

  const segments: SegmentRepartition[] = issues.map((i) => {
    const vert = enAvant === i.cle;
    return {
      cle: i.cle,
      pct: i.pct,
      libelle: chiffres ? `${i.libelle}, ${i.pct} %` : i.libelle,
      haut: (
        <>
          {chiffres && i.cle !== "draw" ? <Ecusson url={i.logo} nom={i.nom} taille={14} /> : null}
          <View style={styles.hautTexte}>
            <TexteDeSegment vert={vert}>{i.nom.toUpperCase()}</TexteDeSegment>
          </View>
          {mien === i.cle ? <Ionicons name="checkmark" size={12} color={vert ? "#04150d" : couleurs.texte} /> : null}
        </>
      ),
      bas: envoi === i.cle
        ? <ActivityIndicator size="small" color={vert ? "#04150d" : couleurs.texte} />
        : chiffres
          ? `${i.pct}%`
          : i.cle === "draw" ? "=" : <Ecusson url={i.logo} nom={i.nom} taille={20} />,
    };
  });

  const consigne = ferme ? "Clos au coup d'envoi" : mien ? "Modifiable jusqu'au coup d'envoi" : "Touche ton pronostic";

  return (
    <View style={styles.cadre}>
      <View style={styles.entete}>
        <Text style={styles.titre}>{ferme ? "PRONOSTICS" : "QUI GAGNE ?"}</Text>
        <Text style={styles.consigne} numberOfLines={1}>{consigne}</Text>
      </View>
      {comptes === null ? (
        <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />
      ) : (
        <BarreRepartition
          libelle="Pronostics du match"
          segments={segments}
          enAvant={enAvant}
          choisi={mien}
          onChoisir={ferme ? undefined : (cle) => void voter(cle as Pick)}
          occupe={envoi !== null}
          largeursEgales={!chiffres}
        />
      )}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  cadre: { marginHorizontal: 16, padding: 16, backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  entete: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  titre: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), color: couleurs.texteDiscret },
  consigne: { flexShrink: 1, fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },
  chargement: { paddingVertical: 24 },
  hautTexte: { flexShrink: 1 },
}));
