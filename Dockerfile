# syntax=docker/dockerfile:1

# ========== STAGE 1: Installation des dépendances ==========
FROM node:20-alpine AS deps
WORKDIR /app

# Copie des fichiers de dépendances (pour un cache optimal)
COPY package.json package-lock.json ./
COPY tsconfig*.json ./

# Installation déterministe des dépendances (inclut devDependencies pour le build)
RUN npm ci

# ========== STAGE 2: Compilation TypeScript ==========
FROM node:20-alpine AS build
WORKDIR /app

# Configuration de l'environnement
ENV NODE_ENV=production
ENV MONGODB_URI="mongodb://mongo:27017/moneytalks"

# Copie des dépendances depuis le stage précédent
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/tsconfig*.json ./

# Copie du code source
COPY src ./src

# Compilation TypeScript
RUN npm run build --ignore-scripts

# ========== STAGE 3: Image finale de production ==========
FROM node:20-alpine
WORKDIR /app

# === SÉCURITÉ ===
# Création d'un utilisateur non-root (meilleure pratique Docker)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# === CONFIGURATION ===
ENV NODE_ENV=production
ENV PORT=3000
ENV MONGODB_URI="mongodb://mongo:27017/moneytalks"

# Copie des fichiers de production
COPY package.json package-lock.json ./

# Installation des dépendances de production uniquement (sans devDependencies)
RUN npm ci --omit=dev --ignore-scripts

# Copie du build compilé
COPY --from=build /app/dist ./dist

# === DROITS ===
# Assure que l'utilisateur non-root a accès aux fichiers
RUN chown -R nextjs:nodejs /app

# On switch sur l'utilisateur non-root après l'installation
USER nextjs

# === RÉSEAU ===
# Documentation du port exposé (NestJS écoute sur 3000 par défaut)
EXPOSE 3000

# === MONITORING (CI/CD) ===
# Healthcheck pour vérifier que l'API répond
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api || exit 1

# === DÉMARRAGE ===
# Commande avec gestion stricte des erreurs
CMD ["node", "--unhandled-rejections=strict", "dist/main.js"]
