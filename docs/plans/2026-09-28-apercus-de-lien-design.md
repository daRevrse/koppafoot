# Design : Des aperçus de lien dans la DA

**Date :** 2026-09-28
**Statut :** Livré. Aucune migration, aucune règle.

## Le problème

Un lien d'invitation collé dans WhatsApp dépliait une image qui ne ressemblait à rien du produit : la police par défaut de Satori, en un seul poids (d'où « KoppaFoot » en minuscules fines), un halo vert en dégradé, et une ancienne accroche, « Le football local, en direct ». Les aperçus d'un match et d'une compétition avaient le même dessin, à côté des flyers de match, eux dans la DA : cadre d'éclats verts, carte nuit, logo vert, Anton fendue, capitales Outfit.

## Décisions

- **Une seule DA pour tout ce qu'on partage** : `lib/og-da` porte le cadre d'éclats, les polices (Anton, Outfit 500/700/900), le logo, le titre fendu, l'écusson et l'adresse. Les flyers (portrait) et les aperçus de lien (paysage, 1200×630) s'en servent tous les deux. Les flyers sortent identiques à l'octet près.
- **L'accueil** : le logo, « LE FOOTBALL D'ICI » en Anton fendue, « EN DIRECT » en capitales espacées, l'adresse. C'est l'accroche du produit (`config/auth-contextes`). Rien de plus : dans une conversation, l'image est lue au tiers de sa taille, et le titre et la phrase du lien s'affichent déjà en dessous.
- **Un match** : logo (celui de la compétition quand elle en a un), contexte et état en haut à droite (« Match amical », « Quart de finale », puis la date, « En direct » en rouge, « Score final »), les deux écussons, le score ou un « V », les tirs au but, le lieu et l'adresse. Une bannière posée par l'organisateur passe toujours devant.
- **Une compétition** : son logo s'il y en a un, son nom en Anton aussi gros que possible, sur deux lignes au plus, coupées là où la plus longue est la plus courte, jamais un mot seul sur la seconde ; ses chiffres ; l'adresse.
- **Mesurer le texte** : Satori ne mesure pas. `lib/anton` porte l'avance de chaque capitale d'Anton, lue dans la police, et en déduit la taille qui tient.
- **Les logos distants sont téléchargés d'abord** (`imageDistante`), et seulement depuis le Storage du projet (`lib/image-sure`, filtre sorti de `match-public`) : un écusson qui ne répond pas retombe sur l'initiale du club au lieu de faire échouer toute l'image.

## Ce qui n'a pas changé

Le titre et la description du lien (« KoppaFoot », « La plateforme qui connecte les passionnés de football ») sont du texte, affiché sous l'image par WhatsApp : ils n'ont pas été touchés.

## Vérifications

- `mobile/src/__tests__/anton.test.ts` : largeurs retrouvées sur la police, une ligne ou deux, taille minimale.
- En local : l'aperçu de l'accueil, d'un amical à venir et joué, d'un match de compétition à venir, en direct et en finale aux tirs au but, d'une compétition avec et sans logo et au nom long, et les replis (match ou compétition introuvable). Flyers MATCHDAY et SCORE FINAL comparés octet par octet avant et après.
