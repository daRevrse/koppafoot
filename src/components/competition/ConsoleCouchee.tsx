"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { RotateCw, Smartphone } from "lucide-react";

// ============================================
// LA CONSOLE, COUCHÉE DANS UN ÉCRAN DEBOUT.
//
// POURQUOI ON NE DEMANDE PAS À L'APPAREIL DE TOURNER. Le manifeste déclare
// l'application `orientation: "portrait"`, et sur un téléphone où KoppaFoot
// est installé depuis l'écran d'accueil, cette ligne verrouille TOUT : aucune
// page ne tourne, et iOS n'offre aucun moyen d'en déverrouiller une seule
// (`screen.orientation.lock` n'y existe pas). La console ne peut donc pas
// demander le paysage — elle se DESSINE couchée, et l'utilisateur tourne son
// téléphone. C'est ce que font les jeux, et pour la même raison.
//
// CE QUI REND LA CHOSE SÛRE ICI, et qui casse ailleurs : ce projet n'a AUCUN
// portail. Toutes les modales de la console sont écrites dans l'arbre React,
// en `fixed inset-0`. Or un `transform` sur un ancêtre fait de lui le bloc
// conteneur de ses descendants `fixed` : elles épousent donc la console
// couchée au lieu de rester dans le repère de l'appareil. Le test de
// positionnement l'a confirmé au pixel, et `elementFromPoint` au centre de
// l'écran tombe bien sur la modale — le TACTILE SUIT LA ROTATION, c'est
// l'hypothèse qui porte tout le reste.
//
// CE QUI NE TOURNE PAS, parce que le natif ignore le CSS : les boîtes du
// navigateur (`window.confirm`, un `<select>` déroulé) et tout ce qui vit
// hors de cet arbre — le `Toaster` de l'application, monté dans le layout
// racine. Ils apparaissent dans le repère de l'appareil, donc de travers.
// C'est la raison pour laquelle la console remplace ses appels natifs.
//
// QUAND LE VIEWPORT EST DÉJÀ COUCHÉ — tablette, navigateur de bureau, ou un
// appareil dont la rotation n'est pas verrouillée — on ne tourne rien : le
// contenu est déjà dans le bon sens, et le faire pivoter le mettrait de côté.
// Le même dessin sert les deux cas.
// ============================================

/** Dans quel sens l'utilisateur a tourné son téléphone. */
type Sens = "antihoraire" | "horaire";

const CLE_SENS = "koppafoot:console-sens";
const CLE_CONSIGNE_VUE = "koppafoot:console-consigne";

/**
 * Lit une préférence d'appareil, sans jamais jeter.
 *
 * Le stockage local est refusé en navigation privée et par certains réglages
 * de confidentialité, où le simple accès lève. Une console qui refuse de
 * s'ouvrir parce qu'elle n'a pas pu lire dans quel sens on tient le téléphone
 * serait une console cassée pour une préférence.
 */
function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: string) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* Tant pis : la préférence ne survivra pas à la session. */
  }
}

/**
 * LES DEUX SENS, ET CE QU'ILS FONT DE L'ENCOCHE.
 *
 * L'ENCOCHE EST LE PIÈGE DE LA ROTATION. `env(safe-area-inset-top)` désigne le
 * haut de l'APPAREIL, et l'appareil, lui, ne tourne pas : cette valeur
 * continue de décrire l'encoche quand la console a pivoté. Il faut donc la
 * reporter sur le bord de la console qui coïncide avec ce haut d'appareil.
 *
 *   antihoraire : on tourne le téléphone vers la gauche. Le haut de l'appareil
 *     part à gauche, donc le bord GAUCHE de la console longe l'encoche, et son
 *     bord DROIT longe la barre d'accueil (ou les boutons de navigation).
 *   horaire : le miroir exact.
 *
 * Cette table a été vérifiée bord par bord dans un navigateur, et non déduite :
 * une bande témoin posée sur chacun des quatre bords de la console, et la
 * mesure de l'endroit où elle atterrit à l'écran.
 *
 * LES MARGES SONT SÉPARÉES, ET PAS UN RACCOURCI `padding`. La boîte ne les
 * absorbe plus en rembourrage : elle RÉTRÉCIT d'autant et se décale. C'est ce
 * qui distingue une console qui évite l'encoche d'une console qui la
 * recouvre, car tout ce qui se pose PAR-DESSUS elle — ses modales en
 * `fixed inset-0`, son bouton de demi-tour — prend pour repère la boîte, pas
 * son rembourrage. En rembourrage, les deux tombaient sous l'encoche ; c'est
 * mesuré, pas supposé.
 */
const SENS: Record<
  Sens,
  { rotation: string; haut: string; droite: string; bas: string; gauche: string }
> = {
  antihoraire: {
    rotation: "rotate(90deg) translateY(-100%)",
    haut: "env(safe-area-inset-right, 0px)",
    droite: "env(safe-area-inset-bottom, 0px)",
    bas: "env(safe-area-inset-left, 0px)",
    gauche: "env(safe-area-inset-top, 0px)",
  },
  horaire: {
    rotation: "rotate(-90deg) translateX(-100%)",
    haut: "env(safe-area-inset-left, 0px)",
    droite: "env(safe-area-inset-top, 0px)",
    bas: "env(safe-area-inset-right, 0px)",
    gauche: "env(safe-area-inset-bottom, 0px)",
  },
};

/**
 * Deux valeurs que React ne possede pas : la forme du viewport et ce que
 * l'appareil a retenu.
 *
 * `useSyncExternalStore` plutot qu'un effet qui pose l'etat : un effet
 * s'execute APRES la premiere peinture, donc la console se dessinerait une
 * frame droite avant de pivoter — et poser l'etat depuis un effet est
 * precisement ce que le projet interdit (react-hooks/set-state-in-effect).
 * Ici la source de verite est dehors, et ce hook est fait pour ca.
 */
function abonnementEcran(rafraichir: () => void) {
  window.addEventListener("resize", rafraichir);
  window.addEventListener("orientationchange", rafraichir);
  return () => {
    window.removeEventListener("resize", rafraichir);
    window.removeEventListener("orientationchange", rafraichir);
  };
}

/** Le stockage local ne change pas tout seul : rien a ecouter. */
const AUCUN_ABONNEMENT = () => () => {};

export default function ConsoleCouchee({ children }: { children: ReactNode }) {
  // `null` cote serveur : il ne connait pas la taille de l'ecran, et deviner
  // ferait diverger son rendu de celui du navigateur.
  const debout = useSyncExternalStore(
    abonnementEcran,
    () => window.innerHeight > window.innerWidth,
    () => null,
  );

  const sensRetenu = useSyncExternalStore(
    AUCUN_ABONNEMENT,
    () => lire(CLE_SENS),
    () => null,
  );
  const consigneDejaVue = useSyncExternalStore(
    AUCUN_ABONNEMENT,
    () => lire(CLE_CONSIGNE_VUE) !== null,
    () => true,
  );

  // Ce que l'utilisateur change PENDANT la session prime sur ce qui etait
  // retenu ; les deux sont poses par un geste, jamais par un effet.
  const [sensChoisi, setSensChoisi] = useState<Sens | null>(null);
  const [consigneEcartee, setConsigneEcartee] = useState(false);

  const sens: Sens = sensChoisi ?? (sensRetenu === "horaire" ? "horaire" : "antihoraire");
  const consigne = debout === true && !consigneDejaVue && !consigneEcartee;

  // La console prend l'ecran : la page derriere ne defile plus. Sans ca, un
  // geste qui rate une pastille fait glisser la page sous la console.
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, []);

  const retourner = useCallback(() => {
    setSensChoisi((choisi) => {
      const actuel = choisi ?? (lire(CLE_SENS) === "horaire" ? "horaire" : "antihoraire");
      const suivant: Sens = actuel === "antihoraire" ? "horaire" : "antihoraire";
      ecrire(CLE_SENS, suivant);
      return suivant;
    });
  }, []);

  const consigneVue = useCallback(() => {
    setConsigneEcartee(true);
    ecrire(CLE_CONSIGNE_VUE, "1");
  }, []);

  // Le fond de la console, le temps de la mesure : un cadre vide plutôt qu'une
  // console dessinée droite qu'on ferait pivoter à la frame suivante.
  if (debout === null) {
    return <div className="fixed inset-0 z-[75] bg-[#0b1512]" aria-hidden />;
  }

  const m = SENS[sens];
  const boite = debout
    ? {
        // La boîte fait l'écran MOINS les marges, et se décale d'autant :
        // `translate` vient en DERNIER dans la composition, donc il s'applique
        // en premier, dans le repère de la boîte — c'est-à-dire celui de la
        // console, avant que la rotation ne la couche.
        width: `calc(100dvh - ${m.gauche} - ${m.droite})`,
        height: `calc(100dvw - ${m.haut} - ${m.bas})`,
        transformOrigin: "top left" as const,
        transform: `${m.rotation} translate(${m.gauche}, ${m.haut})`,
        /**
         * LA HAUTEUR DE LA CONSOLE, POUR CE QU'ELLE CONTIENT.
         *
         * `vh` et `dvh` designent la hauteur de l'APPAREIL, qui ne tourne pas.
         * Couchee, la hauteur de la console est la LARGEUR de l'appareil : une
         * modale bornee a `55vh` reclamait donc 55 % de 852 px dans une boite
         * qui en fait 393, debordait, et ses cartes s'etiraient. Vu sur un
         * vrai telephone.
         *
         * Cette variable est posee EN LIGNE et non par une feuille de style :
         * elle descend par heritage a tout ce que la console contient, et ne
         * traverse aucun pipeline CSS. Hors console elle n'existe pas, et le
         * repli `100dvh` de chaque usage redonne le comportement d'avant.
         */
        "--console-h": `calc(100dvw - ${m.haut} - ${m.bas})`,
      } as React.CSSProperties
    : {
        // Viewport déjà couché : les marges de l'appareil sont déjà les
        // bonnes, rien à permuter.
        inset:
          "env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) " +
          "env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)",
        "--console-h":
          "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
      } as React.CSSProperties;

  return (
    <>
      {/* `fixed inset-0` sur le CONTENEUR : la console sort ainsi de la marge
          de <main> et passe par-dessus l'en-tête et la barre du bas, sans que
          le shell ait à savoir qu'elle existe. z-75 : au-dessus de la barre
          (50) et de sa feuille (70). Les modales de la console, en z-80, se
          rangent À L'INTÉRIEUR de ce cadre — le `transform` en fait un
          contexte d'empilement — et c'est exactement ce qu'on veut. */}
      {/* CE QUI VIT HORS DE LA CONSOLE ET DOIT TOURNER AVEC ELLE : LES TOASTS.
          Ils sont montés dans le layout racine, donc hors de la boîte tournée
          — le `transform` ne les atteint pas, et ils s'affichaient à l'endroit
          sur un écran qu'on regarde de côté. Or la console ne parle que par
          eux : « But », « Changement effectué », « 3 remplacements maximum ».

          ON N'EN MONTE PAS UN SECOND. Deux `Toaster` rendent tous les deux la
          même pile et reportent tous les deux la hauteur de chaque toast dans
          le même magasin : celui qu'on cacherait annoncerait zéro, et
          l'empilement de l'autre partirait de travers. C'est donc CELUI QUI
          EXISTE qui tourne, avec la géométrie d'ici.

          LA RÈGLE VOYAGE AVEC LE COMPOSANT plutôt que de vivre dans la
          feuille globale. D'abord parce qu'elle n'a de sens que pendant que
          cette console est à l'écran, et qu'elle disparaît donc avec elle.
          Ensuite parce qu'elle consomme une géométrie qui est définie
          quinze lignes plus haut : les séparer, c'était s'engager à les
          modifier ensemble.

          `!important` parce que react-hot-toast pose ces propriétés en style
          en ligne sur son propre conteneur, et qu'aucune spécificité ne bat
          un style en ligne — seule une déclaration importante le fait. */}
      {debout && (
        <style>{`.toasts-app{inset:0 auto auto 0!important;width:${boite.width}!important;height:${boite.height}!important;transform-origin:top left;transform:${boite.transform};}`}</style>
      )}

      <div className="fixed inset-0 z-[75] overflow-hidden bg-[#0b1512]">
        <div style={boite} className="absolute left-0 top-0 overflow-hidden">
          {children}
          {debout && (
            // LE DEMI-TOUR. On ne peut pas savoir dans quel sens quelqu'un a
            // tourné son téléphone : l'appareil n'en dit rien tant que sa
            // rotation est verrouillée, et le demander (DeviceOrientation)
            // coûte une autorisation iOS pour une question de confort. Un
            // bouton, une fois, et l'appareil s'en souvient.
            <button
              type="button"
              onClick={retourner}
              aria-label="Retourner la console"
              className="absolute bottom-1 left-1 flex h-7 w-7 items-center justify-center text-white/25 transition-colors hover:text-white/70"
            >
              <RotateCw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* LA CONSIGNE EST LA SEULE CHOSE QUI NE TOURNE PAS, et c'est voulu :
          elle se lit AVANT d'avoir tourné le téléphone. Tout le reste de la
          console serait illisible à ce moment-là — c'est bien le problème
          qu'elle annonce. */}
      {consigne && (
        <button
          type="button"
          onClick={consigneVue}
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingRight: "env(safe-area-inset-right, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            paddingLeft: "env(safe-area-inset-left, 0px)",
          }}
          className="fixed inset-0 z-[85] flex flex-col items-center justify-center gap-5 bg-[#0b1512] px-8 text-center"
        >
          <Smartphone size={40} className="animate-pulse text-emerald-400" strokeWidth={1.5} />
          <span className="font-display text-xl font-black uppercase leading-tight tracking-tight text-white">
            Tourne ton téléphone
          </span>
          <span className="max-w-xs text-sm leading-relaxed text-white/60">
            La console se tient à l&apos;horizontale : les deux équipes y sont côte à côte,
            chacune de son côté du terrain.
          </span>
          <span className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
            Touche pour continuer
          </span>
        </button>
      )}
    </>
  );
}
