import { adminAuth } from "@/lib/firebase-admin";

/** L'appelant d'une route, d'après son jeton ; `null` sans jeton valable. */
export async function uidAppelant(req: Request): Promise<string | null> {
  const entete = req.headers.get("authorization");
  if (!entete?.startsWith("Bearer ")) return null;
  try {
    return (await adminAuth.verifyIdToken(entete.slice(7))).uid;
  } catch {
    return null;
  }
}
