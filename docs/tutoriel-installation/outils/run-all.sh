#!/bin/bash
# Dessine les schémas et prend les captures du guide d'installation.
# À lancer depuis ce dossier, émulateurs et application démarrés (voir README).
cd "$(dirname "$0")"
rm -rf profiles captures-brutes logs
mkdir -p logs
export OUT_DIR="$PWD/captures-brutes"
for f in schemas i1-captures; do
  echo "=== $f"
  timeout 900 node $f.mjs > logs/$f.log 2>&1
  code=$?
  grep -E "📸|✏️|Error|mark:" logs/$f.log
  if [ $code -ne 0 ]; then echo "ÉCHEC $f ($code), voir logs/$f.log"; exit 1; fi
done
echo "TERMINÉ"
