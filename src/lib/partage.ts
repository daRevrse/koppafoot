// ============================================
// Partager un lien : une seule adresse de référence, un seul geste.
//
// L'ADRESSE ÉTAIT ÉCRITE EN CINQ EXEMPLAIRES — lib/invite-link, lib/email,
// app/sitemap, CompetitionShareCard, la route des invitations manager — et
// une sixième surface, la Tribune, construisait ses liens sur
// `window.location.origin`. Un post copié depuis une préversion Vercel
// portait donc l'adresse de la préversion, qu'on envoyait ensuite sur
// WhatsApp à quelqu'un qui n'y a pas accès.
//
// LE GESTE ÉTAIT ÉCRIT TROIS FOIS, et les trois ne se rattrapaient pas de la
// même façon : l'une ne tentait pas le presse-papier, une autre échouait en
// silence, seule la Tribune connaissait le repli qui marche encore sur les
// navigateurs sans API presse-papier. Tout partage passe maintenant par ici,
// et hérite du meilleur des trois.
//
// LE MOT DE LA FIN AU BOUTON : cette fonction dit ce qui s'est passé, elle
// n'affiche rien. La feuille de partage native se voit d'elle-même, une
// copie silencieuse dans le presse-papier ne se voit pas, et c'est à
// l'appelant — qui sait dans quel coin de l'écran il vit — de le dire.
// ============================================

/** L'origine canonique du produit, celle qu'on ose envoyer à quelqu'un. */
export const APP_URL = "https://www.koppafoot.com";

/**
 * Une adresse partageable, à partir d'un chemin interne.
 *
 * Volontairement PAS `window.location.origin` : ce qu'on partage doit
 * s'ouvrir chez le destinataire, et « localhost:3000 » ou une préversion ne
 * s'ouvrent que chez soi. Les données sont les mêmes en face, l'adresse de
 * production est donc toujours la bonne réponse.
 */
export function lienAbsolu(chemin: string): string {
  return `${APP_URL}${chemin.startsWith("/") ? chemin : `/${chemin}`}`;
}

export type ResultatPartage =
  /** La feuille de partage native s'est ouverte : elle parle d'elle-même. */
  | "partage"
  /** Rien ne s'est ouvert, l'adresse est dans le presse-papier : à dire. */
  | "copie"
  /** Ni l'un ni l'autre : à dire aussi, sinon le bouton a l'air cassé. */
  | "echec";

/** Le repli des navigateurs sans API presse-papier, ou hors contexte sûr. */
function copierAlAncienne(texte: string): boolean {
  try {
    const champ = document.createElement("textarea");
    champ.value = texte;
    champ.style.position = "fixed";
    champ.style.opacity = "0";
    document.body.appendChild(champ);
    champ.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(champ);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copie un texte, en passant par l'API moderne puis par le vieux repli.
 *
 * Exportée parce que « copier le lien » est parfois un geste à part entière,
 * distinct de « partager » : dans la Tribune, les deux cohabitent dans le
 * même menu et ne veulent pas dire la même chose.
 */
export async function copierDansLePressePapier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return copierAlAncienne(texte);
  }
}

/**
 * Partage un lien, par la feuille native si le navigateur en a une, par le
 * presse-papier sinon.
 *
 * À N'APPELER QUE DEPUIS UN CLIC, sans `await` avant : `navigator.share`
 * exige une activation utilisateur fraîche, et la moindre attente asynchrone
 * en amont la consomme — le partage est alors refusé sans que rien ne
 * l'explique. C'est aussi pourquoi `fichier` est un fichier DÉJÀ PRÊT et non
 * une adresse à aller chercher : le télécharger au clic coûterait
 * l'activation, donc le partage.
 */
export async function partagerLien(contenu: {
  title: string;
  text?: string;
  url: string;
  /**
   * Une image à joindre — l'affiche du match. Quand le navigateur sait la
   * prendre, elle part AVEC le message : c'est elle qu'on voit dans un statut
   * WhatsApp, là où un lien seul n'est qu'une ligne bleue.
   */
  fichier?: File | null;
}): Promise<ResultatPartage> {
  const { title, text, url, fichier } = contenu;

  if (typeof navigator !== "undefined" && navigator.share) {
    // L'IMAGE D'ABORD, quand elle est là et que le navigateur l'accepte.
    // `canShare` est la seule façon de le savoir : partager des fichiers est
    // refusé sur la plupart des navigateurs de bureau, et une tentative
    // ratée nous ferait retomber sur le presse-papier alors qu'un partage de
    // lien, lui, aurait marché.
    if (fichier && navigator.canShare?.({ files: [fichier] })) {
      try {
        // L'ADRESSE VA DANS LE TEXTE. Avec un fichier, plusieurs navigateurs
        // ignorent `url` en silence : le lien disparaîtrait du message, et
        // l'affiche renverrait vers nulle part.
        await navigator.share({
          title,
          text: text ? `${text}\n${url}` : url,
          files: [fichier],
        });
        return "partage";
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return "partage";
        // Refus de l'image : on retente sans elle, plutôt que d'abandonner
        // le partage tout entier.
      }
    }

    try {
      await navigator.share({ title, text, url });
      return "partage";
    } catch (err) {
      // Fermer la feuille est un choix, pas une panne : on n'enchaîne pas
      // sur une copie que personne n'a demandée.
      if ((err as DOMException)?.name === "AbortError") return "partage";
      // Tout le reste — pas de contexte sûr, activation perdue, cible
      // indisponible — retombe sur le presse-papier.
    }
  }

  const aCopier = text ? `${text}\n${url}` : url;
  return (await copierDansLePressePapier(aCopier)) ? "copie" : "echec";
}
