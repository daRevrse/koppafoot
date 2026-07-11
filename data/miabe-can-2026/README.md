# Miabé CAN 2026 — données d'import

Source : affiche officielle « Phase de poules » (#MIABE_CAN). 20 équipes,
5 poules, 30 matchs du 24 juillet au 9 août 2026, Haady Parc (Lomé),
horaires GMT.

## Composition des poules

| Poule | Équipes |
|---|---|
| A | Mali, Guinée C, Burkina Faso, Congo BR |
| B | Tchad, Niger, Gambie, Comores |
| C | Afrique du Sud, Nigeria, Guinée EQ, Cameroun |
| D | Ghana, Bénin, Gabon, Maroc |
| E | Sierra Leone, Côte d'Ivoire, Togo, RDA |

## Procédure d'import (espace organisateur)

1. Créer la compétition « Miabé CAN 2026 » (`/organizer/competitions/new`).
2. **Équipes** : `/organizer/competitions/[cid]/import`, coller `teams.tsv`
   (colonnes : Équipe / Nom / Dossard). Chaque équipe reçoit un joueur
   placeholder « Effectif à venir » — le ré-import d'un vrai effectif le
   remplace (l'import de roster est idempotent).
3. **Poules** : assigner les équipes aux poules A–E sur l'écran groupes
   (composition ci-dessus). Nécessaire pour les classements.
4. **Matchs** : même écran d'import, coller `matches.tsv`
   (colonnes : Domicile / Extérieur / Date / Heure / Lieu / Poule).
   Les équipes sont résolues par nom — importer les équipes AVANT les matchs.

Les noms d'équipes de `matches.tsv` doivent correspondre exactement à ceux
de `teams.tsv` (insensible à la casse, sensible aux accents).
