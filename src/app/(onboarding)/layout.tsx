"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROLE_REDIRECTS } from "@/types";
import { destinationDeLURL } from "@/lib/destination";
import CadreAuth, { ChargementAuth, classeLienPiedAuth } from "@/components/auth/CadreAuth";

// /get-started est la queue du tunnel d'inscription : on y arrive juste après
// Google ou le code SMS, d'où le même cadre que (auth) (components/auth/
// CadreAuth). Arriver ici ne doit pas donner l'impression de changer de site.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Not authenticated at all → go to login
    if (!firebaseUser) {
      router.replace("/login");
      return;
    }
    // Profile already exists → its destination (`?next=`), or its dashboard.
    // Le profil vient d'être créé ici même : sans la destination, ce détour
    // gagnait la course contre celui de la page et renvoyait à l'accueil.
    if (user) {
      router.replace(destinationDeLURL() ?? ROLE_REDIRECTS[user.userType] ?? "/");
    }
  }, [user, firebaseUser, loading, router]);

  if (loading) return <ChargementAuth />;

  // Don't render if no firebaseUser or if profile already exists
  if (!firebaseUser || user) return null;

  return (
    <CadreAuth
      // Pas « Retour à l'accueil » : on est déjà connecté, l'accueil
      // renverrait ici. Le geste utile est l'autre : on s'est trompé de
      // compte Google ou de numéro, on repart de la connexion.
      pied={
        <button type="button" onClick={() => logout()} className={classeLienPiedAuth}>
          Changer de compte
        </button>
      }
    >
      {children}
    </CadreAuth>
  );
}
