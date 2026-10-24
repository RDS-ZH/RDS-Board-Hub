/** WebSocket 信令：房间组 + SDP/ICE 盲转发。不接触游戏数据。 */
import type { WebSocket } from 'ws';
import { verifyJwt } from './auth.ts';
import type { SignalMessage } from '@rds-board/room-protocol';

interface Client { userId: string; name: string; ws: WebSocket; roomId?: string; alive: boolean; }

export class SignalHub {
  private clients = new Set<Client>();

  accept(ws: WebSocket, token: string | null) {
    const payload = token ? verifyJwt(token) : null;
    if (!payload) { ws.close(4001, 'unauthorized'); return; }
    const client: Client = { userId: payload.sub, name: payload.name, ws, alive: true };
    this.clients.add(client);
    ws.on('pong', () => { client.alive = true; });
    ws.on('message', raw => this.onMessage(client, raw.toString()));
    ws.on('close', () => this.drop(client));
  }

  private drop(client: Client) {
    this.clients.delete(client);
    if (client.roomId) this.broadcastRoom(client.roomId, { t: 'peer-leave', peerId: client.userId }, client.userId);
  }

  private onMessage(client: Client, text: string) {
    let msg: SignalMessage;
    try { msg = JSON.parse(text); } catch { return; }
    switch (msg.t) {
      case 'join-room': {
        if (client.roomId) this.dropFromRoom(client);
        client.roomId = msg.roomId;
        const peers = [...this.clients]
          .filter(c => c.roomId === msg.roomId && c !== client)
          .map(c => c.userId);
        this.send(client, { t: 'hello', selfId: client.userId, peers });
        this.broadcastRoom(msg.roomId, { t: 'peer-join', peerId: client.userId }, client.userId);
        break;
      }
      case 'leave-room':
        this.dropFromRoom(client);
        break;
      case 'sdp':
      case 'ice': {
        const target = this.peerInRoom(client.roomId, msg.to);
        if (target) this.send(target, { ...msg, from: client.userId } as SignalMessage);
        break;
      }
      default: break; // 未知消息忽略（前向兼容）
    }
  }

  private dropFromRoom(client: Client) {
    if (!client.roomId) return;
    const roomId = client.roomId;
    client.roomId = undefined;
    this.broadcastRoom(roomId, { t: 'peer-leave', peerId: client.userId }, client.userId);
  }

  private peerInRoom(roomId: string | undefined, userId: string) {
    if (!roomId) return undefined;
    return [...this.clients].find(c => c.roomId === roomId && c.userId === userId);
  }

  private broadcastRoom(roomId: string, msg: SignalMessage, except?: string) {
    for (const c of this.clients) {
      if (c.roomId === roomId && c.userId !== except) this.send(c, msg);
    }
  }

  private send(c: Client, msg: SignalMessage) {
    if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg));
  }

  /** 心动检测：30s 一次，两次无 pong 踢掉。 */
  startHeartbeat(intervalMs = 30000) {
    setInterval(() => {
      for (const c of this.clients) {
        if (!c.alive) { c.ws.terminate(); continue; }
        c.alive = false;
        c.ws.ping();
      }
    }, intervalMs);
  }
}
