import { cleDuJour, decalerDeJours } from "@/lib/dates";
import type { Article } from "@/lib/fil-actus";
import { API_URL } from "~/lib/config";

/** GET /api/actus/fil : le fil de la page Actus du site, trente articles. */
export async function chargerActus(): Promise<Article[]> {
  const reponse = await fetch(`${API_URL}/api/actus/fil`);
  if (!reponse.ok) throw new Error(`/api/actus/fil : ${reponse.status}`);
  const json = (await reponse.json()) as { articles?: Article[] };
  return json.articles ?? [];
}

/**
 * Le titre d'une journée du fil, comme sur le site : « Aujourd'hui », « Hier »,
 * sinon « Dimanche 25 octobre ». Le jour de la semaine en entier : c'est un
 * titre, pas une étiquette (le Direct, lui, abrège : `libelleDuJour`).
 */
export function titreDeLaJournee(cle: string | null, maintenant: Date): string {
  if (cle === null) return "Plus tôt";
  const aujourdhui = cleDuJour(maintenant);
  if (cle === aujourdhui) return "Aujourd'hui";
  if (cle === decalerDeJours(aujourdhui, -1)) return "Hier";
  const date = new Date(`${cle}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return date.charAt(0).toUpperCase() + date.slice(1);
}

/** « 14:05 » : la journée est déjà dans le titre. */
export function heureDeLArticle(at: string): string {
  const d = new Date(at);
  if (!at || Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export const nombreDArticles = (n: number) => `${n} article${n > 1 ? "s" : ""}`;

/** Le quart d'heure de la route du site : la recharger plus tôt ne rendrait rien de neuf. */
const FRAICHEUR_MS = 15 * 60_000;

/**
 * Au retour dans l'application, le fil ne se recharge que s'il a vieilli :
 * pour ce public, le forfait compte, et les titres ne bougent pas à la minute.
 */
export function aRecharger(majA: Date | null, maintenant: Date): boolean {
  return majA === null || maintenant.getTime() - majA.getTime() > FRAICHEUR_MS;
}
