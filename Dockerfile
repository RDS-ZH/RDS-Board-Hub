# 统一使用 npm workspaces 构建，不依赖 corepack/pnpm：
# 老内核宿主机（如 CentOS 7 / kernel 3.10）上 pnpm 在构建容器内的写操作会 EPERM，
# 而 npm 在任何环境均可构建。本地开发仍用 pnpm（见 pnpm-workspace.yaml）。
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages/room-protocol packages/room-protocol
COPY server server
COPY web web
# npm 不支持 workspace: 协议，构建期将其改写为 "*"
RUN find . -name package.json -not -path '*/node_modules/*' -exec sed -i 's/"workspace:\*"/"*"/g' {} +
RUN npm install --no-audit --no-fund
RUN npm run build -w web

FROM node:22-alpine
WORKDIR /app/server
COPY --from=build /app .
ENV NODE_ENV=production
EXPOSE 8787
# WORKDIR 必须是 /app/server：serveStatic 以 cwd 解析 ../web/dist 与 ../games 相对路径
CMD ["node", "--import", "tsx", "src/index.ts"]
