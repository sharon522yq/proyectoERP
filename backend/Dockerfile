FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));p.workspaces=['backend'];fs.writeFileSync('package.json',JSON.stringify(p))"
RUN npm ci --omit=dev --workspace backend --include-workspace-root=false
COPY backend/src/ ./backend/src/
COPY backend/docs/ ./backend/docs/
COPY backend/scripts/ ./backend/scripts/
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "src/server.js"]
