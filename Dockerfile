# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
ENV MONGODB_URI="mongodb://mongo:27017/moneytalks"
COPY package.json package-lock.json ./
COPY tsconfig*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
ENV MONGODB_URI="mongodb://mongo:27017/moneytalks"
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build --ignore-scripts

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV MONGODB_URI="mongodb://mongo:27017/moneytalks"
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
