#!/usr/bin/env sh
# Scan de sécurité complet (lot Léo) : dépendances + secrets + image Docker.
# Usage : npm run security:scan
# Les scans gitleaks/Trivy passent par Docker (aucune install locale requise).
set -e
export MSYS_NO_PATHCONV=1   # évite la réécriture des chemins sous Git Bash (Windows)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${IMAGE:-money_talk-api-api:latest}"

echo "==================================================================="
echo " 1/3 · npm audit — vulnérabilités des dépendances"
echo "==================================================================="
npm audit || true
echo "--- GATE : échec si vulnérabilité CRITICAL en production ---"
npm audit --omit=dev --audit-level=critical

echo
echo "==================================================================="
echo " 2/3 · gitleaks — secrets dans le code et l'historique git"
echo "==================================================================="
docker run --rm -v "$ROOT:/repo" zricethezav/gitleaks:latest \
  detect --source=/repo --config=/repo/.gitleaks.toml --redact

echo
echo "==================================================================="
echo " 3/3 · Trivy — image Docker ($IMAGE)"
echo "==================================================================="
if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker run --rm -v //var/run/docker.sock://var/run/docker.sock \
    aquasec/trivy:latest image --scanners vuln --severity HIGH,CRITICAL \
    --no-progress "$IMAGE"
else
  echo "⚠️  Image '$IMAGE' absente — build d'abord : docker compose build api"
fi

echo
echo "✅ Scan de sécurité terminé."
