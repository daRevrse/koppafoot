import type { Metadata, Viewport } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";
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
// matches the device exactly — CSS width, CSS height AND pixel ratio. Anything
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
  rel: "apple-touch-startup-image",
  url: `/splash/splash-${w * dpr}x${h * dpr}.jpg`,
  media:
    `(device-width: ${w}px) and (device-height: ${h}px)` +
    ` and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));

export const metadata: Metadata = {
  title: "KoppaFoot",
  description: "La plateforme qui connecte les passionnés de football",
  // icon and apple have to be repeated here: declaring `icons` at all makes
  // this block win over the file convention, and setting only `other` dropped
  // the icon.png and apple-icon.png links (the home-screen icon on iOS). The
  // routes themselves still come from src/app/{icon,apple-icon}.png.
  icons: {
    icon: [{ url: "/icon.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    other: appleLaunchImages,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KoppaFoot",
  },
  applicationName: "KoppaFoot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${outfit.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          <Suspense fallback={null}>
            <TopLoadingBar />
          </Suspense>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { borderRadius: "8px", fontSize: "14px" },
            }}
          />
        </AuthProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
