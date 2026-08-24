"use client";

import { auth } from "@/lib/firebase";

// ============================================
// Le côté navigateur de /api/admin/records.
//
// Rien ne s'écrit d'ici directement : ces documents appartiennent à d'autres
// comptes, et les règles Firestore ne connaissent pas d'exception « sauf si
// c'est un administrateur qui nettoie ». La seule façon de le faire sans
// ouvrir une brèche pour tout le monde est de passer par le SDK admin, donc
// par une route qui vérifie elle-même qui appelle.
// ============================================

export type RessourceAdmin = "team" | "user" | "match";

/** Une suppression refusée parce que le compte tient encore quelque chose. */
export class ObstaclesError extends Error {
  constructor(public obstacles: string[]) {
    super("obstacles");
  }
}

async function appeler(corps: Record<string, unknown>): Promise<Record<string, number>> {
  const current = auth.currentUser;
  if (!current) throw new Error("Connexion requise");

  const res = await fetch("/api/admin/records", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await current.getIdToken()}`,
    },
    body: JSON.stringify(corps),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (data.error === "obstacles") throw new ObstaclesError(data.obstacles ?? []);
    throw new Error(data.error ?? "L'opération a échoué");
  }
  return data.bilan ?? {};
}

export function modifierEnregistrement(
  resource: RessourceAdmin,
  id: string,
  data: Record<string, unknown>,
) {
  return appeler({ resource, id, action: "update", data });
}

/**
 * `force` passe outre les obstacles d'un compte — équipe gérée, compétition
 * organisée, terrain possédé. À ne faire qu'en sachant ce qu'on laisse
 * derrière : une équipe sans manager, par exemple.
 */
export function supprimerEnregistrement(
  resource: RessourceAdmin,
  id: string,
  force = false,
) {
  return appeler({ resource, id, action: "delete", force });
}
