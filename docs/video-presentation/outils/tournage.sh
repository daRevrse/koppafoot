#!/bin/bash
# Tourne toutes les scènes, dans l'ordre où elles dépendent les unes des
# autres (émulateurs et application démarrés, voir ../README.md).
#   ./tournage.sh            tout, depuis des émulateurs vierges
#   ./tournage.sh p5a-compo  reprendre à cette scène (sauvegarde précédente chargée)
# Après chaque scène, l'état des émulateurs est sauvegardé (npm run sauvegarde).
cd "$(dirname "$0")"
export OUT_DIR="$PWD/captures-brutes" ASSETS="$PWD/actifs"
export CHROMIUM_PATH="${CHROMIUM_PATH:-/opt/pw-browsers/chromium}"
SCENES=(p0-decor p1-equipe p2-recrute p3-defi p4-direct p5a-compo p5b-console p6-tribune p7-joueur p8-competition p9-pros)
DEBUT="${1:-${SCENES[0]}}"
# La sauvegarde passe par le hub des émulateurs (127.0.0.1:4400), sans proxy.
sauvegarder() {
  curl -s --noproxy '*' -m 300 -X POST http://127.0.0.1:4400/_admin/export -H "content-type: application/json" \
    -d "{\"path\":\"$PWD/emulateurs/donnees\",\"initiatedBy\":\"export\"}" | grep -q OK \
    && cp state.json emulateurs/donnees/state.json
}
# Reprise : l'état de la dernière sauvegarde. Pas les sessions des navigateurs :
# des émulateurs relancés ne les reconnaissent plus. Chaque scène connecte
# elle-même les personnes qu'elle filme.
if [ "$DEBUT" != "${SCENES[0]}" ] && [ -f emulateurs/donnees/state.json ]; then
  cp emulateurs/donnees/state.json state.json
  rm -rf profiles
fi
[ -d actifs ] || node gen-assets.mjs actifs
if [ "$DEBUT" = "${SCENES[0]}" ]; then rm -rf profiles state.json cibles.json captures-brutes logs; fi
mkdir -p logs captures-brutes
parti=0
for s in "${SCENES[@]}"; do
  [ "$s" = "$DEBUT" ] && parti=1
  [ $parti = 1 ] || continue
  echo "=== $s"
  timeout 1800 node $s.mjs > logs/$s.log 2>&1
  code=$?
  grep -E "📸|Error|décor|match|équipe|fait" logs/$s.log | grep -v Deprecation
  if [ $code -ne 0 ]; then echo "ÉCHEC $s ($code), voir logs/$s.log"; exit 1; fi
  sauvegarder && echo "   (sauvegardé)"
done
echo "TERMINÉ"
