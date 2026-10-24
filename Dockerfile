FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY packages/room-protocol/package.json packages/room-protocol/
COPY server/package.json server/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile=false
COPY . .
RUN pnpm build

FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY --from=build /app .
EXPOSE 8787
CMD ["pnpm", "start"]
