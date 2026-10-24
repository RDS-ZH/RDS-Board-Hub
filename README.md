# RDS-Board-Hub · 桌游联机中心平台

RDS 桌游生态的中心 Hub：**账号、游戏房间大厅、WebRTC 信令**。
游戏数据不经过服务器 —— 房主浏览器作为权威主机运行 [RDS-Board-Core](../RDS-Board-Core) 内核，
其他玩家通过 P2P DataChannel 收发投影与动作（host-authoritative P2P）。

## 架构

```
中心平台（本仓库，很轻）              边缘（浏览器，重）
┌────────────────────────┐   信令WS  ┌────────────────┐      WebRTC P2P
│ 账号(JWT) 房间大厅 信令  │◀────────▶│ 房主=权威引擎    │◀──────────────▶ 其他玩家
└────────────────────────┘          │ GameRoom+投影    │   RoomUpdate/Action
                                    └────────────────┘
```

- 服务器**无游戏状态**：只存用户、房间元数据，转发 SDP/ICE；
- 房主掉线=对局中断（M3 做检查点恢复/房主迁移）；
- 对接契约见 [docs/PROTOCOL.md](docs/PROTOCOL.md)。

## 开发

```bash
pnpm install
pnpm build          # 构建 web + room-protocol
pnpm dev            # 启动 Hub 服务（含静态大厅）http://127.0.0.1:8787
```

数据落在 `server/data/`（JSON 文件，M1 零原生依赖；量大后可换 SQLite，接口已隔离在 storage 层）。

## 目录

```
server/                  # Hono + ws：/api/auth /api/rooms /api/games + /ws 信令
web/                     # 大厅 SPA（无框架，Vite + TS）
packages/room-protocol/  # Hub↔游戏客户端共享类型与消息协议（rds-room/1）
docs/PROTOCOL.md         # 与 RDS-Board-Core 的对接契约
```
