/** rds-room/1 — Hub ↔ 桌游客户端共享协议类型。与 RDS-Board-Core src/net 对齐。 */
export const PROTOCOL_VERSION = 'rds-room/1';

/** RFC6902 子集，与内核 net/patch.ts 的 PatchOp 同形。 */
export interface PatchOp { op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test'; path: string; value?: unknown; from?: string; }

/** Host→Guest，与内核 GameRoom.RoomUpdate 同形。 */
export interface RoomUpdateMessage {
  t: 'room-update';
  viewer: string;
  revision: number;
  baseRevision: number;
  full: boolean;
  state?: unknown;
  patches?: PatchOp[];
}

/** DataChannel 上 Guest↔Host 的全部消息。 */
export type RoomChannelMessage =
  | { t: 'join'; viewer: string; token?: string }
  | { t: 'submit'; action: { type: string; playerId?: string; actorId?: string; payload?: unknown; targets?: unknown[] } }
  | { t: 'snapshot' }
  | { t: 'delta'; sinceRevision: number }
  | RoomUpdateMessage
  | { t: 'error'; message: string }
  | { t: 'bye' };

/** Hub /ws 信令消息。 */
export type SignalMessage =
  | { t: 'join-room'; roomId: string }
  | { t: 'leave-room' }
  | { t: 'hello'; selfId: string; peers: string[] }
  | { t: 'peer-join'; peerId: string }
  | { t: 'peer-leave'; peerId: string }
  | { t: 'sdp'; to: string; from: string; sdp: unknown }
  | { t: 'ice'; to: string; from: string; candidate: unknown };

/** Hub REST 上的房间/游戏 DTO。 */
export interface HubGameInfo { id: string; name: string; minPlayers: number; maxPlayers: number; clientUrl: string; protocol: string; }
export interface HubRoomInfo {
  id: string; name: string; gameId: string; hostId: string; hostName: string;
  status: 'open' | 'playing' | 'closed'; maxPlayers: number; players: { id: string; name: string }[]; createdAt: number;
}
