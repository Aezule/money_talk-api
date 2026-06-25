# Pipeline CI/CD

## Présentation

Ce dépôt intègre une chaîne CI/CD complète construite sur **GitHub Actions**. L'objectif est d'automatiser les vérifications de qualité du code, les analyses de sécurité et la supervision — afin de garantir qu'aucun code cassé ou non conforme n'atteigne la branche principale.

> Le déploiement automatique est volontairement hors périmètre : le projet ne tourne pas en environnement de production. La chaîne s'arrête à l'étape **build** et pourra être étendue dès qu'un environnement cible sera défini.

***

## Stratégie de branches

Le projet suit le modèle **GitHub Flow** :

- `main` est toujours stable et considérée comme déployable
- Tout développement se fait sur une **feature branch** créée depuis `main`
- Les modifications sont intégrées via **Pull Request** uniquement
- Les pushs directs sur `main` sont **bloqués** via les règles de protection de branche

GitHub Flow a été choisi à la place de Git Flow car le projet ne nécessite pas de releases planifiées ni de maintenance de plusieurs versions en parallèle. Sa simplicité correspond mieux à un développement itératif.

### Commits conventionnels

Tous les commits doivent respecter la spécification [Conventional Commits](https://www.conventionalcommits.org/). La conformité est vérifiée automatiquement à chaque commit via **Husky** et **Commitlint**.

```
feat: ajout de l'authentification utilisateur
fix: correction de l'expiration du token
chore: mise à jour des dépendances
docs: mise à jour du README
```

***

## Pipeline

Le pipeline se déclenche sur chaque **push** et **pull request** ciblant `main`.

### Architecture

```
push / pull request
        |
        v
   [ Lint ] --> [ Test ] --> [ Build ] --> [ SonarQube ] --> [ Trivy ]
                                                |
                                          Quality Gate
                                     (bloque si non conforme)
```

### Étapes

| Étape | Outil | Rôle |
|-------|-------|------|
| Lint | ESLint | Détection des erreurs de syntaxe et de style |
| Test | Jest | Exécution des tests unitaires et rapport de couverture |
| Build | Docker | Production de l'artifact applicatif (image Docker) |
| Quality Gate | SonarQube | Bloque le pipeline si la qualité descend sous le seuil défini |
| Scan de sécurité | Trivy | Analyse de l'image Docker pour détecter les CVE connues |

### Configuration du workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test -- --coverage

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - name: Construction de l'image Docker
        run: docker build -t app:${{ github.sha }} .

  sonarqube:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: SonarSource/sonarqube-scan-action@v2
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}

  trivy:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: app:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: 1
```

***

## Conteneurisation

Un **Dockerfile** est fourni à la racine du projet. Il utilise un build multi-stage afin de produire une image finale légère et reproductible quel que soit l'environnement.

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

***

## Sécurité

### Scan de vulnérabilités — Trivy

**Trivy** analyse l'image Docker produite à chaque build en la confrontant aux bases de vulnérabilités connues (CVE). Le pipeline échoue automatiquement en présence d'une vulnérabilité de sévérité `HIGH` ou `CRITICAL`.

### Détection de secrets — Gitleaks

**Gitleaks** s'exécute à chaque pipeline pour détecter les secrets (clés API, tokens, mots de passe) accidentellement commités dans le code. Toute détection provoque l'échec immédiat du pipeline.

### Obfuscation des logs — Pino

Les logs applicatifs sont gérés par **Pino** avec des règles de redaction configurées pour masquer les champs sensibles (tokens, mots de passe, données personnelles) avant toute écriture ou transmission.

### Gestion des secrets

Tous les secrets (tokens SonarQube, identifiants registry, etc.) sont stockés dans **GitHub Secrets** et injectés à l'exécution via `${{ secrets.NOM_VARIABLE }}`. Aucun secret n'est présent en clair dans les fichiers de configuration.

***

## Supervision

### Stack

| Outil | Rôle |
|-------|------|
| Prometheus | Collecte des métriques applicatives et infrastructure |
| Grafana | Visualisation des métriques et logs via dashboards |
| Alertmanager | Routage et notification des alertes depuis les règles Prometheus |
| Loki | Agrégation et indexation des logs applicatifs |

### Architecture

```
Application
    |
    |-- Métriques --> Prometheus --> Grafana (dashboards)
    |                     |
    |                     └--> Alertmanager --> Notifications
    |
    └-- Logs --> Pino --> Loki --> Grafana (explorateur de logs)
```

Prometheus collecte les métriques exposées par l'application sur l'endpoint `/metrics`. Grafana centralise métriques (datasource Prometheus) et logs (datasource Loki) dans une interface unique, permettant de corréler un incident entre les deux sources. Les règles d'alerte sont définies dans Prometheus et routées via Alertmanager.

***

## Lancer le projet localement

**Prérequis :** Node.js 20+, Docker, Git

```bash
# Installer les dépendances
npm ci

# Lint
npm run lint

# Tests
npm run test

# Build Docker
docker build -t app:local .

# Scan Trivy (nécessite Trivy installé en local)
trivy image app:local
```

***

## Structure du dépôt

```
.
├── .github/
│   └── workflows/
│       └── ci.yml                  # Pipeline GitHub Actions
├── .husky/
│   └── commit-msg                  # Hook Commitlint
├── commitlint.config.js            # Configuration commits conventionnels
├── Dockerfile                      # Image applicative
├── sonar-project.properties        # Configuration SonarQube
└── README.md
```