// Un faux Firestore en mémoire pour les suites des modules serveur.
//
// Il tient ses transactions à la file, comme le vrai les isole : deux
// transactions ne s'entrelacent jamais, mais tout ce qui s'écrit HORS
// transaction peut passer entre deux. Les lectures d'une transaction voient
// l'état d'avant, ses écritures s'appliquent d'un coup à la fin.
//
// Hors de `__tests__` exprès : jest prendrait ce fichier pour une suite vide.

export type Doc = Record<string, unknown>;
export interface FauxRef { id: string; path: string }

export const base = new Map<string, Doc>();
let file: Promise<unknown> = Promise.resolve();
let compteur = 0;

/** Un identifiant comme ceux de Firestore : vingt caractères alphanumériques. */
const idNeuf = () => `Auto${String((compteur += 1)).padStart(16, "0")}`;

/** La valeur d'un champ, « pro.jusqu_au » compris. */
function champ(data: Doc, nom: string): unknown {
  return nom.split(".").reduce<unknown>((v, cle) => (v && typeof v === "object" ? (v as Doc)[cle] : undefined), data);
}

function ref(chemin: string) {
  return {
    id: chemin.split("/")[1],
    path: chemin,
    get: async () => snap(chemin),
    set: async (data: Doc, options?: { merge?: boolean }) => {
      base.set(chemin, options?.merge ? { ...(base.get(chemin) ?? {}), ...data } : { ...data });
    },
    update: async (data: Doc) => {
      if (!base.has(chemin)) throw new Error(`document absent : ${chemin}`);
      base.set(chemin, { ...base.get(chemin), ...data });
    },
    delete: async () => { base.delete(chemin); },
  };
}

function snap(chemin: string) {
  const data = base.get(chemin);
  return {
    exists: data !== undefined,
    id: chemin.split("/")[1],
    ref: ref(chemin),
    data: () => (data ? { ...data } : undefined),
    get: (nom: string) => (data ? champ(data, nom) : undefined),
  };
}

type Filtre = [string, string, unknown];

function requete(collection: string, filtres: Filtre[]) {
  const lire = async () => {
    const docs = [...base.entries()]
      .filter(([chemin, data]) => chemin.startsWith(`${collection}/`) && filtres.every(([nom, op, valeur]) => {
        const v = champ(data, nom);
        return op === "in" ? (valeur as unknown[]).includes(v) : v === valeur;
      }))
      .map(([chemin]) => snap(chemin));
    return { docs, empty: docs.length === 0, size: docs.length };
  };
  return {
    where: (nom: string, op: string, valeur: unknown) => requete(collection, [...filtres, [nom, op, valeur]]),
    limit: () => requete(collection, filtres),
    orderBy: () => requete(collection, filtres),
    get: lire,
  };
}

export const adminDb = {
  collection: (nom: string) => ({
    doc: (id?: string) => ref(`${nom}/${id ?? idNeuf()}`),
    where: (champNom: string, op: string, valeur: unknown) => requete(nom, [[champNom, op, valeur]]),
    orderBy: () => requete(nom, []),
    get: requete(nom, []).get,
  }),
  getAll: async (...refs: FauxRef[]) => refs.map((r) => snap(r.path)),
  runTransaction: <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    const suite = file.then(async () => {
      const ecritures: (() => void)[] = [];
      const resultat = await fn({
        get: async (r: FauxRef) => snap(r.path),
        set: (r: FauxRef, data: Doc, options?: { merge?: boolean }) => {
          ecritures.push(() => base.set(r.path, options?.merge ? { ...(base.get(r.path) ?? {}), ...data } : { ...data }));
        },
        update: (r: FauxRef, data: Doc) => {
          ecritures.push(() => base.set(r.path, { ...base.get(r.path), ...data }));
        },
        delete: (r: FauxRef) => { ecritures.push(() => base.delete(r.path)); },
      });
      ecritures.forEach((ecrire) => ecrire());
      return resultat;
    });
    file = suite.catch(() => {});
    return suite;
  },
};

/** À appeler avant chaque test : une base vide, une file de transactions neuve. */
export function vider(): void {
  base.clear();
  file = Promise.resolve();
}
