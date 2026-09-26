#!/bin/bash
# Rejoue tout le parcours du gérant de terrain et prend les captures.
# À lancer depuis ce dossier, émulateurs vierges et application démarrés (voir README).
cd "$(dirname "$0")"
rm -rf profiles state.json captures-brutes logs
mkdir -p logs
export OUT_DIR="$PWD/captures-brutes" ASSETS="$PWD/actifs"
[ -d actifs ] || node gen-assets.mjs actifs
for f in t0-decor t1-candidature t2-validation t3-fiche t4-demandes t5-match t6-blocage t7-gestion t8-telephone; do
  echo "=== $f"
  timeout 900 node $f.mjs > logs/$f.log 2>&1
  code=$?
  grep -E "📸|Error|mark:|décor" logs/$f.log
  if [ $code -ne 0 ]; then echo "ÉCHEC $f ($code), voir logs/$f.log"; exit 1; fi
done
echo "TERMINÉ"
