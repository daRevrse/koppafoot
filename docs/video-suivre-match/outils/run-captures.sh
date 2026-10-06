#!/bin/bash
# Pose le décor puis tourne le match, vu du téléphone du supporter.
# À lancer depuis ce dossier, émulateurs vierges et application démarrés (voir README).
cd "$(dirname "$0")"
rm -rf profiles state.json cibles.json captures-brutes logs
mkdir -p logs
export OUT_DIR="$PWD/captures-brutes" ASSETS="$PWD/actifs"
[ -f actifs/ecusson-avenir.png ] || node gen-assets.mjs actifs
for f in s0-decor s1-supporter; do
  echo "=== $f"
  timeout 900 node $f.mjs > logs/$f.log 2>&1
  code=$?
  grep -E "📸|Error|cible|décor|match" logs/$f.log
  if [ $code -ne 0 ]; then echo "ÉCHEC $f ($code), voir logs/$f.log"; exit 1; fi
done
echo "TERMINÉ"
