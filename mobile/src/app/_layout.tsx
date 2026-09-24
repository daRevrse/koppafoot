import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { Outfit_700Bold, Outfit_800ExtraBold, useFonts } from "@expo-google-fonts/outfit";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AccueilProvider, useAccueil } from "~/lib/accueil";
import { AuthProvider, useAuth } from "~/lib/auth";

void SplashScreen.preventAutoHideAsync();

// Les fenêtres de connexion s'ouvrent PAR-DESSUS les onglets.
export const unstable_settings = { anchor: "(tabs)" };

export default function RacineLayout() {
  const [policesPretes] = useFonts({
    Outfit_700Bold, Outfit_800ExtraBold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold,
  });
  return (
    <AuthProvider>
      <AccueilProvider>
        <StatusBar style="dark" />
        <Navigation policesPretes={policesPretes} />
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
      </Stack.Protected>
      <Stack.Protected guard={accueil.vu && !profilManquant && !utilisateur}>
        <Stack.Screen name="connexion" options={fenetre} />
        <Stack.Screen name="inscription" options={fenetre} />
        <Stack.Screen name="mot-de-passe" options={fenetre} />
      </Stack.Protected>
    </Stack>
  );
}
