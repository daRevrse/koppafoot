#!/bin/bash
# Rejoue tout le parcours joueur et prend les captures.
# À lancer depuis ce dossier, émulateurs et application démarrés (voir README).
cd "$(dirname "$0")"
rm -rf profiles state.json captures-brutes logs
mkdir -p logs
export OUT_DIR="$PWD/captures-brutes" ASSETS="$PWD/actifs"
[ -d actifs ] || node gen-assets.mjs actifs
for f in j0-decor j1-compte j2-profil j3-rejoindre j4-equipe j5-convocations j6-match j7-stats j8-competition; do
  echo "=== $f"
  timeout 900 node $f.mjs > logs/$f.log 2>&1
  code=$?
  grep -E "📸|Error|mark:|inscription|décor" logs/$f.log
  if [ $code -ne 0 ]; then echo "ÉCHEC $f ($code), voir logs/$f.log"; exit 1; fi
done
echo "TERMINÉ"
