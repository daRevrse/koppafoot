"use client";

import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ============================================
// Suivre UN match, pour en recevoir le direct.
//
// POURQUOI PAS UN TABLEAU SUR LE PROFIL, comme pour les compétitions. Le
// suivi de compétition vit dans `users.followed_competition_ids`, et ça tient
// parce qu'il y a une poignée de compétitions. Les matchs, eux, s'accumulent :
// un supporter assidu en suit deux cents en une saison, et ce tableau serait
// relu à chaque ouverture de session, sur chaque page. Il aurait fallu un
// plafond et un élagage des matchs passés — une tâche de fond à écrire, puis
// à surveiller.
//
// Une collection à part ne grossit rien. Le document porte son identifiant
// dans son NOM (`{mid}__{uid}`), donc savoir « est-ce que je suis ce match ? »
// coûte une lecture directe, sans requête ni index. Et la diffusion lit les
// abonnés d'un match par une seule requête sur `match_id`.
//
// UNE COLLECTION UNIQUE, PAS UNE SOUS-COLLECTION, et c'est le seul écart au
// plan : les deux familles de matchs ne vivent pas au même endroit — un
// amical dans `matches`, une rencontre de compétition dans
// `competitions/{cid}/comp_matches`. Une sous-collection aurait voulu dire
// deux chemins, deux blocs de règles et deux fois le même code. Les
// propriétés recherchées — profil qui ne grossit pas, diffusion directe —
// sont les mêmes.
// ============================================

const cle = (mid: string, uid: string) => `${mid}__${uid}`;

/** Ce compte suit-il ce match ? Une lecture, pas une requête. */
export async function suitLeMatch(mid: string, uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "match_follows", cle(mid, uid)));
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * Suivre ou ne plus suivre. Rend le nouvel état.
 *
 * `cid` est enregistré quand il y en a un : la diffusion en a besoin pour
 * savoir où lire le match, et le redemander au moment d'envoyer aurait coûté
 * une lecture de plus par abonné.
 */
export async function basculerSuiviMatch(
  mid: string,
  uid: string,
  suivi: boolean,
  cid?: string | null,
): Promise<boolean> {
  const ref = doc(db, "match_follows", cle(mid, uid));
  if (suivi) {
    await setDoc(ref, {
      match_id: mid,
      user_id: uid,
      competition_id: cid ?? null,
      created_at: serverTimestamp(),
    });
    return true;
  }
  await deleteDoc(ref);
  return false;
}
