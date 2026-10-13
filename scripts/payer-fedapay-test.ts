/**
 * KOPPAFOOT — Payer une collecte de test FedaPay sans passer par sa page (outil de dev).
 *
 * En bac à sable, seuls deux numéros réussissent, et ils sont béninois, au
 * format à dix chiffres : 0164000001 et 0166000001. La page de paiement de
 * FedaPay verrouille le pays sur celui du compte marchand (le Togo) : on ne
 * peut donc pas les y saisir, et tout numéro togolais y est refusé. Ce script
 * règle la collecte par l'API « sans redirection » (mode momo_test), avec le
 * numéro de test et son pays.
 *
 * Il ne touche PAS à la ligne `paiements` : c'est le retour sur le site, le
 * webhook (scripts/webhook-fedapay.ts) ou la tâche du matin qui la règle,
 * comme pour un vrai client.
 *
 * Refuse de tourner hors bac à sable.
 *
 * Usage: npx tsx scripts/payer-fedapay-test.ts <idPaiement> [echec]
 *        echec : paie avec un numéro que FedaPay refuse, pour tester le refus
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const [idPaiement, variante] = process.argv.slice(2);
const cle = process.env.FEDAPAY_SECRET_KEY ?? "";
const BASE = "https://sandbox-api.fedapay.com/v1";

/** Le numéro qui réussit, et un numéro au même format que FedaPay refuse. */
const NUMERO_REUSSI = "0164000001";
const NUMERO_REFUSE = "0160000000";

if (!idPaiement) {
  console.error("Usage: npx tsx scripts/payer-fedapay-test.ts <idPaiement> [echec]");
  process.exit(1);
}
if (process.env.FEDAPAY_ENV === "live" || !cle.startsWith("sk_sandbox_")) {
  console.error("Refus : cet outil ne paie que des collectes de bac à sable (FEDAPAY_ENV ≠ live, clé sk_sandbox_…).");
  process.exit(1);
}

async function fedapay(methode: "GET" | "POST", chemin: string, corps?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: { Authorization: `Bearer ${cle}`, Accept: "application/json", ...(corps ? { "Content-Type": "application/json" } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await res.text();
  if (!res.ok) throw new Error(`FedaPay ${res.status} sur ${methode} ${chemin} : ${texte.slice(0, 300)}`);
  return JSON.parse(texte) as Record<string, unknown>;
}

async function etatCollecte(id: number): Promise<unknown> {
  const corps = await fedapay("GET", `/transactions/${id}`);
  return (corps["v1/transaction"] as Record<string, unknown> | undefined)?.status;
}

async function main() {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
  const ligne = (await getFirestore(app).collection("paiements").doc(idPaiement).get()).data();
  if (!ligne) throw new Error(`Aucune ligne paiements/${idPaiement}`);
  if (ligne.environnement !== "sandbox") throw new Error("Cette ligne n'est pas une ligne de bac à sable.");
  const idCollecte = ligne.fedapay_id as number | null;
  if (!idCollecte) throw new Error("La ligne n'a pas encore son identifiant FedaPay.");

  console.log(`Collecte ${idCollecte}, avant : ${await etatCollecte(idCollecte)}`);
  const { token } = await fedapay("POST", `/transactions/${idCollecte}/token`);
  const numero = variante === "echec" ? NUMERO_REFUSE : NUMERO_REUSSI;
  const reponse = await fedapay("POST", "/momo_test", { token, phone_number: { number: numero, country: "bj" } });
  const intention = reponse["v1/payment_intent"] as Record<string, unknown> | undefined;
  console.log(`Paiement envoyé avec ${numero} : ${intention?.status ?? "réponse inattendue"}`);

  // L'état de la collecte suit celui de l'intention à quelques secondes près.
  for (let i = 0; i < 6; i += 1) {
    await new Promise((resoudre) => setTimeout(resoudre, 2000));
    const etat = await etatCollecte(idCollecte);
    if (etat !== "pending" || i === 5) {
      console.log(`Collecte ${idCollecte}, après : ${etat}`);
      break;
    }
  }
  console.log(`La ligne paiements/${idPaiement} n'a pas été touchée : ouvre /offre?paiement=${idPaiement}, ou joue le webhook.`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
