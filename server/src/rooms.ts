import { rooms, users } from './storage.ts';
import { randomId } from './config.ts';
import { gameById } from './games.ts';
import type { HubRoomInfo } from '@rds-board/room-protocol';

function toInfo(r: NonNullable<ReturnType<typeof rooms.byId>>): HubRoomInfo {
  const host = users.byId(r.hostId);
  return {
    id: r.id, name: r.name, gameId: r.gameId,
    hostId: r.hostId, hostName: host?.name ?? '?', status: r.status,
    maxPlayers: r.maxPlayers,
    players: r.players.map(pid => ({ id: pid, name: users.byId(pid)?.name ?? '?' })),
    createdAt: r.createdAt,
  };
}

export function listRooms(): HubRoomInfo[] {
  return rooms.all().filter(r => r.status !== 'closed').map(toInfo);
}

export function createRoom(userId: string, name: string, gameId: string): HubRoomInfo | { error: string } {
  const game = gameById(gameId);
  if (!game) return { error: '未知游戏：' + gameId };
  const id = randomId('r_');
  const rec = {
    id, name: (name || '未命名房间').slice(0, 40), gameId, hostId: userId,
    status: 'open' as const, maxPlayers: game.maxPlayers,
    players: [userId], createdAt: Date.now(),
  };
  rooms.add(rec);
  return toInfo(rec);
}

export function joinRoom(userId: string, roomId: string): HubRoomInfo | { error: string } {
  const r = rooms.byId(roomId);
  if (!r) return { error: '房间不存在' };
  if (r.status !== 'open') return { error: '房间不可加入（' + r.status + '）' };
  if (!r.players.includes(userId)) {
    if (r.players.length >= r.maxPlayers) return { error: '房间已满' };
    r.players.push(userId);
    rooms.update(roomId, { players: r.players });
  }
  return toInfo(r);
}

export function leaveRoom(userId: string, roomId: string): HubRoomInfo | { error: string } {
  const r = rooms.byId(roomId);
  if (!r) return { error: '房间不存在' };
  rooms.update(roomId, { players: r.players.filter(p => p !== userId) });
  const after = rooms.byId(roomId)!;
  if (after.players.length === 0) { rooms.remove(roomId); return { id: roomId, closed: true } as unknown as HubRoomInfo; }
  if (after.hostId === userId) rooms.update(roomId, { hostId: after.players[0] });
  return toInfo(after);
}

export function setRoomStatus(hostId: string, roomId: string, status: 'open' | 'playing' | 'closed') {
  const r = rooms.byId(roomId);
  if (!r) return { error: '房间不存在' };
  if (r.hostId !== hostId) return { error: '只有房主可以操作' };
  rooms.update(roomId, { status });
  return toInfo(rooms.byId(roomId)!);
}
