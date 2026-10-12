/**
 * KOPPAFOOT — Jouer un webhook FedaPay contre une adresse locale (outil de dev).
 *
 * FedaPay ne joint pas localhost. Ce script envoie à sa place un événement
 * signé avec FEDAPAY_WEBHOOK_SECRET (.env.local), pour exercer la route
 * /api/webhooks/fedapay : signature, relecture de la collecte, octroi unique.
 * Il ne peut rien accorder par lui-même : la route ne croit pas l'événement,
 * elle relit la collecte chez FedaPay.
 *
 * Usage: npx tsx scripts/webhook-fedapay.ts <idPaiement> [origine] [evenement]
 *        origine   : http://localhost:3000 par défaut
 *        evenement : transaction.approved par défaut
 */
import { createHmac } from "node:crypto";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const [id, origine = "http://localhost:3000", nom = "transaction.approved"] = process.argv.slice(2);
const secret = process.env.FEDAPAY_WEBHOOK_SECRET;

if (!id) {
  console.error("Usage: npx tsx scripts/webhook-fedapay.ts <idPaiement> [origine] [evenement]");
  process.exit(1);
}
if (!secret) {
  console.error("FEDAPAY_WEBHOOK_SECRET est absent de .env.local");
  process.exit(1);
}

async function main() {
  const corps = JSON.stringify({ name: nom, entity: { merchant_reference: id } });
  const t = Math.floor(Date.now() / 1000);
  const s = createHmac("sha256", secret as string).update(`${t}.${corps}`, "utf8").digest("hex");
  const res = await fetch(`${origine}/api/webhooks/fedapay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-FEDAPAY-SIGNATURE": `t=${t},s=${s}` },
    body: corps,
  });
  console.log(res.status, await res.text());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
