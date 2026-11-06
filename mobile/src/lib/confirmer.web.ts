// La version web d'Expo (aperçus, essais de bout en bout) : Alert de React
// Native n'y fait rien, les boîtes du navigateur le remplacent.

export function confirmer(q: { titre: string; message: string; action: string }): Promise<boolean> {
  return Promise.resolve(window.confirm(q.message ? `${q.titre}\n\n${q.message}` : q.titre));
}

export function prevenir(titre: string, message: string): void {
  window.alert(message ? `${titre}\n\n${message}` : titre);
}
