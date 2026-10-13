"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ROLE_REDIRECTS } from "@/types";
import { destinationDeLURL } from "@/lib/destination";
import CadreAuth, { ChargementAuth, classeLienPiedAuth } from "@/components/auth/CadreAuth";
import { EnTeteAuth, classeBoutonAuth } from "@/components/auth/auth-ui";

// /get-started est la queue du tunnel d'inscription : on y arrive juste après
// Google ou le code SMS, d'où le même cadre que (auth) (components/auth/
// CadreAuth). Arriver ici ne doit pas donner l'impression de changer de site.
//
// ON Y ARRIVE AUSSI PAR ERREUR. « Connecté, sans profil » se décide ailleurs
// sur une lecture qui peut échouer ou venir du cache de l'appareil : réseau
// coupé, cache périmé, SDK planté dans l'onglet. Un compte ancien se
// retrouvait alors devant le formulaire des nouveaux inscrits, que les règles
// l'empêchaient de valider. Avant de montrer ce formulaire, on demande donc
// AU SERVEUR si le compte a un profil : s'il en a un, on le charge et il
// repart d'où il venait ; si le serveur ne répond pas, on le dit, sans rien
// faire remplir.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading, logout, retrouverProfil } = useAuth();
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

  // Ce que le serveur a répondu, pour CE compte : rien tant qu'on attend.
  const uid = firebaseUser?.uid ?? null;
  const [reponse, setReponse] = useState<{ uid: string; etat: "absent" | "illisible" } | null>(null);
  const etat = reponse && reponse.uid === uid ? reponse.etat : "en_cours";

  useEffect(() => {
    if (loading || !uid || user) return;
    let vivant = true;
    retrouverProfil()
      // Trouvé : `user` est posé, l'effet du dessus renvoie à destination.
      .then((trouve) => { if (vivant && !trouve) setReponse({ uid, etat: "absent" }); })
      .catch((err) => {
        console.error("[onboarding] profil illisible au serveur:", err);
        if (vivant) setReponse({ uid, etat: "illisible" });
      });
    return () => { vivant = false; };
  }, [loading, uid, user, retrouverProfil]);

  if (loading) return <ChargementAuth />;

  // Don't render if no firebaseUser or if profile already exists
  if (!firebaseUser || user) return null;

  if (etat === "en_cours") return <ChargementAuth />;

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
      {etat === "illisible" ? (
        <>
          <EnTeteAuth
            titre="Connexion au serveur impossible"
            phrase="Nous n'arrivons pas à charger ton compte. Vérifie ta connexion, puis recharge la page."
          />
          <button type="button" onClick={() => window.location.reload()} className={classeBoutonAuth}>
            Recharger la page
          </button>
        </>
      ) : (
        children
      )}
    </CadreAuth>
  );
}
