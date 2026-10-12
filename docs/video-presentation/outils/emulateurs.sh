#!/bin/bash
# Les émulateurs du tournage, avec les règles du dépôt. S'il existe une
# sauvegarde (npm run sauvegarde), on repart d'elle.
cd "$(dirname "$0")"
cp ../../../firestore.rules ../../../firestore.indexes.json ../../../storage.rules emulateurs/
REPRISE=""
[ -f emulateurs/donnees/firebase-export-metadata.json ] && REPRISE="--import=emulateurs/donnees"
# Sans proxy : les émulateurs ne parlent qu'entre eux, en local. Un proxy
# hérité de l'environnement intercepterait l'export (npm run sauvegarde).
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy GLOBAL_AGENT_HTTP_PROXY GLOBAL_AGENT_HTTPS_PROXY
exec npx firebase emulators:start --project demo-koppafoot --only auth,firestore,storage --config emulateurs/firebase.json $REPRISE
