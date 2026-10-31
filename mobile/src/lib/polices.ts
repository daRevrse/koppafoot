import {
  DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, DMSans_900Black,
} from "@expo-google-fonts/dm-sans";
import { Outfit_700Bold, Outfit_900Black, useFonts } from "@expo-google-fonts/outfit";

/**
 * Les polices sont-elles prêtes ? L'écran de lancement les attend. Une police qui
 * ne charge pas compte comme prête : mieux vaut ouvrir l'application avec celle
 * du téléphone que de rester pour toujours sur l'écran de lancement.
 */
export function usePolicesPretes(): boolean {
  const [chargees, erreur] = useFonts({
    Outfit_700Bold, Outfit_900Black,
    DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, DMSans_900Black,
  });
  return chargees || erreur !== null;
}
