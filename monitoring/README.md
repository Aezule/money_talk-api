# Supervision — Money Talks API

Stack d'observabilité du projet (lot **Léo**) : métriques, dashboards, alertes et
logs centralisés. Tout est auto-provisionné.

## Composants

| Service | Rôle | URL locale |
|---------|------|------------|
| Prometheus | Collecte et stocke les métriques, évalue les règles d'alerte | http://localhost:9090 |
| Alertmanager | Reçoit et route les alertes | http://localhost:9093 |
| Grafana | Dashboards (métriques + logs) | http://localhost:3001 (admin/admin) |
| Loki | Stockage des logs | http://localhost:3100 |
| Promtail | Collecte les logs des conteneurs Docker → Loki | — |

## Démarrage

1. Lancer l'API (elle expose `/metrics` sur le port 3000), au choix :
   ```bash
   npm run start:dev            # en local
   # — ou — l'app conteneurisée (mongo + mailhog + api) :
   docker compose up -d --build # depuis la racine du repo
   ```
   Dans les deux cas l'API publie le port 3000 sur l'hôte, scrapé via
   `host.docker.internal:3000`.
2. Lancer la stack de supervision :
   ```bash
   cd monitoring
   docker compose up -d
   ```
3. Ouvrir Grafana : http://localhost:3001 → dossier **Money Talks** →
   dashboard *Money Talks API — Overview*.

Vérifier que Prometheus voit l'API : http://localhost:9090/targets
(la cible `money-talks-api` doit être **UP**).

> ℹ️ Quand l'API tourne en conteneur (compose racine, service `api`), **ses logs
> JSON pino remontent automatiquement dans Loki** : Promtail découvre tous les
> conteneurs Docker via le socket. Ils sont requêtables dans Grafana
> (`{compose_service="api"}`).

## Ce qui est instrumenté

Côté application (`src/metrics/`) :
- **`/metrics`** : endpoint d'exposition Prometheus (non authentifié).
- **Métriques HTTP** (via un intercepteur global) :
  - `http_requests_total{method,route,status_code}` — compteur de requêtes ;
  - `http_request_duration_seconds{method,route,status_code}` — histogramme de latence.
- **Métriques système Node.js** par défaut : `process_*`, `nodejs_*`
  (CPU, mémoire RSS, event loop lag, GC, descripteurs…).

> Limite connue : l'intercepteur s'exécute après les guards ; une requête
> rejetée par un guard (ex. 401) n'est pas comptée. Les erreurs applicatives
> (4xx/5xx levées dans un handler) le sont, avec le bon `status_code`.

## Logs

L'application émet des **logs JSON structurés** (pino, via `nestjs-pino`), avec
masquage des en-têtes sensibles (`authorization`, `cookie`). Promtail collecte
les logs des conteneurs Docker et les pousse vers Loki, requêtables dans Grafana.

➡️ Pour que les logs de l'API remontent automatiquement, elle doit tourner en
conteneur (lot **conteneurisation / Alex**). En attendant, Promtail collecte les
logs des autres conteneurs (y compris ceux de la stack).

## Alertes

Définies dans [`prometheus/alert.rules.yml`](prometheus/alert.rules.yml) :

| Alerte | Condition | Sévérité |
|--------|-----------|----------|
| `ApiDown` | la cible ne répond plus depuis 1 min | critical |
| `HighHttpErrorRate` | > 5 % de 5xx sur 5 min | warning |
| `HighRequestLatencyP95` | p95 > 1 s sur 5 min | warning |
| `HighEventLoopLag` | event loop lag > 100 ms sur 5 min | warning |

Alertes actives : http://localhost:9090/alerts — routage : http://localhost:9093.
Pour notifier (Slack/e-mail), renseigner un `receiver` dans
[`alertmanager/alertmanager.yml`](alertmanager/alertmanager.yml).

## Validation des configs (optionnel)

Docker daemon démarré :
```bash
# Config Prometheus + règles d'alerte
docker run --rm -v "$PWD/prometheus:/p" prom/prometheus:v2.54.1 \
  promtool check rules /p/alert.rules.yml
# Config Alertmanager
docker run --rm -v "$PWD/alertmanager:/a" prom/alertmanager:v0.27.0 \
  amtool check-config /a/alertmanager.yml
```

## Arrêt

```bash
docker compose down          # stoppe la stack
docker compose down -v       # + supprime les volumes (données Prometheus/Grafana/Loki)
```

## Variables d'environnement utiles (API)

| Variable | Effet | Défaut |
|----------|-------|--------|
| `PORT` | port d'écoute de l'API | 3000 |
| `LOG_LEVEL` | niveau de log pino (`debug`, `info`, `warn`, `error`) | info |
