# Oak & Line API (also serves the website) — for Railway, Fly.io, or any VPS with Docker.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV VITE_ROUTER=browser
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000 \
    DATABASE_PATH=/data/oakline.db \
    UPLOAD_DIR=/data/uploads \
    SEED_ASSETS_DIR=/app/assets-src
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/assets-src ./assets-src
# Mount a persistent volume here — it holds the database and every uploaded photo.
VOLUME ["/data"]
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.cjs"]
