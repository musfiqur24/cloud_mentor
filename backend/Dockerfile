FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

USER node

EXPOSE 3000

CMD ["node", "src/server.mjs"]
