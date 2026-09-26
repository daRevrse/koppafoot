#!/bin/bash
# Rejoue tout le parcours organisateur et prend les captures.
# À lancer depuis ce dossier, émulateurs et application démarrés (voir README).
cd "$(dirname "$0")"
rm -rf profiles state.json captures-brutes logs
mkdir -p logs
export OUT_DIR="$PWD/captures-brutes" ASSETS="$PWD/actifs"
[ -d actifs ] || node gen-assets.mjs actifs
for f in f1-compte f2-competition f3-equipes f4-poules-calendrier f5-staff-partage f6-console f7-resultats f8-phase-finale f9-cloture; do
  echo "=== $f"
  timeout 900 node $f.mjs > logs/$f.log 2>&1
  code=$?
  grep -E "📸|Error|mark:|DIALOG|approve" logs/$f.log
  if [ $code -ne 0 ]; then echo "ÉCHEC $f ($code), voir logs/$f.log"; exit 1; fi
done
echo "TERMINÉ"
