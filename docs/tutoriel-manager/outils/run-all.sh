#!/bin/bash
# Rejoue tout le parcours manager et prend les captures.
# À lancer depuis ce dossier, émulateurs et application démarrés (voir README).
cd "$(dirname "$0")"
rm -rf profiles state.json captures-brutes logs
mkdir -p logs
export OUT_DIR="$PWD/captures-brutes" ASSETS="$PWD/actifs"
[ -d actifs ] || node gen-assets.mjs actifs
for f in g1-compte g2-equipe g3-recruter g4-effectif g5-preparer g6-amicaux g7-feuille g8-match-joue g9-apres-match g10-competition; do
  echo "=== $f"
  timeout 900 node $f.mjs > logs/$f.log 2>&1
  code=$?
  grep -E "📸|Error|mark:|inscription|match joué" logs/$f.log
  if [ $code -ne 0 ]; then echo "ÉCHEC $f ($code), voir logs/$f.log"; exit 1; fi
done
echo "TERMINÉ"
