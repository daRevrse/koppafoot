"use client";

import { usePathname } from "next/navigation";
import ScoreHeader from "./ScoreHeader";
import RightRail, { routeOwnsItsRail } from "./rail/RightRail";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import PullToRefresh from "@/components/layout/PullToRefresh";
import PushNotificationSetup from "@/components/PushNotificationSetup";
import PWAInstallFloating from "@/components/pwa/PWAInstallFloating";

// ============================================
// ScoreShell, the chrome of the product, everywhere.
//
// One band, and that is the whole point: where the old shell spent a column
// on the left, this spends a single row on top. The trending ticker and the
// role sub-nav that briefly sat above and below it are gone, three stacked
// bands ate the fold on a phone for navigation nobody used twice. What they
// carried now lives in the nav row and the account menu (see ScoreHeader).
//
// It wraps every group, public app, organizer and moderator, so entering
// one does not change the furniture.
//
// Kept from that shell: the mobile tab bar (the habit already learned on a
// phone), pull-to-refresh and the push plumbing.
//
// L'invitation à installer vit ici, et pas dans une page : l'entrée du menu
// compte répond à qui la cherche, celle-ci s'adresse à qui n'y a pas pensé.
// Elle attend, se ferme, et se tait un mois — voir PWAInstallFloating.
//
// The Tribune rail is gone, but its column is not: the same 320px stays open
// on the right. Letting the content spread into it would have re-flowed every
// page in the product to chase a rail we removed, and a reading column that
// wide is worse, not better. The Tribune page mirrors this gutter on its left
// so it sits centred rather than shoved aside.
//
// That column is no longer empty: RightRail fills it per route (see there).
// Pages without a module leave it open and silent.
//
// `showTribune={false}` closes the gutter for management screens, which
// need the horizontal room for tables and brackets.
//
// LA FICHE D'UN MATCH GARDE LE HAUT DE L'ÉCRAN POUR ELLE, sur téléphone. Son
// tableau d'affichage se replie en une barre collante qui porte déjà le
// retour et la cloche : le header de l'app, empilé au-dessus, faisait trois
// bandes en haut d'un écran de téléphone, et le repli se jouait sous lui
// plutôt qu'au bord de l'écran. La navigation reste dans la barre du bas. Au-
// dessus de `lg` le header ne bouge pas : il y porte la navigation et la
// recherche, que rien d'autre ne porte.
//
// LES MARGES DE PAGE, RÉSERVÉES AUX ANNONCES. Le contenu allait d'un bord à
// l'autre de l'écran alors que le header, lui, s'arrête à LARGEUR_PAGE : sur
// un grand écran la barre du haut était rentrée et tout ce qui suivait
// débordait dessous, désaligné. Les deux largeurs sont désormais LA MÊME, et
// le décalage disparaît.
//
// Ce qui reste de part et d'autre, au-delà de cette largeur, est la place des
// annonces — rien n'y est encore posé. En dessous, il n'y a aucune marge :
// prendre de la place sur un écran de portable coûterait au contenu ce
// qu'aucune annonce ne rendrait.
// ============================================

/**
 * La largeur de la page, partagée avec le header.
 *
 * Elle vit en Tailwind des deux côtés (`max-w-[1600px]`) : une classe ne se
 * construit pas à la volée, l'outil ne compile que ce qu'il lit tel quel dans
 * les sources. Le chiffre est donc écrit deux fois, et ce commentaire est le
 * lien entre les deux.
 */
const LARGEUR_PAGE = "max-w-[1600px]";

/** La fiche d'un match, amical ou de compétition — pas sa console. */
function estUneFicheMatch(pathname: string): boolean {
  return /^\/matches\/[^/]+$/.test(pathname) || /^\/c\/[^/]+\/matches\/[^/]+$/.test(pathname);
}

export default function ScoreShell({
  children,
  showTribune = true,
}: {
  children: React.ReactNode;
  showTribune?: boolean;
}) {
  const pathname = usePathname();
  // Une page qui porte son propre rail ne doit pas, en plus, reserver celui
  // du shell : on aurait deux colonnes pour une seule.
  const gutter = showTribune && !routeOwnsItsRail(pathname);

  return (
    <div className="flex min-h-screen flex-col">
      <PushNotificationSetup />
      <PWAInstallFloating />
      <ScoreHeader masqueSurMobile={estUneFicheMatch(pathname)} />

      {/* Le fond de page descend sur CE conteneur-ci, et non plus sur le seul
          <main> : sinon les marges des deux côtés gardaient le fond du body,
          deux bandes le long d'un contenu qui n'a pas la même couleur
          qu'elles. Il est réécrit en thème sombre (voir styles/dark.css), la
          page reste donc d'une seule teinte dans les deux thèmes. */}
      <div className="flex min-w-0 flex-1 justify-center bg-[#F4F6FA]">
        <div className={`flex w-full min-w-0 flex-1 ${LARGEUR_PAGE}`}>
          {/* `overflow-x-clip` et non `hidden` : `hidden` fait de <main> un
              conteneur de defilement, ce qui empeche tout `position: sticky`
              a l'interieur de se caler sur la fenetre, le hero d'une page
              competition passait sous le header au lieu de s'y arreter.
              `clip` coupe le debordement sans creer ce conteneur. */}
          <main className="main-content-app min-w-0 flex-1 overflow-x-clip bg-[#F4F6FA] p-3 lg:p-5">
            <PullToRefresh>{children}</PullToRefresh>
          </main>
          {/* `empty:hidden` : un module de rail qui rend `null`, rien a montrer
              sur cette page, laissait sinon une colonne blanche de 320px. Le
              shell ne peut pas savoir a l'avance si RightRail produira quelque
              chose, mais le CSS le voit apres coup. */}
          {gutter && (
            <aside className="hidden w-80 flex-shrink-0 overflow-y-auto px-5 py-5 empty:hidden xl:block">
              <RightRail />
            </aside>
          )}
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
}
