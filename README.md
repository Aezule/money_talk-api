# Guide d'Utilisation - Money Talks API

## Contexte du Projet

**Money Talks API** est une API RESTful développée avec **NestJS 11**, **TypeScript** et **MongoDB**, permettant de gérer des transactions financières, budgets, utilisateurs et notifications.

**Stack technique :**
- Node.js 20.x (LTS)
- NestJS 11.x
- MongoDB 7.x (via driver natif)
- MailHog (pour les tests d'emails)
- Docker + Docker Compose

## Installation et Premier Lancement

### **Cloner le projet**

```bash
git clone git@github.com:Aezule/money_talk-api.git
```

## Services Déployés

| Service | URL | Port | Description |
|---------|-----|------|-------------|
| **API (Money Talks)** | `http://localhost:3000` | 3000 | Backend NestJS |
| **MongoDB** | `mongodb://localhost:27017` | 27017 | Base de données |
| **MailHog (Web UI)** | `http://localhost:8025` | 8025 | Interface pour voir les emails |

## Commandes de Base

### **Démarrer les services**

```bash
docker-compose up -d
```
*Le flag `-d` lance les conteneurs en arrière-plan (mode detached).*

### **Arrêter les services**

```bash
docker-compose down
```
*Arrête tous les conteneurs définis dans docker-compose.yml.*

### **Redémarrer les services**

```bash
docker-compose restart
```
*Redémarre tous les conteneurs.*

### **Nettoyer complètement**

```bash
docker-compose down -v
```
*Arrête ET supprime les volumes (attention : perte des données MongoDB).*

### **Voir l'état des services**

```bash
docker-compose ps
```
*Affiche la liste des conteneurs avec leur statut (running/exited).*

## Vérification du Fonctionnement

### **Vérifier que l'API répond**

```bash
curl -I http://localhost:3000/api
```

### **Vérifier MongoDB**

```bash
# Se connecter à MongoDB
docker exec -it mongo mongosh mongo:27017/moneytalks

# Tester une commande simple
> db.runCommand({ping: 1})
```

### **Vérifier MailHog**
Ouvre le navigateur à l'adresse : [http://localhost:8025](http://localhost:8025)

### **Voir les logs en temps réel**

```bash
# Tous les services
docker-compose logs -f

# Juste l'API
docker-compose logs -f api

# Juste MongoDB
docker-compose logs -f mongo
```

## Commandes Utiles au Quotidien

| Action | Commande | Description |
|--------|----------|-------------|
| **Lister les conteneurs** | `docker ps -a` | Affiche tous les conteneurs (même arrêtés) |
| **Entrer dans un conteneur** | `docker exec -it money-talks-api sh` | Ouvre un shell dans le conteneur API |
| **Voir les images Docker** | `docker images` | Liste toutes les images locales |
| **Supprimer une image** | `docker rmi money-talks-api` | Supprime l'image (si plus utilisée) |
| **Voir l'espace disque** | `docker system df` | Affiche l'espace utilisé par Docker |
| **Nettoyer Docker** | `docker system prune` | Supprime les images/containers inutilisés |

## Accéder à l'Application

| Service | URL |
|---------|-----|
| **API (Swagger)** | [http://localhost:3000/api](http://localhost:3000/api) |
| **MailHog (Emails)** | [http://localhost:8025](http://localhost:8025) |
