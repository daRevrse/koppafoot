import * as WebBrowser from "expo-web-browser";
import { urlDuSite } from "~/lib/config";
import { couleurs } from "~/theme";

/** Une page du site dans le navigateur intégré, jusqu'aux fiches natives des lots suivants. */
export function ouvrirSurLeSite(chemin: string): void {
  void WebBrowser.openBrowserAsync(urlDuSite(chemin), { toolbarColor: couleurs.fond, controlsColor: couleurs.primaire });
}
