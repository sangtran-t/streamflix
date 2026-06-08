FROM node:22-bookworm-slim

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json ./api/
RUN pnpm install --frozen-lockfile --filter api

COPY api/tsconfig.json api/tsconfig.build.json api/nest-cli.json ./api/
COPY api/src ./api/src

WORKDIR /app/api
RUN pnpm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/main.js"]
