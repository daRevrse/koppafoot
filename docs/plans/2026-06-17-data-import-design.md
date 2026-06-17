# Design : Import de données (équipes/joueurs + matchs)

**Date :** 2026-06-17
**Statut :** Approuvé

## Contexte

Les effectifs sont désormais obligatoires (~300 joueurs à saisir à la main = pénible). L'organisateur veut **importer en masse** équipes+joueurs et matchs. Les matchs de poule sont aujourd'hui auto-générés (round-robin) ; on **rétrograde** cette génération en option secondaire — l'import devient la voie principale pour les matchs.

## Format

Deux sections, chacune en **coller (TSV/CSV)** OU **upload .csv** :
- **Équipes + joueurs** — 1 ligne / joueur : `Équipe, Nom, Dossard, Poste(opt)`. Les équipes sont déduites des noms distincts.
- **Matchs** — 1 ligne / match : `Domicile, Extérieur, Date, Heure, Terrain(opt), Poule(opt)`. Les équipes sont résolues **par nom** (doivent exister → lignes en erreur signalées).

Parser tolérant `parseDelimited` : détecte le délimiteur (`\t` / `;` / `,` — Excel FR utilise `;`), trim, ignore lignes vides. Le mapping colonnes→objets + le skip d'en-tête se font côté UI (qui connaît les colonnes attendues) ; **aperçu** (compte + tableau + lignes invalides) avant écriture.

## Comportement

- **Équipes** : créées si le nom n'existe pas (sigle = 3 premières lettres, couleur par défaut), sinon réutilisées ; l'effectif importé **remplace** celui de l'équipe (ré-import idempotent).
- **Matchs** : créés en batch, noms/logos dénormalisés, `status: "scheduled"`, `stage: "group"`, `group` = la colonne Poule (lettre) ou `null`, `feeds_into_* : null`. ⚠️ Les matchs à élimination restent gérés par « Générer la phase finale » (câblage bracket) — l'import vise les poules / matchs simples.

## Lib (lot 1)
- `parseDelimited(text): string[][]` (pur).
- `importTeamsPlayers(cid, rows: ImportPlayerRow[]): Promise<{ teamsCreated; teamsUpdated; players }>` — groupe par nom d'équipe, crée/réutilise, remplace l'effectif.
- `importMatches(cid, rows: ImportMatchRow[]): Promise<{ created; skipped }>` — résout les équipes par nom (skip si introuvable), crée les `comp_matches` en batch.

## UI (lot 2)
- Écran `/organizer/competitions/[cid]/import` : 2 sections (coller/upload), mapping colonnes, **aperçu + lignes invalides**, **Confirmer**. Entrées depuis la page Équipes et l'écran Calendrier.
- Écran Calendrier : l'**import devient l'action principale** ; « Générer les matchs de poule » passe en **bouton secondaire**.

## Sécurité / vérif
- Écriture via les writers existants (règles `comp_teams`/`comp_matches` = organisateur). Pas de nouvelle règle.
- Pas de test runner → `npm run build` exit 0 + `npm run lint` (zéro nouvelle erreur) + manuel (coller un petit lot → aperçu → confirmer → équipes/effectifs/matchs créés).
