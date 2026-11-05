#!/bin/bash
# Pose le décor puis tourne les cinq scènes, sur des émulateurs vierges.
# À lancer depuis ce dossier, émulateurs et application démarrés (voir README).
cd "$(dirname "$0")"
rm -rf profiles state.json cibles.json captures-brutes logs
mkdir -p logs
export OUT_DIR="$PWD/captures-brutes" ASSETS="$PWD/actifs"
[ -f actifs/portrait-ekoue.png ] || node gen-assets.mjs actifs
for f in j0-decor j1-passe j2-compte j3-equipe j4-equipe j5-apres; do
  echo "=== $f"
  timeout 1500 node $f.mjs > logs/$f.log 2>&1
  code=$?
  grep -E "📸|Error|cible|décor|défi|match|compte|stats|semaine" logs/$f.log | grep -v MetadataLookup
  if [ $code -ne 0 ]; then echo "ÉCHEC $f ($code), voir logs/$f.log"; exit 1; fi
done
echo "TERMINÉ"
