// Le lien du site qui vient d'ouvrir l'application (voir app/+native-intent), le
// temps que son écran puisse s'ouvrir. Il arrive hors de React, au lancement
// avant même le premier rendu ; et l'écran attend que l'accueil soit passé et le
// profil rempli (voir _layout).

let retenu: string | null = null;
const ecouteurs = new Set<() => void>();
const prevenir = () => ecouteurs.forEach((ecouteur) => ecouteur());

export function retenirLeLien(lien: string): void {
  retenu = lien;
  prevenir();
}

/** Oublier prévient aussi : le même lien touché une deuxième fois doit se voir. */
export function oublierLeLien(): void {
  retenu = null;
  prevenir();
}

export function lienRetenu(): string | null {
  return retenu;
}

export function ecouterLesLiens(ecouteur: () => void): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}
