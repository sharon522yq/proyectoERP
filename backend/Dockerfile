FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
COPY docs/ ./docs/
EXPOSE 4000
CMD ["node", "src/server.js"]
