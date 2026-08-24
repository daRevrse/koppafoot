import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { obstaclesDuCompte, purgerCompte } from "@/lib/account-purge";

// ============================================
// Supprimer son compte.
//
// Ce que la suppression NE FAIT PAS est le vrai sujet. Un compte n'est pas
// isolé : il a marqué des buts sur des feuilles de match, il figure sur des
// listes d'effectif, d'autres comptes le suivent. Effacer tout ce qui porte
// son identifiant reviendrait à trouer l'histoire des compétitions où il a
// joué, et ces buts-là appartiennent aussi aux équipes adverses, aux
// classements et aux gens qui étaient dans le stade.
//
// La règle est donc : ce qui décrit LA PERSONNE part, ce qui décrit CE QUI
// S'EST PASSÉ reste. Les `participations`, qui portent buts et passes, gardent
// déjà le nom du joueur en copie, elles resteront lisibles sans la fiche.
//
// TROIS CAS DE REFUS, et ils ne sont pas une commodité technique. Un compte
// qui gère une équipe, organise une compétition ou possède un terrain tient
// quelque chose qui appartient à d'autres. Le supprimer laisserait une équipe
// sans manager, une compétition sans organisateur, un terrain sans personne
// pour répondre aux demandes. On demande de passer la main d'abord, ce qui
// est aussi la seule occasion où quelqu'un s'en rendra compte.
//
// RECONNEXION RÉCENTE exigée. Le mot à taper dans l'interface protège du
// geste machinal, pas d'un téléphone laissé déverrouillé sur une table. Un
// jeton vieux de plus d'une demi-heure ne suffit donc pas.
// ============================================

/** Au-delà, on redemande de se connecter avant de supprimer. */
const FRAICHEUR_MAX_S = 30 * 60;

export async function POST(req: NextRequest) {
  const entete = req.headers.get("authorization");
  if (!entete?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let uid: string;
  let authTime: number;
  try {
    const decode = await adminAuth.verifyIdToken(entete.split("Bearer ")[1]);
    uid = decode.uid;
    authTime = decode.auth_time;
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  // Une session ouverte hier ne suffit pas pour effacer un compte.
  const age = Math.floor(Date.now() / 1000) - authTime;
  if (age > FRAICHEUR_MAX_S) {
    return NextResponse.json(
      {
        error: "reauth",
        message:
          "Par sécurité, reconnectez-vous avant de supprimer votre compte.",
      },
      { status: 401 },
    );
  }

  // Le mot tapé côté interface revient ici : l'interface peut être contournée,
  // pas l'API.
  const corps = (await req.json().catch(() => ({}))) as { confirmation?: string };
  if ((corps.confirmation ?? "").trim().toUpperCase() !== "SUPPRIMER") {
    return NextResponse.json({ error: "Confirmation manquante" }, { status: 400 });
  }

  const empeche = await obstaclesDuCompte(uid);
  if (empeche.length > 0) {
    return NextResponse.json({ error: "obstacles", obstacles: empeche }, { status: 409 });
  }

  // La cascade elle-même vit dans lib/account-purge : l'administration
  // efface un compte de la même façon, et deux copies auraient dérivé.
  let bilan: Record<string, number>;
  try {
    bilan = await purgerCompte(uid);
  } catch {
    return NextResponse.json(
      { error: "La suppression a échoué, votre compte est intact." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, bilan });
}
