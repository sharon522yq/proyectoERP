FROM node:20-alpine AS base

WORKDIR /app

COPY backend/package*.json ./

RUN npm ci --only=production

COPY backend/src/ ./src/
COPY backend/docs/ ./docs/

EXPOSE 4000

CMD ["node", "src/server.js"]
