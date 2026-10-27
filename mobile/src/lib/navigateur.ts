import * as WebBrowser from "expo-web-browser";
import { urlDuSite } from "~/lib/config";
import { couleurs } from "~/theme";

/** Une page du site dans le navigateur intégré, jusqu'aux fiches natives des lots suivants. */
export function ouvrirSurLeSite(chemin: string): void {
  void WebBrowser.openBrowserAsync(urlDuSite(chemin), { toolbarColor: couleurs.fond, controlsColor: couleurs.primaire });
}

/** Un article d'Actus chez son éditeur, dans le même navigateur intégré : on revient d'un geste. */
export function ouvrirChezLEditeur(url: string): void {
  void WebBrowser.openBrowserAsync(url, { toolbarColor: couleurs.fond, controlsColor: couleurs.primaire });
}
