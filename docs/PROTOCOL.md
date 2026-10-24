# Room Protocol · 对接契约（rds-room/1）

Hub 与桌游客户端（RDS-Board-Core 前端）之间的全部契约。**内核/夹具零改动**，
对接只需实现 `RoomTransport` 的 WebRTC 适配器（见 §4）。

## 1. 角色

- **Host（房主浏览器）**：权威。运行 `UniversalGameEngine` + `GameRoom`，
  持有真实 `GameState`，为每个 viewer 计算 `O(s,i)` 投影与增量补丁。
- **Guest（其他玩家）**：无引擎。只消费自己的投影，提交 `Action`。
- **Hub（本平台）**：不接触游戏数据，只做账号、房间目录、信令转发。

## 2. 消息（DataChannel，JSON，UTF-8）

对齐内核 `src/net/room.ts` 的 `RoomTransport`：

| 方向 | 消息 | 形状 |
| --- | --- | --- |
| Guest→Host | `join` | `{ t:'join', viewer, token }` |
| Host→Guest | `room-update` | `{ t:'room-update', viewer, revision, baseRevision, full, state?, patches }` |
| Guest→Host | `submit` | `{ t:'submit', action }`（action.actorId/playerId 必须= viewer，Host 侧校验拒绝不匹配） |
| Guest→Host | `snapshot` / `delta` | `{ t:'snapshot' }` / `{ t:'delta', sinceRevision }` |
| 双向 | `bye` | `{ t:'bye' }` |

`room-update.state/patches` 与内核 `RoomUpdate` / `PatchOp`(RFC6902) 完全同形，
`full=true` 携带整体投影，否则只带 `patches`。

## 3. 信令（Hub WebSocket /ws）

```ts
type Signal =
  | { t:'join-room', roomId }                       // 客户端→Hub，进入房间信令组
  | { t:'hello', selfId, peers: string[] }          // Hub→客户端
  | { t:'peer-join', peerId } | { t:'peer-leave', peerId }
  | { t:'sdp', to, from, sdp }                      // Hub 仅转发，不解析
  | { t:'ice', to, from, candidate }
  | { t:'leave-room' }
```

认证：连接 URL `/ws?token=<jwt>`；房间内身份 = JWT 中的 userId，
Hub 保证转发消息的 `from` 不可伪造。

## 4. Host 侧对接（RDS-Board-Core 唯一新增文件）

```ts
// src/net/webrtc-transport.ts（规划，M2 实现）
export class WebRtcHostTransport implements RoomTransport {
  // DataChannel 收到 join/submit/snapshot/delta → 调 GameRoom 同名方法
  // GameRoom 返回的 RoomUpdate → 广播/单发 room-update
}
export class WebRtcGuestTransport { /* 只读投影 + submit */ }
```

启动参数由 Hub 通过 URL query 传入游戏客户端：
```
?hub=<hub-origin>&roomId=<id>&token=<jwt>&role=host|guest&playerId=<p>
```

## 5. 版本与兼容

- 协议版本 `rds-room/1`；内核 `ENGINE_VERSION`/`schemaVersion` 不匹配时 Host 拒绝 join；
- 未知消息类型必须忽略（前向兼容）；
- 新游戏 = Hub 游戏清单(`/api/games`)加一条，客户端声明协议版本。
