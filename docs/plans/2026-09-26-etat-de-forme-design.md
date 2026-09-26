# Design : État de forme du joueur

**Date :** 2026-09-26
**Statut :** Livré. Aucune règle Firestore à déployer. Le document des formes se remplit à la première fin de match, ou au premier affichage d'une forme (voir « Mise en service »).

## Contexte

Un manager qui compose sa feuille n'avait rien pour savoir qui est blessé, suspendu ou absent, ni qui arrive en forme. Deux informations différentes, qui ne se déduisent pas l'une de l'autre :

- **La condition**, que seul le joueur connaît : apte, incertain, blessé, suspendu, indisponible. Elle se **déclare**.
- **La forme**, que les matchs disent : les notes que la console calcule déjà pendant le direct (`lib/notes`). Elle se **calcule**.

Un attaquant peut sortir de trois matchs à but et s'être tordu la cheville mardi : forme excellente, ne jouera pas samedi. Les deux s'affichent donc côte à côte, jamais fusionnées.

## Décisions

1. **La condition vit sur le document du joueur** (`users.condition`), écrite par lui seul — les règles l'y autorisent déjà (`noProtectedFields`). Pour un joueur sans compte, elle vit sur sa fiche `ghost_players` et c'est son manager qui la déclare (règles `equipeGeree`, déjà en place).

   ```
   condition: { statut, retour_prevu: "AAAA-MM-JJ" | null, note: string | null, declaree_le: ISO }
   ```

   - **Le jour du retour, elle s'efface d'elle-même** (`conditionEnVigueur`). Sans ça, l'effectif afficherait des blessés guéris depuis des semaines, et plus personne ne croirait la pastille.
   - Lecture tolérante (`lireCondition`) : le document s'écrit depuis le client, un statut inconnu vaut « rien de déclaré ».
   - **La feuille avertit, elle ne bloque pas** : une déclaration oubliée ne doit pas empêcher d'aligner un joueur présent.
   - Visible des comptes connectés (comme tout `users`), **jamais** de la projection publique `/api/public/profile`.

2. **La forme se calcule sur les 5 derniers matchs**, la fenêtre du classement (`lib/classement`), à partir des notes de `lib/notes` :
   - moyenne **pondérée vers le récent** (5, 4, 3, 2, 1) ;
   - niveau : ≥ 7,2 « en pleine forme », ≥ 6,5 « en forme », ≥ 5,6 « forme moyenne », sinon « en méforme » (seuils de `tonNote` resserrés : une moyenne revient vers 6) ;
   - pente sur au moins trois matchs notés (deux derniers contre les précédents, écart de 0,4) ;
   - pas de niveau sous **deux matchs notés** ; un remplaçant entré trop tard n'est pas noté mais occupe sa place dans la fenêtre ;
   - les buts annulés par la VAR sont écartés ; un match renseigné après coup (sans feuille) n'entre pas.

3. **Publiée dans un document, comme le classement** (`rankings/formes`, `lib/formes-admin`). Elle se recalcule dans `POST /api/rankings/rebuild`, que la console appelle au coup de sifflet final, **sur la même lecture de matchs** que le classement. Une page d'effectif lit ensuite la forme de tous ses joueurs en une seule requête (`GET /api/public/formes?cles=…`).

   - Clés : `uid:<compte>` (l'identité est le compte, comme au classement), `ligne:<équipe>:<ligne>` pour un joueur sans compte **sur un amical** uniquement. Les lignes de compétition jamais revendiquées et les « Joueur N » d'un adversaire hors plateforme ne sont pas publiées : aucune page ne les affiche, et elles feraient gonfler le document.
   - Seules les formes de moins de 120 jours sont publiées, ce qui borne la taille du document par les joueurs actifs. Au-delà de quelques centaines de joueurs actifs, passer à un document par joueur : `lireFormes` garde sa signature.

4. **Le manager est prévenu** (`POST /api/joueurs/condition`) quand un joueur change de statut — pas quand il corrige son mot. Destinataires : le manager et le staff délégué de chaque équipe du joueur ; ni l'effectif ni les abonnés. Le message est relu sur le document, jamais pris dans la requête, et le mot libre du joueur n'y figure pas.

## Où ça s'affiche

| Écran | Condition | Forme |
|---|---|---|
| Mes statistiques, Mon profil (onglet infos) | déclarée ici | détail + frise des 5 notes |
| Fiche publique `/profile/[uid]` | lecture (connecté) | détail + frise |
| Effectif `/teams/[id]` | pastille ; bouton « Condition » pour les joueurs sans compte | pastille |
| Feuille de match `/matches/[id]` | pastille + avertissement si non jouable | pastille |

## Mise en service

Le document `rankings/formes` n'existe qu'après le premier recalcul. Pour ne pas attendre une fin de match, `GET /api/public/formes` le calcule une fois s'il manque (une tentative par instance et par quart d'heure).

## Fichiers

- `src/lib/etat-de-forme.ts` — module pur : condition, calcul de la forme, clés.
- `src/lib/formes-admin.ts` — publication et lecture du document.
- `src/lib/classement-admin.ts` — `matchsDeLaPlateforme` exporté, avec durée, lien et drapeau `amical`.
- `src/app/api/rankings/rebuild/route.ts`, `src/app/api/public/formes/route.ts`, `src/app/api/joueurs/condition/route.ts`.
- `src/components/forme/*`, `src/hooks/useFormes.ts`.
- Tests : `mobile/src/__tests__/etat-de-forme.test.ts` (la suite jest de l'application teste les modules purs du site).

## Hors périmètre

- L'application mobile n'affiche pas encore l'état de forme.
- Un manager ne peut pas déclarer la condition d'un joueur **qui a un compte** : ce serait une seconde vérité à côté de celle du joueur.
- Pas de suspension automatique après un carton rouge : les règles varient d'une compétition à l'autre.
