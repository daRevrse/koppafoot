import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Outfit, DM_Sans } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/next";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LangueProvider } from "@/i18n";
import { CLE_LANGUE, langueDepuisCookie } from "@/i18n/config";
import { APP_URL } from "@/lib/partage";
import { AuthModalProvider } from "@/components/auth/AuthModal";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import TopLoadingBar from "@/components/ui/TopLoadingBar";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // LA BARRE D'ETAT SUIT LE HEADER, devenu blanc. La valeur ci-dessous ne
  // sert qu'au premier rendu : ThemeContext réécrit cette balise à chaque
  // bascule (voir COULEUR_BARRE), et c'est là que vit la vraie table.
  //
  // UNE SEULE VALEUR, PAS UNE PAIRE `media`. Une paire ferait émettre deux
  // balises `theme-color`, et le `querySelector` de ThemeContext ne trouve
  // que la première : en sombre, il écrirait la couleur dans la balise
  // marquée « light », que le navigateur ignore alors.
  themeColor: "#ffffff",
  viewportFit: "cover",
};

// ============================================
// iOS launch images.
//
// A standalone PWA on iOS shows a startup image only when the media query
// matches the device exactly, CSS width, CSS height AND pixel ratio. Anything
// else and Safari ignores the tag and opens on a blank white screen, which is
// why this is a table of every current device rather than one image.
//
// Android takes no custom image at all: Chrome builds its splash from the
// manifest's name, background_color and 512px icon. `background_color` is set
// to the artwork's own background so the two platforms land in the same place.
// ============================================
const IOS_LAUNCH_DEVICES: ReadonlyArray<readonly [number, number, number]> = [
  [320, 568, 2], [375, 667, 2], [414, 736, 3], [375, 812, 3],
  [414, 896, 2], [414, 896, 3], [390, 844, 3], [360, 780, 3],
  [428, 926, 3], [393, 852, 3], [430, 932, 3], [402, 874, 3], [440, 956, 3],
  [768, 1024, 2], [834, 1112, 2], [834, 1194, 2], [820, 1180, 2], [1024, 1366, 2],
];

const appleLaunchImages = IOS_LAUNCH_DEVICES.map(([w, h, dpr]) => ({
  url: `/splash/splash-${w * dpr}x${h * dpr}.jpg`,
  media:
    `(device-width: ${w}px) and (device-height: ${h}px)` +
    ` and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));

export const metadata: Metadata = {
  title: "KoppaFoot",
  description: "La plateforme qui connecte les passionnés de football",

  // ============================================
  // CE QUE VOIT CELUI À QUI ON ENVOIE UN LIEN.
  //
  // Le produit se propage par le partage — on envoie un match, une
  // compétition, l'appli elle-même — et jusqu'ici le document n'émettait
  // qu'un `<title>` et une `description`. Collé dans WhatsApp, le lien
  // donnait une ligne de texte gris sans vignette, ce qui, dans un fil de
  // conversation, ne se distingue pas d'un lien douteux.
  //
  // `metadataBase` D'ABORD : sans elle, toute image d'aperçu déclarée en
  // chemin relatif se résout sur localhost, c'est-à-dire nulle part pour le
  // destinataire.
  //
  // PAS D'`images` ICI, VOLONTAIREMENT. La convention de fichier
  // (app/opengraph-image.tsx, et celle des segments qui la surchargent)
  // fournit l'image ; la déclarer aussi dans cet objet la ferait gagner
  // partout et écraserait, par exemple, l'affiche générée d'un match.
  // ============================================
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: "website",
    siteName: "KoppaFoot",
    locale: "fr_FR",
    title: "KoppaFoot",
    description: "La plateforme qui connecte les passionnés de football",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "KoppaFoot",
    description: "La plateforme qui connecte les passionnés de football",
  },
  // No `icons` block: src/app/{favicon.ico,icon.png,apple-icon.png} come from
  // the file convention, and declaring `icons` at all makes this object win
  // over it, which is how the apple-touch-icon went missing when the launch
  // images were (wrongly) hung off `icons.other`.
  appleWebApp: {
    capable: true,
    // `default` ET NON `black-translucent`. Le translucide fait commencer la
    // vue web SOUS l'horloge, en texte blanc : c'etait juste tant que le
    // header etait vert nuit, ca rend l'heure et la batterie invisibles sur
    // un header blanc. `default` rend la bande a iOS, qui y met un texte
    // lisible selon l'apparence du systeme.
    statusBarStyle: "default",
    title: "KoppaFoot",
    startupImage: appleLaunchImages,
  },
  other: {
    // Next only emits the standardised `mobile-web-app-capable`, which Safari
    // did not understand before 17.4. Without the Apple-prefixed one an
    // iPhone opens the app in a browser view instead of standalone, and iOS
    // shows a launch image only in standalone, which is why the splash never
    // appeared. Kept alongside, not instead of.
    "apple-mobile-web-app-capable": "yes",
  },
  applicationName: "KoppaFoot",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // La langue est lue ICI, sur le serveur, et pas dans le navigateur. Le
  // texte rendu doit etre le meme des deux cotes, sinon chaque phrase de la
  // page clignote au chargement le temps que React corrige l'ecart.
  const cookiesStore = await cookies();
  const langue = langueDepuisCookie(cookiesStore.get(CLE_LANGUE)?.value);

  return (
    <html
      lang={langue}
      className={`${outfit.variable} ${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Le theme AVANT la premiere peinture.

            Un thème posé par React arrive après le premier rendu : la page
            s'affiche en clair, puis vire au sombre. Cet éclair blanc est
            exactement ce qu'un thème sombre existe pour éviter, et il n'y a
            pas d'autre moyen de le supprimer que ce script bloquant, minuscule,
            en tête de document.

            Il lit le choix enregistré, et à défaut le réglage du système. */}
        <script
          dangerouslySetInnerHTML={{
            // Pose AUSSI `theme-color`. ThemeContext le fait a chaque bascule,
            // mais pas au demarrage : un appareil ouvert en sombre gardait donc
            // la couleur de barre du theme clair jusqu'a ce qu'on aille changer
            // de theme a la main. Les deux valeurs suivent COULEUR_BARRE.
            __html: `(function(){try{var c=localStorage.getItem("koppafoot:theme");var d=c?c==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;r.dataset.theme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"#101714":"#ffffff");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <ThemeProvider>
        <LangueProvider langue={langue}>
        <AuthProvider>
          <AuthModalProvider>
            <Suspense fallback={null}>
              <TopLoadingBar />
            </Suspense>
            {children}
          </AuthModalProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { borderRadius: "8px", fontSize: "14px" },
            }}
          />
        </AuthProvider>
        </LangueProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
        <Analytics />
      </body>
    </html>
  );
}
