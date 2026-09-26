#!/bin/bash
# Rejoue tout le parcours de l'arbitre et prend les captures.
# À lancer depuis ce dossier, émulateurs vierges et application démarrés (voir README).
# Le chapitre 8 (téléphone) passe avant le 7 : le match du samedi doit être encore à venir.
cd "$(dirname "$0")"
rm -rf profiles state.json captures-brutes logs
mkdir -p logs
export OUT_DIR="$PWD/captures-brutes" ASSETS="$PWD/actifs"
[ -d actifs ] || node gen-assets.mjs actifs
for f in t0-decor t1-inscription t2-corps t3-marche t4-invitation t5-equipe t6-jour t8-telephone t7-apres; do
  echo "=== $f"
  timeout 900 node $f.mjs > logs/$f.log 2>&1
  code=$?
  grep -E "📸|Error|mark:|décor" logs/$f.log
  if [ $code -ne 0 ]; then echo "ÉCHEC $f ($code), voir logs/$f.log"; exit 1; fi
done
echo "TERMINÉ"
