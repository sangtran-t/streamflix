FROM node:22-bookworm-slim

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile --filter web

COPY web/ ./web/

WORKDIR /app/web
ENV HOST=0.0.0.0
EXPOSE 5173

CMD ["pnpm", "run", "dev"]
