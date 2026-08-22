import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Outfit, DM_Sans } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LangueProvider } from "@/i18n";
import { CLE_LANGUE, langueDepuisCookie } from "@/i18n/config";
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
  themeColor: "#059669",
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
  // No `icons` block: src/app/{favicon.ico,icon.png,apple-icon.png} come from
  // the file convention, and declaring `icons` at all makes this object win
  // over it, which is how the apple-touch-icon went missing when the launch
  // images were (wrongly) hung off `icons.other`.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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
            __html: `(function(){try{var c=localStorage.getItem("koppafoot:theme");var d=c?c==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;r.dataset.theme=d?"dark":"light";}catch(e){}})();`,
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
      </body>
    </html>
  );
}
