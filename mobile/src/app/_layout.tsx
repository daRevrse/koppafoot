import {
  DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, DMSans_900Black,
} from "@expo-google-fonts/dm-sans";
import { Outfit_700Bold, Outfit_900Black, useFonts } from "@expo-google-fonts/outfit";
import { DarkTheme, Stack, ThemeProvider, useRouter, type Theme } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { AccueilProvider, useAccueil } from "~/lib/accueil";
import { AuthProvider, useAuth } from "~/lib/auth";
import { useNotificationTouchee } from "~/lib/notification-touchee";
import { lienDeLaNotification, ouvrirLaNotification, suivreLeJeton } from "~/lib/push";
import { couleurs } from "~/theme";

void SplashScreen.preventAutoHideAsync();

// Les fenêtres de connexion s'ouvrent PAR-DESSUS les onglets.
export const unstable_settings = { anchor: "(tabs)" };

/** Le fond des écrans et des transitions : sans lui, un éclair blanc entre deux écrans. */
const THEME_NAVIGATION: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: couleurs.primaire,
    background: couleurs.fond,
    card: couleurs.fond,
    text: couleurs.texte,
    border: couleurs.bordure,
    notification: couleurs.direct,
  },
};

export default function RacineLayout() {
  const [policesPretes] = useFonts({
    Outfit_700Bold, Outfit_900Black,
    DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, DMSans_900Black,
  });
  return (
    <AuthProvider>
      <AccueilProvider>
        <ThemeProvider value={THEME_NAVIGATION}>
          <StatusBar style="light" />
          <Navigation policesPretes={policesPretes} />
        </ThemeProvider>
      </AccueilProvider>
    </AuthProvider>
  );
}

/**
 * QUI VOIT QUOI, EN TROIS GARDES.
 *
 * 1. L'accueil tant qu'il n'a pas été vu.
 * 2. L'écran profil, et lui seul, pour un compte sans document users/{uid} :
 *    sur le site un compte sans profil est une impasse, ici il ne peut pas exister.
 * 3. Sinon les onglets, et les fenêtres de connexion tant qu'on n'est pas connecté.
 *
 * Une garde qui tombe retire ses écrans de l'historique : une connexion réussie
 * referme donc la fenêtre toute seule, et l'on revient à l'onglet d'où l'on venait.
 */
function Navigation({ policesPretes }: { policesPretes: boolean }) {
  const { chargement, utilisateur, profilManquant } = useAuth();
  const accueil = useAccueil();
  const router = useRouter();
  const pret = policesPretes && !chargement && accueil.pret;

  useEffect(() => {
    if (pret) void SplashScreen.hideAsync();
  }, [pret]);

  // « J'ai déjà un compte » : la connexion s'ouvre une fois l'accueil retiré.
  // Le tour de boucle laisse d'abord la pile appliquer la garde.
  const { vu, suite, oublierSuite } = accueil;
  useEffect(() => {
    if (!vu || !suite) return;
    const t = setTimeout(() => {
      router.push(suite);
      oublierSuite();
    }, 0);
    return () => clearTimeout(t);
  }, [vu, suite, oublierSuite, router]);

  // Le jeton de push de ce téléphone suit le compte connecté (voir lib/push).
  const uid = utilisateur?.uid;
  useEffect(() => (uid ? suivreLeJeton(uid) : undefined), [uid]);

  // UN TOUCHER SUR UNE NOTIFICATION ouvre ce qu'elle annonce : la fiche du
  // match, la page de la compétition ou de l'équipe, dans l'application ; le
  // reste sur le site (voir ouvrirLaNotification) — y compris quand c'est ce
  // toucher qui a lancé l'application. Une réponse n'est ouverte qu'une fois.
  const reponse = useNotificationTouchee();
  const dejaOuverte = useRef<string | null>(null);
  const ecransOuverts = accueil.vu && !profilManquant;
  useEffect(() => {
    if (!pret || !reponse) return;
    const id = reponse.notification.request.identifier;
    const lien = lienDeLaNotification(reponse);
    if (!lien || dejaOuverte.current === id) return;
    dejaOuverte.current = id;
    void ouvrirLaNotification(lien, ecransOuverts);
  }, [pret, reponse, ecransOuverts]);

  if (!pret) return null;

  const fenetre = { presentation: "modal" as const };
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!accueil.vu}>
        <Stack.Screen name="accueil" />
      </Stack.Protected>
      <Stack.Protected guard={accueil.vu && profilManquant}>
        <Stack.Screen name="profil" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={accueil.vu && !profilManquant}>
        <Stack.Screen name="(tabs)" />
        {/* Les fiches de match s'empilent sur les onglets, comme une page. */}
        <Stack.Screen name="match/[cid]/[mid]" />
        <Stack.Screen name="amical/[id]" />
        <Stack.Screen name="competition/[cid]" />
        <Stack.Screen name="equipe/[cid]/[tid]" />
      </Stack.Protected>
      <Stack.Protected guard={accueil.vu && !profilManquant && !utilisateur}>
        <Stack.Screen name="connexion" options={fenetre} />
        <Stack.Screen name="inscription" options={fenetre} />
        <Stack.Screen name="mot-de-passe" options={fenetre} />
      </Stack.Protected>
      {/* Supprimer son compte : seulement connecté ; le compte parti, la garde referme la fenêtre. */}
      <Stack.Protected guard={accueil.vu && !profilManquant && !!utilisateur}>
        <Stack.Screen name="supprimer-compte" options={fenetre} />
      </Stack.Protected>
    </Stack>
  );
}
