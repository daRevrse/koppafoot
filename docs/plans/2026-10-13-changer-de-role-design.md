# Design : Changer de rôle — accord, fin de KoppaFoot+, gel des équipes

**Date :** 2026-10-13
**Statut :** Décisions du fondateur du 2026-10-13, première rédaction. Second de deux chantiers : il s'appuie sur `2026-10-13-koppafoot-plus-design.md`, qui doit être livré d'abord. Deux questions restent ouvertes (« À trancher »). Spec à relire avant le plan.

## Le problème

Le rôle d'un compte (joueur, manager, arbitre) se change à un seul endroit, l'écran des rôles (`components/roles/ChoixDuRole`), par une écriture du navigateur que les règles Firestore autorisent. Rien ne peut donc s'y attacher. Trois conséquences aujourd'hui :

- **Un manager qui devient joueur garde ses équipes.** Leur `manager_id` reste le sien : un joueur dirige alors des équipes, ce que la règle du fondateur exclut (« un joueur ne dirige pas d'équipe, sauf s'il est ajouté dans le staff d'une équipe, et cela avec des limites »).
- **Il garde son KoppaFoot+**, offre réservée aux managers et aux casquettes. Le premier chantier le limite déjà à ce que le compte est ; il ne le termine pas.
- **Le rôle s'écrit sans le serveur.** `evolution_role` n'est même pas un champ protégé : aucune condition posée dans un écran ne tient face à une écriture directe.

## Ce que le fondateur a tranché

- **Changer de rôle demande un accord explicite**, et met fin à KoppaFoot+, sans remboursement.
- **Sauf casquette** : un compte qui reste organisateur ou propriétaire de terrain garde KoppaFoot+, limité à sa casquette.
- **« Un manager qui change de rôle gèle ses équipes, qui ne sont plus actives, mais leur fiche est disponible au public. »**
- **Une équipe gelée revit si son manager reprend le rôle.** Pas de transmission à un autre manager : ce geste n'existe pas, et n'entre pas ici.

## Le changement de rôle passe par le serveur

- **Une route, `POST /api/roles`**, écrit le rôle et tout ce qui en dépend dans une même transaction : le rôle et ses champs (ville, genre, poste, pied fort, licence, nom d'équipe), la fin de KoppaFoot+ s'il le faut, le gel ou le dégel des équipes.
- **Les règles Firestore se ferment d'autant.** Un navigateur n'écrit plus ni `user_type` ni `evolution_role` sur un profil existant. À la création, un compte choisit toujours son rôle : la garde `creationSansPrivilege` l'encadre déjà (PR #110).
- **Les deux autres chemins sont déjà au serveur** : l'invitation à reprendre une équipe (`/api/team-manager-invites`), et la promotion par l'administration. L'application mobile n'écrit pas de rôle.

## L'accord

Avant d'écrire quoi que ce soit, le serveur calcule ce que le changement coûte. S'il coûte quelque chose et que l'accord n'est pas donné, il refuse et rend le détail ; l'écran l'affiche et demande une confirmation, une seule :

> Devenir joueur, c'est :
> - geler tes 2 équipes, Étoile de Bè et Étoile de Bè U17 : plus de match, plus de recrutement. Leur fiche reste visible.
> - mettre fin à ton KoppaFoot+, qui courait jusqu'au 12 novembre. Il n'est pas remboursé.
> - endormir ton club.

- Chaque ligne n'apparaît que si elle s'applique.
- Le compte garde une casquette : la ligne de KoppaFoot+ devient une information, « Ton KoppaFoot+ continue pour tes compétitions. Il ne couvrira plus tes équipes ni ton club. »
- Rien à perdre (un joueur qui devient arbitre, un compte qui prend son premier rôle) : pas de question, comme aujourd'hui.
- Accepté : tout s'écrit ensemble. Refusé : rien ne change.

## La fin de KoppaFoot+

- **Quand** : le compte a un KoppaFoot+ actif, et son nouveau profil n'y a plus droit (ni manager, ni organisateur, ni propriétaire de terrain).
- **Résilié veut dire terminé.** Le droit s'arrête la veille (`jusqu_au`), et son `motif` dit pourquoi. Redevenir manager ne le rend pas : il faut le racheter. Les paiements passés restent au journal.
- **Quelle que soit son origine** : un KoppaFoot+ accordé à la main par l'administration s'arrête de la même façon. Le droit suit le profil.
- **Pas de remboursement**, ni total ni au prorata. Les conditions d'utilisation le disent.
- **« Pas de pubs » n'est pas touché.**

## Le gel des équipes

### Quand
Le compte quitte le rôle manager : toutes les équipes dont il est le manager (`manager_id`) sont gelées, dans la transaction qui change son rôle.

### Ce qui se fige
Plus personne ne dirige l'équipe, ni son ancien manager, ni son staff :

- pas de nouveau match, pas de défi lancé ni accepté, pas d'inscription à une compétition ;
- pas de recrutement ni de mercato : elle ne cherche plus de joueurs et n'en reçoit plus ;
- effectif, composition et dossards figés ; pas de convocation ; pas de joueur ajouté.

### Ce qui reste
- **Sa fiche publique**, avec toute son histoire : matchs joués, résultats, statistiques, effectif. Elle porte la mention « Équipe gelée ».
- **Ses joueurs** restent dans l'effectif, et chacun peut la quitter.
- **Rien n'est effacé.**

### Où ça tient
Les gestes de gestion d'une équipe passent déjà par une garde commune : `peutGererEquipe` (`lib/team-access`, lue par les écrans et par le serveur) et `equipeGeree` dans les règles Firestore. Le gel se pose là, une fois :

- une équipe porte `gelee_le` (la date du gel, absente ou nulle quand elle vit) ;
- `peutGererEquipe` et `equipeGeree` répondent non pour une équipe gelée, à tout le monde ;
- la règle de mise à jour de `teams` refuse au manager et au staff d'écrire sur une équipe gelée ;
- les listes où l'on choisit une équipe (adversaire d'un défi, équipes qui recrutent, inscription à une compétition) ne la proposent plus.

Le champ est écrit par le serveur seul : sans cela, il suffirait de l'effacer pour dégeler son équipe.

### Le dégel
Le compte redevient manager, par l'écran des rôles ou en acceptant de reprendre une équipe : ses équipes gelées revivent, dans la même transaction. Rien d'autre ne dégèle une équipe.

Une équipe gelée compte toujours parmi les siennes. S'il revient avec plus d'équipes que le plafond gratuit et sans KoppaFoot+, il les garde toutes : une limite se vérifie quand on crée, jamais après coup (`lib/offre`).

## Où ça vit

| Donnée | |
|---|---|
| `users/{uid}` | `user_type` et `evolution_role` ne s'écrivent plus que par le serveur. |
| `teams/{id}` | `gelee_le`, écrit par le serveur seul. |
| `droits/{uid}` | Un `pro` résilié garde sa trace : `jusqu_au` ramené à la veille, et `motif` dit pourquoi. |
| `firestore.rules` | `evolution_role` rejoint les champs protégés, la branche qui laissait le titulaire changer de rôle disparaît ; `gelee_le` n'est pas écrit par un navigateur ; une équipe gelée n'est plus modifiable par son manager ni son staff. **À déployer avec le code**, pas avant : l'écran des rôles en ligne écrit encore par le navigateur. |

## Les pièces

| Fichier | Rôle |
|---|---|
| `src/lib/roles.ts` (nouveau) | Pur : ce qu'un changement de rôle coûte (équipes à geler, KoppaFoot+ à résilier ou à limiter, club à endormir), d'après le profil d'avant, celui d'après, les droits et les équipes. |
| `src/lib/roles-serveur.ts` (nouveau) | La transaction : rôle, champs, résiliation, gel ou dégel. |
| `src/app/api/roles/route.ts` (nouveau) | `POST`. Répond qu'un accord est requis, avec le détail, tant qu'il n'est pas donné. |
| `src/components/roles/ChoixDuRole.tsx` | Appelle la route ; affiche le coût et demande l'accord. |
| `src/lib/team-access.ts`, `team-access-server.ts` | `peutGererEquipe` refuse une équipe gelée. |
| `src/app/api/team-manager-invites/[id]/route.ts` | Devenir manager par ce chemin dégèle aussi. |
| La fiche d'une équipe, les listes d'équipes | La mention « Équipe gelée » ; l'équipe retirée des choix. |
| `firestore.rules` | Le rôle et le gel ne s'écrivent plus par le navigateur ; `equipeGeree` refuse une équipe gelée. |
| Conditions | La fin de KoppaFoot+ au changement de rôle, sans remboursement ; le gel des équipes. |

## Ce qui protège

- **Le rôle ne s'écrit plus depuis un navigateur** : c'est ce qui rend l'accord impossible à éviter.
- **Le coût se calcule au serveur**, sur ce qu'il relit dans la transaction. L'écran ne fait que l'afficher ; l'accord qu'il renvoie ne vaut que pour ce coût-là.
- **Tout ou rien** : rôle, résiliation et gel s'écrivent ensemble. Un échec ne laisse pas un joueur avec des équipes vivantes, ni un manager sans son KoppaFoot+.
- **Le gel ne s'efface pas à la main** : `gelee_le` est au serveur.

## Quand ça casse

| Cas | Ce qui se passe |
|---|---|
| Un manager avec deux équipes et KoppaFoot+ veut devenir joueur | Le serveur rend le coût. Accepté : équipes gelées, KoppaFoot+ terminé, club endormi, rôle changé. |
| Il refuse | Rien ne change. |
| Il est aussi organisateur | Équipes gelées, club endormi ; KoppaFoot+ continue pour ses compétitions. |
| Il redevient manager | Ses équipes revivent. Son KoppaFoot+ résilié ne revient pas ; son club reste endormi tant qu'il ne l'a pas racheté. |
| Le coût a changé entre l'affichage et l'accord (une équipe créée entre-temps) | Le serveur refuse de nouveau et rend le coût à jour. |
| Un membre du staff d'une équipe gelée veut composer | Refusé : plus personne ne la dirige. |
| Un joueur d'une équipe gelée veut la quitter | Il peut. |
| Quelqu'un écrit son rôle directement dans la base | Refusé par les règles. |

## Vérifications

- Tests purs : le coût d'un changement de rôle, pour chaque passage (manager vers joueur avec et sans équipes, avec et sans KoppaFoot+, avec une casquette ; joueur vers arbitre ; premier rôle ; retour au rôle manager).
- Tests du serveur, contre le faux Firestore : sans accord rien ne s'écrit ; avec accord tout s'écrit ensemble ; l'accord donné pour un coût périmé est refusé ; le dégel au retour ; un KoppaFoot+ résilié ne revient pas ; `peutGererEquipe` refuse une équipe gelée à son manager et à son staff.
- Règles Firestore, par le moteur de Firebase sans déployer : le rôle et `gelee_le` refusés au navigateur ; une équipe gelée non modifiable ; les inscriptions toujours acceptées.
- Bac à sable : un manager passe joueur, voit le coût, accepte ; ses équipes portent « Équipe gelée » et ne proposent plus rien ; il redevient manager, elles revivent.

## Hors périmètre

- Confier une équipe à un autre manager.
- Supprimer une équipe : inchangé.
- L'application mobile : elle n'a pas de changement de rôle.

## À trancher

- **Les matchs déjà programmés d'une équipe au moment du gel** (un amical samedi, un défi accepté) : sont-ils annulés, avec l'adversaire prévenu, ou laissés tels quels ?
- **Une équipe engagée dans une compétition en cours** : ses matchs de compétition sont tenus par l'organisateur. Continue-t-elle la compétition gelée, ou l'organisateur est-il prévenu pour la retirer ?
