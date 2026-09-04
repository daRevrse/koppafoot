"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_REDIRECTS } from "@/types";
import { isOrganizer, isSuperAdmin } from "@/lib/hats";
import { contexteAuth } from "@/config/auth-contextes";
import { LignesDeTerrain } from "@/components/ui/socle";

// ============================================
// L'écran d'authentification.
//
// DEUX COLONNES, ET C'EST LA GAUCHE QUI CHANGE. Le produit a quatre portes
// d'entrée — le direct, MyFields, Organize, Score — et elles ne promettent
// pas la même chose. Arriver par « référencer mon terrain » et lire
// « Connecte-toi pour accéder à ton espace » sur un aplat gris fait douter
// d'avoir cliqué au bon endroit, au moment précis où il ne faut pas douter.
//
// Le panneau porte donc la marque de la section d'où l'on vient (voir
// config/auth-contextes) ; le formulaire, lui, est le même pour tout le
// monde. Une seule mécanique, plusieurs visages.
//
// LE PAPIER PEINT A DISPARU. Il superposait à l'artwork du splash un voile
// `rgba(244,246,250,0.78)` écrit en dur — une valeur claire que le thème
// sombre ne peut pas réécrire, puisqu'elle ne passe par aucune classe. En
// sombre, le fond de la connexion restait donc lumineux sous un texte prévu
// pour le noir. Le marquage de terrain le remplace : il ne vit que sur les
// surfaces déjà sombres, où les deux thèmes rendent à l'identique.
// ============================================

function PanneauSection() {
  const params = useSearchParams();
  const ctx = contexteAuth(params.get("for"));

  return (
    // LE PANNEAU N'EXISTE PAS SUR TÉLÉPHONE. Il y occupait 252px sur 812,
    // c'est-à-dire le tiers de l'écran, pour redire une marque que le titre
    // du formulaire porte déjà — « Référencer un terrain » dit MyFields
    // aussi bien que le panneau. Sur un écran étroit, la place va au geste :
    // on vient ici pour se connecter, pas pour lire une accroche.
    <aside className="relative hidden overflow-hidden bg-gray-900 text-white lg:block lg:min-h-screen">
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
      <LignesDeTerrain className="text-white/[0.07]" />

      <div className="relative flex h-full flex-col justify-between px-12 py-14">
        <Link href="/" className="w-fit">
          <Image
            src="/branding/logo_full_name.png"
            alt="KOPPAFOOT"
            width={150}
            height={40}
            style={{ height: "auto" }}
            className="brightness-0 invert"
            priority
          />
        </Link>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
            {ctx.marque}
          </p>
          <p className="mt-3 max-w-md font-display text-4xl font-black uppercase leading-[0.9] tracking-[-0.02em] lg:text-5xl">
            {ctx.accroche}
          </p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
            {ctx.promesse}
          </p>
        </div>

        {ctx.retour ? (
          <Link
            href={ctx.retour.href}
            className="flex w-fit items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-white/50 transition-colors hover:text-white"
          >
            ← Retour à {ctx.retour.label}
          </Link>
        ) : (
          <span aria-hidden />
        )}
      </div>
    </aside>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Un compte déjà connecté repart vers son espace, ou vers la cible `?next=`
  // du lien qui l'a amené ici (les invitations rebondissent par la connexion).
  //
  // LE DÉTOUR SUIT LA CASQUETTE, PLUS LE TYPE DE COMPTE. `ROLE_REDIRECTS`
  // envoyait l'administrateur sur /admin et l'organisateur sur /organizer
  // parce que « superadmin » et « organizer » étaient des valeurs de
  // `user_type`. Ce sont des drapeaux maintenant, et un organisateur qui joue
  // porte `user_type: "player"` : lire la table seule l'aurait renvoyé au
  // Direct, en lui faisant chercher son espace à la main à chaque connexion.
  useEffect(() => {
    if (!loading && user) {
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      const parCasquette = isSuperAdmin(user) ? "/admin" : isOrganizer(user) ? "/organizer" : null;
      router.replace(safeNext ?? parCasquette ?? ROLE_REDIRECTS[user.userType] ?? "/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
        <div className="relative h-8 w-8 animate-spin border-2 border-white/20 border-t-emerald-400" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* `Suspense` parce que le panneau lit `?for=` : sans lui, Next refuse
          de rendre l'arbre au moment de la génération. Le repli porte le même
          `hidden lg:block`, sans quoi un aplat sombre apparaîtrait en haut des
          téléphones le temps de la résolution. */}
      <Suspense fallback={<div className="hidden bg-gray-900 lg:block lg:min-h-screen" />}>
        <PanneauSection />
      </Suspense>

      <main className="flex flex-col items-center justify-center bg-white px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          {/* Le logo reprend sa place ici sur téléphone : il vivait dans le
              panneau, qui n'y est plus. Sans filtre d'inversion, le fond
              étant clair de ce côté. */}
          <Link href="/" className="mb-9 block w-fit lg:hidden">
            <Image
              src="/branding/logo_full_name.png"
              alt="KOPPAFOOT"
              width={140}
              height={37}
              style={{ height: "auto" }}
            />
          </Link>

          {children}
        </div>

        <Link
          href="/"
          className="mt-10 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 transition-colors hover:text-emerald-700"
        >
          Retour à l&apos;accueil
        </Link>
      </main>
    </div>
  );
}
