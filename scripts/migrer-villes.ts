/**
 * KOPPAFOOT — Remet d'aplomb les villes déjà enregistrées (lib/villes).
 *
 * Par défaut, N'ÉCRIT RIEN : affiche, collection par collection, chaque valeur
 * qui changerait et en quoi. `--ecrire` applique.
 *
 * Une valeur sans nom de ville lisible (« 1m89 ») est vidée : la règle du
 * formulaire (`villeRequise`) l'aurait refusée, la personne la ressaisira.
 *
 * Usage:
 *   npx tsx scripts/migrer-villes.ts            # aperçu
 *   npx tsx scripts/migrer-villes.ts --ecrire   # applique
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, type DocumentReference } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";
import { normaliserVille } from "@/lib/villes";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);
const ECRIRE = process.argv.includes("--ecrire");

/** Collection (ou groupe de sous-collections) → champs de ville. */
const CIBLES: { nom: string; groupe?: boolean; champs: string[] }[] = [
  { nom: "users", champs: ["location_city"] },
  { nom: "teams", champs: ["city"] },
  { nom: "venues", champs: ["city"] },
  { nom: "venue_applications", champs: ["city"] },
  { nom: "organizer_applications", champs: ["city"] },
  { nom: "scorer_applications", champs: ["city"] },
  { nom: "matches", champs: ["venue_city"] },
  { nom: "competitions", champs: ["venue_city"] },
  { nom: "comp_matches", groupe: true, champs: ["venue_city"] },
  { nom: "registrations", groupe: true, champs: ["club_city"] },
  { nom: "shortlists", champs: ["player_city"] },
  { nom: "join_requests", champs: ["player_city"] },
  { nom: "invitations", champs: ["receiver_city"] },
];

/** Au moins trois lettres : même règle que `villeRequise`. */
const lisible = (v: string) => (v.match(/\p{L}/gu) ?? []).length >= 3;

function valeurPropre(v: string): string {
  const n = normaliserVille(v);
  return n && lisible(n) ? n : "";
}

async function main() {
  console.log(ECRIRE ? "MODE ÉCRITURE\n" : "APERÇU — rien n'est écrit (ajouter --ecrire pour appliquer)\n");
  let total = 0;
  for (const cible of CIBLES) {
    const snap = cible.groupe ? await db.collectionGroup(cible.nom).get() : await db.collection(cible.nom).get();
    const changements: { ref: DocumentReference; maj: Record<string, string> }[] = [];
    const resume = new Map<string, number>();
    for (const d of snap.docs) {
      const maj: Record<string, string> = {};
      for (const champ of cible.champs) {
        const v = d.get(champ);
        if (typeof v !== "string") continue;
        const n = valeurPropre(v);
        if (n !== v) {
          maj[champ] = n;
          const k = `${champ}: ${JSON.stringify(v)} → ${JSON.stringify(n)}`;
          resume.set(k, (resume.get(k) ?? 0) + 1);
        }
      }
      if (Object.keys(maj).length) changements.push({ ref: d.ref, maj });
    }
    console.log(`== ${cible.nom} : ${changements.length} document(s) à corriger sur ${snap.size}`);
    for (const [k, n] of [...resume].sort((a, b) => b[1] - a[1])) console.log(`   ${n} × ${k}`);
    total += changements.length;

    if (ECRIRE) {
      for (let i = 0; i < changements.length; i += 400) {
        const lot = db.batch();
        for (const c of changements.slice(i, i + 400)) lot.update(c.ref, c.maj);
        await lot.commit();
      }
    }
  }
  console.log(`\n${total} document(s) ${ECRIRE ? "corrigé(s)" : "à corriger"}.`);
  process.exit(0);
}
main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
