import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore, setLogLevel, type Firestore } from "firebase/firestore";

// Le banc d'essai des émulateurs Firebase (voir mobile/outils/emulateurs/LISEZMOI.md) :
// le vrai firestore.rules, joué en local, sans rien écrire en production. Un
// compte = une app Firebase, signée par un jeton simulé que l'émulateur prend
// pour celui du compte ; « owner » passe outre les règles, pour préparer la base.

const HOTE = process.env.FIRESTORE_EMULATOR_HOST;

/** Vrai quand l'émulateur Firestore est lancé : les suites qui s'en servent sont ignorées sinon. */
export const EMULATEUR = Boolean(HOTE);

/** Un projet « demo-* » : l'outil ne joint jamais un vrai projet sous ce nom. */
export const PROJET = "demo-koppafoot";

// Un refus attendu par un cas s'écrirait sinon en avertissement dans la sortie.
setLogLevel("error");

const apps = new Map<string, FirebaseApp>();
const bases = new Map<string, Firestore>();

function hoteEtPort(): [string, number] {
  if (!HOTE) throw new Error("FIRESTORE_EMULATOR_HOST n'est pas défini : l'émulateur n'est pas lancé.");
  const [hote, port] = HOTE.split(":");
  return [hote, Number(port)];
}

function base(nom: string, jeton: string | { sub: string; user_id: string }): Firestore {
  const deja = bases.get(nom);
  if (deja) return deja;
  const app = initializeApp({ projectId: PROJET, apiKey: "cle-de-demo" }, nom);
  const db = getFirestore(app);
  const [hote, port] = hoteEtPort();
  connectFirestoreEmulator(db, hote, port, { mockUserToken: jeton });
  apps.set(nom, app);
  bases.set(nom, db);
  return db;
}

/** La base telle que la voit le compte `uid`, règles appliquées. */
export function connecterEnTantQue(uid: string): Firestore {
  return base(`compte-${uid}`, { sub: uid, user_id: uid });
}

/** La base sans règles, pour préparer un cas ou relire ce qu'il a laissé. */
export function connecterEnAdmin(): Firestore {
  return base("admin", "owner");
}

/** Le peu de `node:http` dont on se sert : les types de Node restent hors de l'application. */
type Http = {
  request(
    options: { host: string; port: number; method: string; path: string },
    rappel: (reponse: { statusCode?: number; resume(): void }) => void,
  ): { on(evenement: "error", f: (e: Error) => void): void; end(): void };
};

/**
 * Vide toute la base de l'émulateur, entre deux cas. Par `http` et non `fetch` :
 * le préréglage jest-expo remplace `fetch` par un bouchon qui ne répond rien.
 */
export function viderLaBase(): Promise<void> {
  const [hote, port] = hoteEtPort();
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- module de Node, chargé sous Jest seulement
  const { request } = require("node:http") as Http;
  return new Promise((resolve, reject) => {
    const requete = request(
      { host: hote, port, method: "DELETE", path: `/emulator/v1/projects/${PROJET}/databases/(default)/documents` },
      (reponse) => {
        reponse.resume();
        if (reponse.statusCode === 200) resolve();
        else reject(new Error(`L'émulateur n'a pas vidé la base : ${reponse.statusCode}`));
      },
    );
    requete.on("error", reject);
    requete.end();
  });
}

/**
 * Ferme les apps ouvertes, pour que Jest rende la main. Entre deux cas aussi
 * quand un cas écoute : le client d'un compte garde en cache ce qu'il a écrit,
 * et viderLaBase ne le lui dit pas.
 */
export async function fermer(): Promise<void> {
  await Promise.all([...apps.values()].map((a) => deleteApp(a)));
  apps.clear();
  bases.clear();
}
