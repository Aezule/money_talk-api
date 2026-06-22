# Sécurité — Money Talks API

Lot **Sécurité** (Léo) : scan de vulnérabilités, gestion des secrets, et
**automatisation** de ces contrôles (hooks git + CI). Rien de manuel : les
scans tournent à des étapes définies.

## Automatisation (où les scans se déclenchent)

| Étape | Outil | Bloquant ? | Commande |
|-------|-------|-----------|----------|
| `git commit` (hook `pre-commit`) | gitleaks (secrets indexés) | ✅ oui | `.husky/pre-commit` |
| `git push` (hook `pre-push`) | `npm audit` (prod, critical) | ✅ oui | `.husky/pre-push` |
| Push / PR (CI) | npm audit + gitleaks + Trivy image | ✅ gates | étage `security` du pipeline `build.yml` (→ appelle `security.yml`) |
| À la demande | scan complet (les 3) | non | `npm run security:scan` |

**Politique de gate** (vert aujourd'hui, bloque sur régression) :
- ❌ Aucun **secret** commité (gitleaks).
- ❌ Aucune vulnérabilité **CRITICAL en production** (`npm audit --omit=dev`).
- ❌ Aucune CVE **CRITICAL corrigeable** dans l'image Docker (Trivy, `--ignore-unfixed`).
- ⚠️ Les **HIGH / MODERATE** sont **rapportées** (visibles en CI) mais non
  bloquantes — suivies dans le backlog ci-dessous.

> Le hook `pre-commit` ignore gitleaks si Docker n'est pas lancé (avec un
> avertissement) ; la CI, elle, ne peut pas être contournée.

## Outils

- **`npm audit`** — vulnérabilités des dépendances npm (natif).
- **gitleaks** (via Docker) — secrets dans le code et l'historique git.
  Config + allowlist : [`.gitleaks.toml`](.gitleaks.toml).
- **Trivy** (via Docker) — CVE de l'image Docker (OS Alpine + deps de prod).
- *Snyk : écarté (décision équipe).*

## État au dernier scan (2026-06-19)

### Dépendances (`npm audit`)
- `npm audit fix` (sûr, non-breaking) appliqué : **51 → 25** vulnérabilités.
- **Production** : 0 critical, **5 high**, 2 moderate.
- Le seul *critical* (`handlebars`) est une dépendance **de dev** (absente de
  l'image de prod).

### Image Docker (`Trivy`, `money_talk-api-api:latest`)
- **OS (alpine 3.23)** : 2 HIGH (`libssl3`, `libcrypto3` → fix `3.5.7-r0`), 8 medium, 20 low.
- **Deps Node de prod** : ~20 HIGH (voir backlog).

### Secrets (`gitleaks`)
- ✅ **Aucun secret réel** dans les 11 commits.
- 1 faux positif (token de démo du template NestJS dans un ancien README) :
  allowlisté dans `.gitleaks.toml`.

## Backlog de remédiation (par priorité)

| Priorité | Sujet | Action |
|----------|-------|--------|
| 🔴 Haute | **Secrets en dur dans `docker-compose.yml`** (`JWT_SECRET: change-me-…`, `JWT_VERIFICATION_TOKEN_SECRET`) | Les retirer du compose, ne les fournir que via `.env` (déjà gitignoré). Valider leur présence au démarrage (échec si absent). |
| 🔴 Haute | `jws` (vérification HMAC) — impacte les **JWT** | Mettre à jour la chaîne `@nestjs/jwt` / `jsonwebtoken`. |
| 🟠 Moy. | `multer`, `nodemailer`, `tar`, `path-to-regexp` (DoS, file traversal) | Bumps de version (certains via `@nestjs/platform-express`). |
| 🟠 Moy. | `@nestjs/core`, `@nestjs/swagger`, `@nestjs/platform-express` (5 high prod) | Montée de version mineure/majeure NestJS (breaking → à tester). |
| 🟡 Basse | CVE OS Alpine (`libssl3`/`libcrypto3`) | Rebuild de l'image sur une base à jour (`node:20-alpine` récent / `apk upgrade`). |

> Les bumps majeurs (`npm audit fix --force`) ne sont **pas** appliqués
> automatiquement : ils sont breaking et doivent être validés par la suite de
> tests (`npm test`) avant merge.

## Bonnes pratiques déjà en place
- ✅ Image Docker : utilisateur **non-root**, build multi-stage (pas de
  devDependencies en prod).
- ✅ `.env` **gitignoré**.
- ✅ **Masquage des secrets dans les logs** (pino `redact`) : en-têtes de requête
  `authorization` / `cookie` **et** `set-cookie` en réponse.

## Findings corrigés
- 🔒 **Fuite de tokens dans les logs** (détectée via Grafana/Loki) : le
  `Set-Cookie` de réponse exposait le `refreshToken` et l'`accessToken` (JWT) en
  clair. Corrigé en ajoutant `res.headers["set-cookie"]` à la liste `redact` de
  pino (`src/app.module.ts`). Vérifié : le champ apparaît désormais `[Redacted]`.
