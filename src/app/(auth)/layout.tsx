"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_REDIRECTS } from "@/types";
import { isOrganizer, isSuperAdmin } from "@/lib/hats";
import CadreAuth, { ChargementAuth, classeLienPiedAuth } from "@/components/auth/CadreAuth";
import { destinationDeLURL } from "@/lib/destination";

// ============================================
// L'écran d'authentification. Son habillage (le panneau de la section d'où
// l'on vient, le nom du produit, le pied) vit dans components/auth/CadreAuth,
// partagé avec /get-started : ici ne reste que le détour des comptes déjà
// connectés.
// ============================================

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
      const safeNext = destinationDeLURL();
      const parCasquette = isSuperAdmin(user) ? "/admin" : isOrganizer(user) ? "/organizer" : null;
      router.replace(safeNext ?? parCasquette ?? ROLE_REDIRECTS[user.userType] ?? "/");
    }
  }, [user, loading, router]);

  if (loading) return <ChargementAuth />;

  if (user) return null;

  return (
    <CadreAuth
      pied={
        <Link href="/" className={classeLienPiedAuth}>
          Retour à l&apos;accueil
        </Link>
      }
    >
      {children}
    </CadreAuth>
  );
}
